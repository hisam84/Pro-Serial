import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { canManageStaff } from "@/lib/rbac";
import { listAttendants } from "@/lib/staff";
import { buttonClass } from "@/components/ui/button";
import { Badge, Card, CardBody, EmptyState } from "@/components/ui/card";
import { PlusIcon, UserIcon } from "@/components/ui/icons";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const db = await getDb();
  const user = await requireUser(db);
  if (!canManageStaff(user) || !user.clinicId) redirect("/unauthorized");

  const attendants = await listAttendants(db, user.clinicId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Staff (Attendants)</h1>
          <p className="text-[13px] text-slate-500">
            Staff accounts and doctor assignments for serial management
          </p>
        </div>
        <Link href="/clinic/users/new" className={buttonClass("primary", "md")}>
          <PlusIcon size={18} />
          New staff
        </Link>
      </div>

      {attendants.length === 0 ? (
        <Card>
          <EmptyState
            title="No staff accounts"
            description="Create an attendant and assign doctors."
            action={
              <Link href="/clinic/users/new" className={buttonClass("primary", "md")}>
                <PlusIcon size={18} />
                New staff
              </Link>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {attendants.map((a) => (
            <li key={a.id}>
              <Link href={`/clinic/users/${a.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardBody className="flex items-start gap-3 py-3.5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                      <UserIcon size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[15px] font-semibold text-slate-900">
                          {a.name}
                        </p>
                        <Badge variant={a.status === "active" ? "active" : "cancelled"}>
                          {a.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                        {a.mustChangePassword && (
                          <Badge variant="pending">Password change pending</Badge>
                        )}
                      </div>
                      <p className="text-[12px] text-slate-500">{a.username}</p>
                      {a.phone && (
                        <p className="text-[12px] text-slate-500">{a.phone}</p>
                      )}
                      <p className="mt-0.5 text-[12px] text-slate-500">
                        Doctors:{" "}
                        {a.doctorNames.length > 0
                          ? a.doctorNames.join(", ")
                          : "No one assigned"}
                      </p>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
