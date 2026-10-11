import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { clinics, doctors as doctorsTable } from "@/db/schema";
import { requireUser, toActor } from "@/lib/auth";
import { canUseSerials, canManageClinicSettings } from "@/lib/rbac";
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
  type SerialClientRow,
  type SmsPayload,
} from "@/lib/serial-client";
import { SerialCard } from "@/components/serials/serial-card";
import { SerialFilters } from "@/components/serials/filters";
import { buttonClass } from "@/components/ui/button";
import { EmptyState, StatCard } from "@/components/ui/card";
import { PlusIcon } from "@/components/ui/icons";
import { formatDateWithDay, toDigits } from "@/lib/utils";

export const metadata = { title: "Serials" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function SerialsPage({ searchParams }: PageProps) {
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
  const tab: "all" | "new" | "old" =
    tabRaw === "new" || tabRaw === "old" ? tabRaw : "all";
  const query = first(sp.q).trim();
  const reportSubmissionRaw = first(sp.reportSubmission);
  const reportSubmission: "" | "submitted" | "not_submitted" =
    reportSubmissionRaw === "submitted" || reportSubmissionRaw === "not_submitted"
      ? reportSubmissionRaw
      : "";

  const rows = await listSerials(db, toActor(user), {
    date,
    doctorId: doctorId || undefined,
    reportSubmission,
  });
  const counts = summarizeCounts(rows);

  const searchedRows = query
    ? rows.filter((row) => matchesPatientSearch(row, query))
    : rows;

  const queueRows = rows.filter((r) => {
    if (tab === "new") return r.patientType === "new" || r.isReference;
    if (tab === "old") return r.patientType === "old" || r.isReference;
    return true;
  });
  const searchedIds = new Set(searchedRows.map((row) => row.id));
  const visible = queueRows.filter((row) => searchedIds.has(row.id));
  const { activeReferences, activeSerials, completed, cancelled } =
    groupSerialRowsForDisplay(visible);

  // Doctor templates (for SMS payloads) — loaded once per doctor.
  const doctorIds = [...new Set(rows.map((r) => r.doctorId))];
  const templateRows = doctorIds.length
    ? await db
        .select({
          id: doctorsTable.id,
          smsTemplateNew: doctorsTable.smsTemplateNew,
          smsTemplateOld: doctorsTable.smsTemplateOld,
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
      serialLabel: row.isReference
        ? "Reference"
        : row.serialNumber != null
          ? toDigits(row.serialNumber)
          : "—",
      message,
      smsLink: buildSmsLink(mobile.dial || row.patientMobileDisplay, message),
    };
  }

  const canManageSettings = canManageClinicSettings(user);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Serial management</h1>
          <p className="mt-0.5 text-[13px] text-slate-500">
            {formatDateWithDay(date)}
            {doctorId
              ? ` · ${doctors.find((d) => d.id === doctorId)?.name ?? ""}`
              : ""}
          </p>
        </div>
        <Link
          href={`/serials/new?doctorId=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(date)}`}
          className={buttonClass("primary", "md")}
        >
          <PlusIcon size={18} />
          New serial
        </Link>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="New patient" value={toDigits(counts.activeNew)} accent="sky" />
        <StatCard label="Old patient" value={toDigits(counts.activeOld)} accent="violet" />
        <StatCard label="Reference" value={toDigits(counts.activeReference)} accent="emerald" />
        <StatCard label="Cancelled" value={toDigits(counts.cancelled)} accent="red" />
        <StatCard label="Completed" value={toDigits(counts.completed)} accent="brand" />
      </div>

      {/* Filters */}
      <SerialFilters
        key={`${date}:${doctorId}:${query}:${tab}:${reportSubmission}`}
        date={date}
        doctorId={doctorId}
        query={query}
        doctors={doctors}
        tab={tab}
        reportSubmission={reportSubmission}
        counts={counts}
      />

      {/* Reference entries — always at the top, without serial numbers */}
      {activeReferences.length > 0 && (
        <section aria-label="Reference">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-emerald-700">
            References ({toDigits(activeReferences.length)})
          </h2>
          <ul className="space-y-2">
            {activeReferences.map((row) => (
              <SerialCard
                key={row.id}
                row={toClientRow(row)}
                canEdit
                canChangeNumber={false}
                sms={smsFor(row)}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Regular serials */}
      {activeSerials.length > 0 && (
        <section aria-label="Serials">
          {activeReferences.length > 0 && (
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-slate-500">
              Serials ({toDigits(activeSerials.length)})
            </h2>
          )}
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

      {completed.length > 0 && (
        <section aria-label="Completed visits">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-emerald-700">
            Completed ({toDigits(completed.length)})
          </h2>
          <ul className="space-y-2">
            {completed.map((row) => (
              <SerialCard
                key={row.id}
                row={toClientRow(row)}
                canEdit
                canChangeNumber={false}
                sms={smsFor(row)}
              />
            ))}
          </ul>
        </section>
      )}

      {cancelled.length > 0 && (
        <section aria-label="Cancelled serials">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-red-600">
            Cancelled ({toDigits(cancelled.length)})
          </h2>
          <ul className="space-y-2">
            {cancelled.map((row) => (
              <SerialCard
                key={row.id}
                row={toClientRow(row)}
                canEdit
                canChangeNumber={false}
                sms={smsFor(row)}
              />
            ))}
          </ul>
        </section>
      )}

      {activeReferences.length === 0 &&
        activeSerials.length === 0 &&
        completed.length === 0 &&
        cancelled.length === 0 && (
          <EmptyState
            title={query ? "No patients found" : "No serials on this date"}
            description={
              query
                ? "Try another patient name or mobile number."
                : "Add a patient serial from the “New serial” button above."
            }
            action={
              <Link
                href={`/serials/new?doctorId=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(date)}`}
                className={buttonClass("primary", "md")}
              >
                <PlusIcon size={18} />
                New serial
              </Link>
            }
          />
        )}

      {canManageSettings && doctors.length === 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">
          No doctors added yet.{" "}
          <Link href="/clinic/doctors/new" className="font-medium underline">
            Add doctor
          </Link>
        </p>
      )}
    </div>
  );
}
