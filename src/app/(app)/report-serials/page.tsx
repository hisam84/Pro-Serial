import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { clinics, doctors as doctorsTable } from "@/db/schema";
import { requireUser, toActor } from "@/lib/auth";
import { canUseSerials } from "@/lib/rbac";
import {
  listDoctorsForActor,
  matchesPatientSearch,
  groupSerialRowsForDisplay,
  listSerials,
  summarizeCounts,
  type SerialRow,
} from "@/lib/serials";
import {
  buildSmsInput,
  buildSmsLink,
  renderSmsTemplate,
} from "@/lib/sms";
import { effectiveSmsTemplate } from "@/lib/doctors";
import { normalizeMobile } from "@/lib/mobile";
import { todayInTz } from "@/lib/dates";
import {
  toClientRow,
  type SmsPayload,
} from "@/lib/serial-client";
import { SerialCard } from "@/components/serials/serial-card";
import { ReportQueueFilters, type ReportTab } from "@/components/serials/report-queue-filters";
import { SerialModeToggle } from "@/components/serials/serial-mode-toggle";
import { buttonClass } from "@/components/ui/button";
import { EmptyState, StatCard } from "@/components/ui/card";
import { PlusIcon } from "@/components/ui/icons";
import { formatDateWithDay, toDigits } from "@/lib/utils";

