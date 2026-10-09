import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clinics } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { canManageClinicSettings } from "@/lib/rbac";
import { EditClinicForm } from "@/components/admin/clinic-forms";
import { LinkBack } from "@/components/ui/link-back";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export const metadata = { title: "Clinic Settings" };

export default async function ClinicSettingsPage() {
  const db = await getDb();
  const user = await requireUser(db);
  if (!canManageClinicSettings(user) || !user.clinicId) redirect("/unauthorized");

  const [clinic] = await db
    .select()
    .from(clinics)
    .where(eq(clinics.id, user.clinicId))
    .limit(1);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <LinkBack href="/settings">Settings</LinkBack>
        <h1 className="mt-1 text-xl font-bold text-slate-900">Clinic Settings</h1>
      </div>

      <Card>
        <CardHeader
          title="Clinic profile"
          subtitle="Only a super admin can change account status"
        />
        <CardBody>
          <EditClinicForm clinic={{ ...clinic }} isSuperAdmin={false} />
        </CardBody>
      </Card>
    </div>
  );
}
