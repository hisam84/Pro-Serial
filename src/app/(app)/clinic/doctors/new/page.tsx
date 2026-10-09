import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { canManageDoctors } from "@/lib/rbac";
import { DoctorForm } from "@/components/admin/doctor-form";
import { LinkBack } from "@/components/ui/link-back";
import { Card, CardBody } from "@/components/ui/card";

export const metadata = { title: "New doctor" };

export default async function NewDoctorPage() {
  const db = await getDb();
  const user = await requireUser(db);
  if (!canManageDoctors(user) || !user.clinicId) redirect("/unauthorized");

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <LinkBack href="/clinic/doctors">Doctor list</LinkBack>
        <h1 className="mt-1 text-xl font-bold text-slate-900">New doctor</h1>
      </div>
      <Card>
        <CardBody>
          <DoctorForm />
        </CardBody>
      </Card>
    </div>
  );
}
