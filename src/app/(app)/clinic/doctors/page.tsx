import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { canManageDoctors } from "@/lib/rbac";
import { listDoctors } from "@/lib/doctors";
import { buttonClass } from "@/components/ui/button";
import { Badge, Card, CardBody, EmptyState } from "@/components/ui/card";
import { PlusIcon, StethoscopeIcon } from "@/components/ui/icons";

export const metadata = { title: "Doctors" };

export default async function DoctorsPage() {
  const db = await getDb();
  const user = await requireUser(db);
  if (!canManageDoctors(user) || !user.clinicId) redirect("/unauthorized");

  const doctors = await listDoctors(db, user.clinicId, { includeInactive: true });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Doctor</h1>
          <p className="text-[13px] text-slate-500">
            Manage doctor profiles and SMS templates
          </p>
        </div>
        <Link href="/clinic/doctors/new" className={buttonClass("primary", "md")}>
          <PlusIcon size={18} />
          New doctor
        </Link>
      </div>

      {doctors.length === 0 ? (
        <Card>
          <EmptyState
            title="No doctors yet"
            description="Add your first doctor to start taking serials."
            action={
              <Link href="/clinic/doctors/new" className={buttonClass("primary", "md")}>
                <PlusIcon size={18} />
                New doctor
              </Link>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {doctors.map((d) => (
            <li key={d.id}>
              <Link href={`/clinic/doctors/${d.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardBody className="flex items-start gap-3 py-3.5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                      <StethoscopeIcon size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[15px] font-semibold text-slate-900">
                          {d.name}
                        </p>
                        <Badge variant={d.status === "active" ? "active" : "neutral"}>
                          {d.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                        {d.smsTemplate && <Badge variant="brand">SMS</Badge>}
                      </div>
                      <p className="text-[12px] text-slate-500">
                        {d.specialty || "No specialty"}
                        {d.phone ? ` · ${d.phone}` : ""}
                      </p>
                      <p className="mt-0.5 text-[12px] text-slate-500">
                        Attendants:{" "}
                        {d.attendantNames.length > 0
                          ? d.attendantNames.join(", ")
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