export const metadata = { title: "Report serials" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function ReportSerialsPage({ searchParams }: PageProps) {
  const db = await getDb();
  const user = await requireUser(db);
  if (!canUseSerials(user) || !user.clinicId) redirect("/unauthorized");

  const sp = await searchParams;
  const clinicRows = await db
    .select({ timezone: clinics.timezone, name: clinics.name })
    .from(clinics)
    .where(eq(clinics.id, user.clinicId))
    .limit(1);
  const timezone = clinicRows[0]?.timezone ?? "Asia/Dhaka";
  const clinicName = clinicRows[0]?.name ?? "";

  const doctors = await listDoctorsForActor(db, toActor(user));
  const date = first(sp.date) || todayInTz(timezone);
  const requestedDoctor = first(sp.doctorId);
  const doctorId =
    requestedDoctor && doctors.some((d) => d.id === requestedDoctor)
      ? requestedDoctor
      : (doctors[0]?.id ?? "");

  const tabRaw = first(sp.tab);
  const tab: ReportTab =
    tabRaw === "report_new" || tabRaw === "report_old" ? tabRaw : "all";
  const query = first(sp.q).trim();
  const reportSubmissionRaw = first(sp.reportSubmission);
  const reportSubmission: "" | "submitted" | "not_submitted" =
    reportSubmissionRaw === "submitted" || reportSubmissionRaw === "not_submitted"
      ? reportSubmissionRaw
      : "";

  // Load all serials for date & doctor to compute mode toggle counters
  const allRows = await listSerials(db, toActor(user), {
    date,
    doctorId: doctorId || undefined,
  });
  const allCounts = summarizeCounts(allRows);

  // Filter to report rows only
  const reportRows = allRows.filter(
    (r) =>
      r.patientType === "report" ||
      r.patientType === "report_new" ||
      r.patientType === "report_old",
  );

  // Apply report submission filter if specified
  const filteredReportRows = reportSubmission
    ? reportRows.filter((r) =>
        reportSubmission === "submitted" ? r.reportSubmitted : !r.reportSubmitted,
      )
    : reportRows;

  const reportCounts = {
    activeReportNew: allCounts.activeReportNew,
    activeReportOld: allCounts.activeReportOld,
    activeReport: allCounts.activeReport,
    submitted: reportRows.filter((r) => r.reportSubmitted && r.status !== "cancelled").length,
    completed: reportRows.filter((r) => r.status === "completed").length,
    cancelled: reportRows.filter((r) => r.status === "cancelled").length,
    total: reportRows.filter((r) => r.status !== "cancelled").length,
  };

  const searchedRows = query
    ? filteredReportRows.filter((row) => matchesPatientSearch(row, query))
    : filteredReportRows;

  const queueRows = searchedRows.filter((r) => {
    if (tab === "report_new") return r.patientType === "report_new" || r.patientType === "report";
    if (tab === "report_old") return r.patientType === "report_old";
    return true;
  });

  const { activeSerials, completed, cancelled } = groupSerialRowsForDisplay(queueRows);

  // Doctor templates (for SMS payloads) — loaded once per doctor.
  const doctorIds = [...new Set(filteredReportRows.map((r) => r.doctorId))];
  const templateRows = doctorIds.length
    ? await db
        .select({
          id: doctorsTable.id,
          smsTemplateNew: doctorsTable.smsTemplateNew,
          smsTemplateOld: doctorsTable.smsTemplateOld,
          smsTemplateReport: doctorsTable.smsTemplateReport,
          smsTemplateReportNew: doctorsTable.smsTemplateReportNew,
          smsTemplateReportOld: doctorsTable.smsTemplateReportOld,
        })
        .from(doctorsTable)
        .where(inArray(doctorsTable.id, doctorIds))
    : [];
  const templateById = new Map(templateRows.map((t) => [t.id, t]));

  function smsFor(row: SerialRow): SmsPayload {
    const input = buildSmsInput({
      patientName: row.patientName,
      patientMobile: row.patientMobileDisplay,
      patientAddress: row.patientAddress,
      patientType: row.patientType,
      serialNumber: row.serialNumber,
      appointmentDate: row.appointmentDate,
      doctorName: row.doctorName,
      clinicName,
      referenceDetails: row.referenceDetails,
      isReference: row.isReference,
    });
    const message = renderSmsTemplate(
      effectiveSmsTemplate(
        templateById.get(row.doctorId) ?? {
          smsTemplateNew: null,
          smsTemplateOld: null,
          smsTemplateReport: null,
          smsTemplateReportNew: null,
          smsTemplateReportOld: null,
        },
        row.patientType,
      ),
      input,
    );
    const mobile = normalizeMobile(row.patientMobileDisplay);
    return {
      patientName: row.patientName,
      mobileDisplay: row.patientMobileDisplay,
      dial: mobile.dial || row.patientMobileDisplay,
      doctorName: row.doctorName,
      clinicName,
      appointmentDate: row.appointmentDate,
      serialLabel: row.serialNumber != null ? toDigits(row.serialNumber) : "—",
      message,
      smsLink: buildSmsLink(mobile.dial || row.patientMobileDisplay, message),
    };
  }

  const selectedDoctor = doctors.find((d) => d.id === doctorId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Report serials</h1>
          <p className="mt-0.5 text-[13px] text-slate-500">
            {formatDateWithDay(date)}
            {selectedDoctor ? ` · ${selectedDoctor.name}` : ""}
          </p>
        </div>
        <Link
          href={`/report-serials/new?doctorId=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(date)}`}
          className={buttonClass("primary", "md") + " bg-amber-600 hover:bg-amber-700"}
        >
          <PlusIcon size={18} />
          New report serial
        </Link>
      </div>

      {/* Mode Switcher: Regular vs Report */}
      <SerialModeToggle
        mode="report"
        date={date}
        doctorId={doctorId}
        regularCount={allCounts.activeNew + allCounts.activeOld + allCounts.activeReference}
        reportCount={allCounts.activeReport}
      />

      {/* Report Stat Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Report (New)" value={toDigits(reportCounts.activeReportNew)} accent="amber" />
        <StatCard label="Report (Old)" value={toDigits(reportCounts.activeReportOld)} accent="orange" />
        <StatCard label="Report submitted" value={toDigits(reportCounts.submitted)} accent="emerald" />
        <StatCard label="Completed" value={toDigits(reportCounts.completed)} accent="brand" />
        <StatCard label="Cancelled" value={toDigits(reportCounts.cancelled)} accent="red" />
        <StatCard label="Total report patients" value={toDigits(reportCounts.total)} accent="slate" />
      </div>

      {/* Report Queue Filters */}
      <ReportQueueFilters
        key={`${date}:${doctorId}:${query}:${tab}:${reportSubmission}`}
        date={date}
        doctorId={doctorId}
        query={query}
        doctors={doctors}
        tab={tab}
        reportSubmission={reportSubmission}
        counts={reportCounts}
      />

      {/* Active Report Serials */}
      {activeSerials.length > 0 && (
        <section aria-label="Active report serials">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-amber-800">
            Active report queue ({toDigits(activeSerials.length)})
          </h2>
          <ul className="space-y-2">
            {activeSerials.map((row) => {
              const activeQueue = queueRows
                .filter(
                  (item) =>
                    item.status === "active" &&
                    item.patientType === row.patientType,
                )
                .sort(
                  (a, b) => (a.serialNumber ?? 0) - (b.serialNumber ?? 0),
                );
              const queueIndex = activeQueue.findIndex(
                (item) => item.id === row.id,
              );
              return (
                <SerialCard
                  key={row.id}
                  row={toClientRow(row)}
                  canEdit
                  canChangeNumber={user.role === "clinic_admin"}
                  canReorder={
                    user.role === "clinic_admin" || user.role === "attendant"
                  }
                  canMoveUp={queueIndex > 0}
                  canMoveDown={
                    queueIndex >= 0 && queueIndex < activeQueue.length - 1
                  }
                  sms={smsFor(row)}
                />
              );
            })}
          </ul>
        </section>
      )}

      {/* Completed Serials */}
      {completed.length > 0 && (
        <section aria-label="Completed reports">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-emerald-700">
            Completed reports ({toDigits(completed.length)})
          </h2>
          <ul className="space-y-2">
            {completed.map((row) => (
              <SerialCard
                key={row.id}
                row={toClientRow(row)}
                canEdit={false}
                canChangeNumber={false}
                sms={smsFor(row)}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Cancelled Serials */}
      {cancelled.length > 0 && (
        <section aria-label="Cancelled report serials">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-red-600">
            Cancelled ({toDigits(cancelled.length)})
          </h2>
          <ul className="space-y-2">
            {cancelled.map((row) => (
              <SerialCard
                key={row.id}
                row={toClientRow(row)}
                canEdit={false}
                canChangeNumber={false}
                sms={smsFor(row)}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Empty State */}
      {activeSerials.length === 0 &&
        completed.length === 0 &&
        cancelled.length === 0 && (
          <EmptyState
            title={query ? "No report serials match your search" : "No report serials for this date"}
            description={
              query
                ? "Try searching with a different patient name or mobile number."
                : "No patients have been issued a test report serial for this doctor on this day."
            }
            action={
              <Link
                href={`/report-serials/new?doctorId=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(date)}`}
                className={buttonClass("primary", "md") + " bg-amber-600 hover:bg-amber-700"}
              >
                <PlusIcon size={18} />
                Create report serial
              </Link>
            }
          />
        )}
    </div>
  );
}
