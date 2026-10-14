import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clinics } from "@/db/schema";
import { requireUser, toActor } from "@/lib/auth";
import { canUseSerials } from "@/lib/rbac";
import { listDoctorsForActor } from "@/lib/serials";
import { todayInTz } from "@/lib/dates";
import { NewReportSerialForm } from "@/components/serials/report-serial-form";
import { LinkBack } from "@/components/ui/link-back";

export const metadata = { title: "New report serial" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function NewReportSerialPage({ searchParams }: PageProps) {
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
  const initialPatientType = requestedPatientType === "report_old" ? "report_old" : "report_new";
  const initialPatientName = first(sp.patientName);
  const initialPatientMobile = first(sp.patientMobile);
  const initialPatientAddress = first(sp.patientAddress);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <LinkBack href={`/report-serials?date=${encodeURIComponent(defaultDate)}&doctorId=${encodeURIComponent(defaultDoctorId)}`}>
          Report serial list
        </LinkBack>
        <h1 className="mt-1 text-xl font-bold text-slate-900">New report serial</h1>
        <p className="text-[13px] text-slate-500">
          Create a serial for patients showing medical/test reports to the doctor.
        </p>
      </div>

      {doctors.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[14px] text-amber-800">
          No doctors are assigned to you. Contact your clinic admin.
        </p>
      ) : (
        <NewReportSerialForm
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
