import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { canManageStaff } from "@/lib/rbac";
import { listDoctors } from "@/lib/doctors";
import { getAttendant, listAttendants } from "@/lib/staff";
import {
  EditAttendantForm,
  ResetAttendantPassword,
} from "@/components/admin/staff-forms";
import { LinkBack } from "@/components/ui/link-back";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export const metadata = { title: "Staff details" };

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function StaffDetailPage({ params }: PageProps) {
  const { userId } = await params;
  const db = await getDb();
  const user = await requireUser(db);
  if (!canManageStaff(user) || !user.clinicId) redirect("/unauthorized");

  const attendant = await getAttendant(db, user.clinicId, userId);
  if (!attendant) notFound();

  const [details] = await listAttendants(db, user.clinicId).then((list) =>
    list.filter((a) => a.id === userId),
  );
  const doctors = await listDoctors(db, user.clinicId, { includeInactive: true });

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <LinkBack href="/clinic/users">Staff list</LinkBack>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{attendant.name}</h1>
        <p className="text-[13px] text-slate-500">{attendant.username}</p>
      </div>

      <Card>
        <CardHeader title="Details and doctor assignments" />
        <CardBody>
          <EditAttendantForm
            attendant={{
              id: attendant.id,
              name: attendant.name,
              username: attendant.username,
              status: attendant.status,
              doctorIds: details?.doctorIds ?? [],
            }}
            doctors={doctors.map((d) => ({ id: d.id, name: d.name }))}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Reset password"
          subtitle="A temporary password will be generated — shown only once"
        />
        <CardBody>
          <ResetAttendantPassword userId={attendant.id} />
        </CardBody>
      </Card>
    </div>
  );
}
