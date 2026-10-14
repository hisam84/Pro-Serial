import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clinics } from "@/db/schema";
import { requireUser, toActor } from "@/lib/auth";
import { canUseSerials } from "@/lib/rbac";
import { listDoctorsForActor } from "@/lib/serials";
import { todayInTz } from "@/lib/dates";
import { NewSerialForm } from "@/components/serials/serial-form";
import { LinkBack } from "@/components/ui/link-back";

export const metadata = { title: "New serial" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function NewSerialPage({ searchParams }: PageProps) {
  const db = await getDb();
  const user = await requireUser(db);
  if (!canUseSerials(user) || !user.clinicId) redirect("/unauthorized");

  const sp = await searchParams;
  const [clinic] = await db
    .select({ timezone: clinics.timezone, requireAddress: clinics.requireAddress })
    .from(clinics)
    .where(eq(clinics.id, user.clinicId))
    .limit(1);

  const doctors = await listDoctorsForActor(db, toActor(user));
  const defaultDate = first(sp.date) || todayInTz(clinic?.timezone ?? "Asia/Dhaka");
  const requestedDoctor = first(sp.doctorId);
  const defaultDoctorId =
    requestedDoctor && doctors.some((d) => d.id === requestedDoctor)
      ? requestedDoctor
      : (doctors[0]?.id ?? "");

  const requestedPatientType = first(sp.patientType);
  const initialPatientType = (
    ["new", "old", "report", "report_new", "report_old"].includes(requestedPatientType)
      ? requestedPatientType
      : "new"
  ) as "new" | "old" | "report_new" | "report_old" | "report";
  const initialPatientName = first(sp.patientName);
  const initialPatientMobile = first(sp.patientMobile);
  const initialPatientAddress = first(sp.patientAddress);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <LinkBack href={`/serials?date=${encodeURIComponent(defaultDate)}&doctorId=${encodeURIComponent(defaultDoctorId)}`}>
          Serial list
        </LinkBack>
        <h1 className="mt-1 text-xl font-bold text-slate-900">New serial</h1>
        <p className="text-[13px] text-slate-500">
          Fill in the patient details to save the serial. After saving you can send
          an SMS.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50/80 px-4 py-2.5 text-[13px] text-amber-900">
        <div>
          <span className="font-semibold">Showing a lab/diagnostic test report?</span>
          <p className="text-[12px] text-amber-700">Add a report review serial for new or old patients on the dedicated page.</p>
        </div>
        <Link
          href={`/report-serials/new?doctorId=${encodeURIComponent(defaultDoctorId)}&date=${encodeURIComponent(defaultDate)}`}
          className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
        >
          Add report serial →
        </Link>
      </div>

      {doctors.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[14px] text-amber-800">
          No doctors are assigned to you. Contact your clinic admin.
        </p>
      ) : (
        <NewSerialForm
          doctors={doctors.map((d) => ({
            id: d.id,
            name: d.name,
            specialty: d.specialty,
          }))}
          defaultDoctorId={defaultDoctorId}
          defaultDate={defaultDate}
          requireAddress={clinic?.requireAddress ?? false}
          initialPatientType={initialPatientType}
          initialPatientName={initialPatientName}
          initialPatientMobile={initialPatientMobile}
          initialPatientAddress={initialPatientAddress}
        />
      )}
    </div>
  );
}
