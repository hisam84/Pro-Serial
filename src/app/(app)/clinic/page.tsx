import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clinics, doctors as doctorsTable } from "@/db/schema";
import { requireUser, toActor } from "@/lib/auth";
import { canManageClinicSettings } from "@/lib/rbac";
import { clinicOperationalStats } from "@/lib/clinics";
import { listSerials, summarizeCounts } from "@/lib/serials";
import { todayInTz } from "@/lib/dates";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import {
  ArrowRightIcon,
  MessageIcon,
  PlusIcon,
  SettingsIcon,
  StethoscopeIcon,
  UserIcon,
} from "@/components/ui/settings-icons";
import { formatDateWithDay, toDigits } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function ClinicDashboard() {
  const db = await getDb();
  const user = await requireUser(db);
  if (user.role !== "clinic_admin" || !user.clinicId) redirect("/unauthorized");

  const [clinic] = await db
    .select({ name: clinics.name, timezone: clinics.timezone })
    .from(clinics)
    .where(eq(clinics.id, user.clinicId))
    .limit(1);
  const today = todayInTz(clinic?.timezone ?? "Asia/Dhaka");

  const stats = await clinicOperationalStats(db, user.clinicId, today);
  const todayRows = await listSerials(db, toActor(user), { date: today });
  const counts = summarizeCounts(todayRows);

  const doctors = await db
    .select({
      id: doctorsTable.id,
      name: doctorsTable.name,
      specialty: doctorsTable.specialty,
      status: doctorsTable.status,
    })
    .from(doctorsTable)
    .where(and(eq(doctorsTable.clinicId, user.clinicId)))
    .limit(6);

  const quickLinks = [
    {
      href: "/clinic/doctors",
      title: "Doctors",
      desc: `${toDigits(stats.activeDoctorCount)} active`,
      icon: StethoscopeIcon,
    },
    {
      href: "/clinic/users",
      title: "Staff",
      desc: `${toDigits(stats.attendantCount)} attendants`,
      icon: UserIcon,
    },
    {
      href: "/settings/sms-templates",
      title: "SMS template",
      desc: "Per-doctor messages",
      icon: MessageIcon,
    },
    {
      href: "/clinic/settings",
      title: "Clinic Settings",
      desc: "Profile and timezone",
      icon: SettingsIcon,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {clinic?.name ?? "Clinic"} — Dashboard
          </h1>
          <p className="text-[13px] text-slate-500">{formatDateWithDay(today)}</p>
        </div>
        <Link
          href={`/serials/new?date=${encodeURIComponent(today)}`}
          className={buttonClass("primary", "md")}
        >
          <PlusIcon size={18} />
          New serial
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="New today" value={toDigits(counts.activeNew)} accent="sky" />
        <StatCard label="Old today" value={toDigits(counts.activeOld)} accent="violet" />
        <StatCard label="Reference" value={toDigits(counts.activeReference)} accent="rose" />
        <StatCard label="Cancelled" value={toDigits(counts.cancelled)} accent="red" />
        <StatCard label="Completed" value={toDigits(counts.completed)} accent="brand" />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <Card className="transition-shadow hover:shadow-md">
                <CardBody className="flex items-center gap-3 py-3.5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <Icon size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-slate-800">
                      {link.title}
                    </span>
                    <span className="block text-[12px] text-slate-500">
                      {link.desc}
                    </span>
                  </span>
                  <ArrowRightIcon size={17} className="text-slate-300" />
                </CardBody>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader
          title="Doctors"
          action={
            <Link
              href="/clinic/doctors"
              className="text-[13px] font-medium text-brand-700 hover:underline"
            >
              View all
            </Link>
          }
        />
        <CardBody className="p-0">
          {doctors.length === 0 ? (
            <p className="px-5 py-6 text-center text-[14px] text-slate-500">
              No doctors added yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {doctors.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/clinic/doctors/${d.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50"
                  >
                    <span>
                      <span className="block text-[14px] font-medium text-slate-800">
                        {d.name}
                      </span>
                      <span className="block text-[12px] text-slate-500">
                        {d.specialty || "—"}
                      </span>
                    </span>
                    <span
                      className={
                        d.status === "active"
                          ? "text-xs font-medium text-emerald-600"
                          : "text-xs font-medium text-slate-400"
                      }
                    >
                      {d.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {canManageClinicSettings(user) && (
        <p className="text-[12px] text-slate-400">
          Active serials today {toDigits(stats.activeSerialsToday)} ·
          Total appointments {toDigits(stats.totalAppointments)}
        </p>
      )}
    </div>
  );
}
