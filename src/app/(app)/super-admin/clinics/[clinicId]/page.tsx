import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireSuperAdmin } from "@/lib/auth";
import {
  clinicOperationalStats,
  getClinicAdmin,
  getClinicById,
} from "@/lib/clinics";
import { todayInTz } from "@/lib/dates";
import {
  ClinicStatusControl,
  EditClinicForm,
  ResetClinicAdminPassword,
} from "@/components/admin/clinic-forms";
import { LinkBack } from "@/components/ui/link-back";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  StatCard,
} from "@/components/ui/card";
import { toDigits } from "@/lib/utils";

export const metadata = { title: "Clinic details" };

interface PageProps {
  params: Promise<{ clinicId: string }>;
}

export default async function ClinicDetailPage({ params }: PageProps) {
  const { clinicId } = await params;
  const db = await getDb();
  await requireSuperAdmin(db);

  const clinic = await getClinicById(db, clinicId);
  if (!clinic) notFound();

  const admin = await getClinicAdmin(db, clinicId);
  const today = todayInTz(clinic.timezone);
  const stats = await clinicOperationalStats(db, clinicId, today);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <LinkBack href="/super-admin/clinics">Clinic list</LinkBack>
        <div className="mt-1 flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-bold text-slate-900">{clinic.name}</h1>
          <Badge
            variant={
              clinic.status === "active"
                ? "active"
                : clinic.status === "suspended"
                  ? "cancelled"
                  : "neutral"
            }
          >
            {clinic.status === "active"
              ? "Active"
              : clinic.status === "suspended"
                ? "Suspended"
                : "Deactivated"}
          </Badge>
        </div>
        {admin && (
          <p className="text-[13px] text-slate-500">
            Admin: {admin.name} ({admin.username})
          </p>
        )}
      </div>

      {/* Operational status — counts only, no patient data */}
      <Card>
        <CardHeader
          title="Operational status"
          subtitle="Patient personal data is never shown here"
        />
        <CardBody>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatCard
              label="Doctor"
              value={`${toDigits(stats.activeDoctorCount)}/${toDigits(stats.doctorCount)}`}
              accent="brand"
              hint="Active/total"
            />
            <StatCard
              label="Staff"
              value={toDigits(stats.attendantCount)}
              accent="sky"
            />
            <StatCard
              label="Active serials today"
              value={toDigits(stats.activeSerialsToday)}
              accent="violet"
            />
            <StatCard
              label="Total appointments"
              value={toDigits(stats.totalAppointments)}
              accent="slate"
            />
          </div>
        </CardBody>
      </Card>

      {/* Edit details */}
      <Card>
        <CardHeader title="Clinic information" />
        <CardBody>
          <EditClinicForm clinic={{ ...clinic }} isSuperAdmin />
        </CardBody>
      </Card>

      {/* Account status */}
      <Card>
        <CardHeader title="Account status" subtitle="Controls who can sign in" />
        <CardBody>
          <ClinicStatusControl clinicId={clinic.id} status={clinic.status} />
        </CardBody>
      </Card>

      {/* Password reset */}
      <Card>
        <CardHeader
          title="Admin password"
          subtitle="A temporary password will be generated; hand it to the admin securely"
        />
        <CardBody>
          <ResetClinicAdminPassword clinicId={clinic.id} />
        </CardBody>
      </Card>
    </div>
  );
}
