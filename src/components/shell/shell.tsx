"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { roleLabel } from "./nav";
import { navItemsForRole } from "./nav-items";
import { ChevronDownIcon, LogoutIcon, SettingsIcon } from "@/components/ui/icons";
import { logoutAction } from "@/app/actions/auth";

export function SideNav({ role }: { role: string }) {
  const pathname = usePathname();
  const items = navItemsForRole(role);
  return (
    <nav className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">
      <div className="sticky top-0 flex h-dvh flex-col gap-1 p-4">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/serials" && pathname.startsWith(item.href + "/"));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-800"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <Icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function BottomNav({ role }: { role: string }) {
  const pathname = usePathname();
  const bottom = navItemsForRole(role)
    .filter((i) => i.bottom)
    .slice(0, 4);
  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch">
        {bottom.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium",
                  active ? "text-brand-700" : "text-slate-500",
                )}
              >
                <Icon size={21} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TopBar({
  userName,
  clinicName,
  role,
}: {
  userName: string;
  clinicName: string | null;
  role: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    await logoutAction();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-700 text-sm font-bold text-white">
            S
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold leading-tight text-slate-900">
              Serial Pro
            </span>
            {clinicName && (
              <span className="block truncate text-[11px] leading-tight text-slate-500">
                {clinicName}
              </span>
            )}
          </span>
        </Link>

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">
              {userName.trim().charAt(0) || "?"}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block max-w-[140px] truncate text-[13px] font-medium leading-tight text-slate-800">
                {userName}
              </span>
              <span className="block text-[11px] leading-tight text-slate-500">
                {roleLabel(role)}
              </span>
            </span>
            <ChevronDownIcon size={16} className="text-slate-400" />
          </button>

          {open && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setOpen(false)}
                aria-hidden
              />
              <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="border-b border-slate-100 px-4 py-2.5">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {userName}
                  </p>
                  <p className="text-xs text-slate-500">{roleLabel(role)}</p>
                </div>
                <Link
                  href="/settings/password"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <SettingsIcon size={17} />
                  Change password
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  <LogoutIcon size={17} />
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
