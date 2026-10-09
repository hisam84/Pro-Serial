import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { canManageStaff } from "@/lib/rbac";
import { listDoctors } from "@/lib/doctors";
import { CreateAttendantForm } from "@/components/admin/staff-forms";
import { LinkBack } from "@/components/ui/link-back";
import { Card, CardBody } from "@/components/ui/card";

export const metadata = { title: "New staff" };

export default async function NewStaffPage() {
  const db = await getDb();
  const user = await requireUser(db);
  if (!canManageStaff(user) || !user.clinicId) redirect("/unauthorized");

  const doctors = await listDoctors(db, user.clinicId, { includeInactive: true });

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <LinkBack href="/clinic/users">Staff list</LinkBack>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          New attendant
        </h1>
      </div>
      <Card>
        <CardBody>
          <CreateAttendantForm
            doctors={doctors.map((d) => ({ id: d.id, name: d.name }))}
          />
        </CardBody>
      </Card>
    </div>
  );
}
