import Link from "next/link";
import { redirect } from "next/navigation";
import { count, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { clinics, users } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/auth";
import { listClinics } from "@/lib/clinics";
import { buttonClass } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { PlusIcon } from "@/components/ui/icons";
import { toDigits } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const STATUS_BADGE: Record<string, "active" | "cancelled" | "neutral"> = {
  active: "active",
  suspended: "cancelled",
  deactivated: "neutral",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  suspended: "Suspended",
  deactivated: "Deactivated",
};

export default async function SuperAdminDashboard() {
  const db = await getDb();
  await requireSuperAdmin(db);

  const [statusCounts] = await db
    .select({
      total: count(),
      active: sql<number>`count(*) FILTER (WHERE ${clinics.status} = 'active')`,
    })
    .from(clinics);

  const [{ total: clinicTotal }] = await db.select({ total: count() }).from(clinics);
  const [{ total: userTotal }] = await db.select({ total: count() }).from(users);

  const recent = (await listClinics(db)).slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Super Admin Dashboard</h1>
          <p className="text-[13px] text-slate-500">
            Platform overview (no patient personal data is shown)
          </p>
        </div>
        <Link href="/super-admin/clinics/new" className={buttonClass("primary", "md")}>
          <PlusIcon size={18} />
          New clinic
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <StatCard
          label="Total clinics"
          value={toDigits(clinicTotal ?? statusCounts?.total ?? 0)}
          accent="brand"
        />
        <StatCard
          label="Active clinics"
          value={toDigits(statusCounts?.active ?? 0)}
          accent="sky"
        />
        <StatCard
          label="Total users"
          value={toDigits(userTotal ?? 0)}
          accent="violet"
        />
      </div>

      <Card>
        <CardHeader
          title="Recent clinics"
          action={
            <Link
              href="/super-admin/clinics"
              className="text-[13px] font-medium text-brand-700 hover:underline"
            >
              View all
            </Link>
          }
        />
        <CardBody className="p-0">
          {recent.length === 0 ? (
            <p className="px-5 py-6 text-center text-[14px] text-slate-500">
              No clinics created yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/super-admin/clinics/${c.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium text-slate-800">
                        {c.name}
                      </p>
                      <p className="text-[12px] text-slate-500">
                        Doctors {toDigits(c.doctorCount)} · Staff{" "}
                        {toDigits(c.attendantCount)}
                        {c.adminUsername ? ` · ${c.adminUsername}` : ""}
                      </p>
                    </div>
                    <Badge variant={STATUS_BADGE[c.status] ?? "neutral"}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
