import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { doctorAttendants, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { canManageDoctors } from "@/lib/rbac";
import { getDoctor, listDoctors } from "@/lib/doctors";
import { DoctorForm } from "@/components/admin/doctor-form";
import { LinkBack } from "@/components/ui/link-back";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { MessageIcon, ChartIcon } from "@/components/ui/icons";

export const metadata = { title: "Doctor details" };

interface PageProps {
  params: Promise<{ doctorId: string }>;
}

export default async function DoctorDetailPage({ params }: PageProps) {
  const { doctorId } = await params;
  const db = await getDb();
  const user = await requireUser(db);
  if (!canManageDoctors(user) || !user.clinicId) redirect("/unauthorized");

  const doctor = await getDoctor(db, user.clinicId, doctorId);
  if (!doctor) notFound();

  const assigned = await db
    .select({ id: users.id, name: users.name, username: users.username })
    .from(doctorAttendants)
    .innerJoin(users, eq(doctorAttendants.userId, users.id))
    .where(eq(doctorAttendants.doctorId, doctor.id));

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <LinkBack href="/clinic/doctors">Doctor list</LinkBack>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{doctor.name}</h1>
      </div>

      <div className="flex gap-2">
        <Link
          href={`/settings/sms-templates?doctorId=${doctor.id}`}
          className={buttonClass("outline", "md", "flex-1")}
        >
          <MessageIcon size={17} />
          SMS template
        </Link>
        <Link
          href={`/reports?report=datewise&doctorId=${doctor.id}`}
          className={buttonClass("outline", "md", "flex-1")}
        >
          <ChartIcon size={17} />
          Reports
        </Link>
      </div>

      <Card>
        <CardHeader title="Doctor information" />
        <CardBody>
          <DoctorForm doctor={{ ...doctor }} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Assigned attendants"
          subtitle="Edit from the Staff page to change assignments"
        />
        <CardBody>
          {assigned.length === 0 ? (
            <p className="text-[13px] text-slate-500">
              No attendants are assigned to this doctor.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {assigned.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                >
                  <span className="text-[14px] font-medium text-slate-800">
                    {a.name}
                  </span>
                  <span className="text-[12px] text-slate-500">{a.username}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/clinic/users"
            className={buttonClass("outline", "sm", "mt-3")}
          >
            Manage staff
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
