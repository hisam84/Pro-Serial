import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clinics } from "@/db/schema";
import { requireUser, toActor } from "@/lib/auth";
import { canViewReports } from "@/lib/rbac";
import {
  cancellationReport,
  dailySummary,
  datewiseReport,
  doctorWiseReport,
  patientTypeReport,
} from "@/lib/reports";
import { listSerialsByIds, type SerialRow } from "@/lib/serials";
import { listDoctorsForActor } from "@/lib/serials";
import { todayInTz } from "@/lib/dates";
import { ReportFilters } from "@/components/reports/report-filters";
import {
  DoctorSummaryTable,
  ReportHeader,
  ReportTable,
  SummaryGrid,
} from "@/components/reports/report-table";
import { Card, CardBody, EmptyState } from "@/components/ui/card";
import { formatDate, formatDateWithDay } from "@/lib/utils";

export const metadata = { title: "Reports" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

const REPORT_TITLES: Record<string, string> = {
  datewise: "Date-wise serial list",
  new: "New-patient report",
  old: "Old-patient report",
  doctor: "Doctor-wise report",
  cancellation: "Cancellation report",
  summary: "Daily summary",
};

export default async function ReportsPage({ searchParams }: PageProps) {
  const db = await getDb();
  const user = await requireUser(db);
  if (!canViewReports(user) || !user.clinicId) redirect("/unauthorized");

  const sp = await searchParams;
  const reportKey = first(sp.report) || "datewise";
  const report = REPORT_TITLES[reportKey] ? reportKey : "datewise";

  const [clinic] = await db
    .select({ timezone: clinics.timezone, name: clinics.name })
    .from(clinics)
    .where(eq(clinics.id, user.clinicId))
    .limit(1);
  const today = todayInTz(clinic?.timezone ?? "Asia/Dhaka");

  const date = first(sp.date) || today;
  const from = first(sp.from) || date;
  const to = first(sp.to) || (report === "cancellation" || report === "summary" ? from : date);
  const doctorId = first(sp.doctorId);
  const patientType = first(sp.patientType) as "" | "new" | "old";
  const status = first(sp.status) as "" | "active" | "cancelled";

  const doctors = await listDoctorsForActor(db, toActor(user));
  const filters = {
    date: report === "cancellation" || report === "summary" ? undefined : date,
    from: report === "cancellation" || report === "summary" ? from : undefined,
    to: report === "cancellation" || report === "summary" ? to : undefined,
    doctorId: doctorId || undefined,
    patientType,
    status,
  };

  let rows: SerialRow[] = [];
  let summary: Awaited<ReturnType<typeof dailySummary>> | null = null;
  let doctorSummary: Awaited<ReturnType<typeof doctorWiseReport>> | null = null;

  switch (report) {
    case "new":
      rows = await patientTypeReport(db, toActor(user), "new", filters);
      break;
    case "old":
      rows = await patientTypeReport(db, toActor(user), "old", filters);
      break;
    case "cancellation":
      rows = await cancellationReport(db, toActor(user), filters);
      break;
    case "summary":
      summary = await dailySummary(db, toActor(user), filters);
      break;
    case "doctor":
      doctorSummary = await doctorWiseReport(db, toActor(user), filters);
      rows = doctorSummary.rows;
      break;
    default:
      rows = await datewiseReport(db, toActor(user), filters);
  }

  const doctorName = doctorId
    ? (doctors.find((d) => d.id === doctorId)?.name ?? "")
    : "All doctors";
  const dateContext =
    report === "cancellation" || report === "summary"
      ? `${formatDate(from)} — ${formatDate(to)}`
      : formatDateWithDay(date);

  return (
    <div className="space-y-4">
      <div className="no-print">
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        <p className="text-[13px] text-slate-500">
          View reports by date, doctor, and other filters
        </p>
      </div>

      <Card className="no-print">
        <CardBody>
          <ReportFilters
            report={report}
            date={date}
            from={from}
            to={to}
            doctorId={doctorId}
            doctors={doctors.map((d) => ({
              id: d.id,
              name: d.name,
              specialty: d.specialty,
            }))}
            patientType={patientType}
            status={status}
          />
        </CardBody>
      </Card>

      <div className="print-only">
        <p className="text-sm font-semibold">{clinic?.name ?? ""}</p>
      </div>

      {/* Report body */}
      <section className="space-y-3">
        <ReportHeader
          title={REPORT_TITLES[report]}
          context={[dateContext, doctorName, clinic?.name ?? ""]}
        />

        {report === "summary" && summary && (
          <>
            <SummaryGrid summary={summary} />
            {summary.totalEntries === 0 && (
              <Card>
                <EmptyState
                  title="No entries for this period"
                  description="Try changing the filters."
                />
              </Card>
            )}
          </>
        )}

        {report === "doctor" && doctorSummary && (
          <>
            {doctorSummary.doctors.length === 0 ? (
              <Card>
                <EmptyState
                  title="No data"
                  description="No serials match the selected filters."
                />
              </Card>
            ) : (
              <DoctorSummaryTable doctors={doctorSummary.doctors} />
            )}
            {rows.length > 0 && (
              <div className="pt-2">
                <p className="mb-2 text-[13px] font-semibold text-slate-600">
                  Detailed list
                </p>
                <ReportTable rows={rows} showDoctor />
              </div>
            )}
          </>
        )}

        {report !== "summary" && report !== "doctor" && (
          rows.length === 0 ? (
            <Card>
              <EmptyState
                title="Nothing found"
                description="Try a different date or doctor."
              />
            </Card>
          ) : (
            <>
              <p className="text-[12px] text-slate-500">
                {rows.length} entries total
              </p>
              <ReportTable rows={rows} showDoctor />
            </>
          )
        )}
      </section>
    </div>
  );
}
