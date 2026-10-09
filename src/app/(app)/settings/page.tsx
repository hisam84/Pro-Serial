import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clinics } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  canManageClinicSettings,
  canManageSmsTemplates,
  isSuperAdmin,
} from "@/lib/rbac";
import { roleLabel } from "@/components/shell/nav";
import { Card, CardBody } from "@/components/ui/card";
import {
  ArrowRightIcon,
  BuildingIcon,
  LockIcon,
  MessageIcon,
  SettingsIcon,
  StethoscopeIcon,
  UserIcon,
} from "@/components/ui/settings-icons";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const db = await getDb();
  const user = await requireUser(db);

  let clinicName: string | null = null;
  if (user.clinicId) {
    const rows = await db
      .select({ name: clinics.name })
      .from(clinics)
      .where(eq(clinics.id, user.clinicId))
      .limit(1);
    clinicName = rows[0]?.name ?? null;
  }

  const links: {
    href: string;
    title: string;
    desc: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }[] = [
    {
      href: "/settings/password",
      title: "Change password",
      desc: "Change your account password",
      icon: LockIcon,
    },
  ];

  if (canManageSmsTemplates(user)) {
    links.push({
      href: "/settings/sms-templates",
      title: "SMS template",
      desc: "Edit doctor-specific SMS messages",
      icon: MessageIcon,
    });
  }
  if (canManageClinicSettings(user)) {
    links.push(
      {
        href: "/clinic/settings",
        title: "Clinic profile",
        desc: "Clinic name, address, timezone, etc.",
        icon: BuildingIcon,
      },
      {
        href: "/clinic/doctors",
        title: "Doctor management",
        desc: "Doctor profiles and attendant assignments",
        icon: StethoscopeIcon,
      },
      {
        href: "/clinic/users",
        title: "Staff management",
        desc: "Create and manage attendant accounts",
        icon: UserIcon,
      },
    );
  }
  if (isSuperAdmin(user)) {
    links.push({
      href: "/super-admin/clinics",
      title: "Clinic list",
      desc: "View and manage all clinic accounts",
      icon: SettingsIcon,
    });
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-[13px] text-slate-500">
          {user.name} · {roleLabel(user.role)}
          {clinicName ? ` · ${clinicName}` : ""}
        </p>
      </div>

      <Card>
        <CardBody className="divide-y divide-slate-100 p-0">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-slate-800">
                    {link.title}
                  </span>
                  <span className="block truncate text-[12px] text-slate-500">
                    {link.desc}
                  </span>
                </span>
                <ArrowRightIcon size={17} className="text-slate-300" />
              </Link>
            );
          })}
        </CardBody>
      </Card>
    </div>
  );
}
