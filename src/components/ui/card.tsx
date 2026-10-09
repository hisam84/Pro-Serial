import { cn } from "@/lib/utils";
import {
  AlertIcon,
  CheckIcon,
  InfoIcon,
} from "./icons";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("p-4 sm:p-5", className)}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5",
        className,
      )}
    >
      <div>
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ── Badge ─────────────────────────────────────────────────────────── */

const BADGE_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  new: "bg-sky-50 text-sky-700 border-sky-200",
  old: "bg-violet-50 text-violet-700 border-violet-200",
  reference: "bg-rose-50 text-rose-700 border-rose-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  neutral: "bg-slate-50 text-slate-600 border-slate-200",
  brand: "bg-brand-50 text-brand-700 border-brand-200",
};

export function Badge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: keyof typeof BADGE_STYLES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        BADGE_STYLES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ── Banner (success / error feedback) ─────────────────────────────── */

export function Banner({
  type = "error",
  title,
  children,
  className,
}: {
  type?: "error" | "success" | "info";
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-sky-200 bg-sky-50 text-sky-800",
  }[type];
  const Icon = type === "success" ? CheckIcon : type === "info" ? InfoIcon : AlertIcon;
  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[14px]",
        styles,
        className,
      )}
    >
      <Icon size={18} className="mt-0.5" />
      <div>
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
    </div>
  );
}

/* ── Empty state ───────────────────────────────────────────────────── */

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <InfoIcon size={22} />
      </div>
      <p className="text-[15px] font-medium text-slate-700">{title}</p>
      {description && (
        <p className="max-w-sm text-[13px] text-slate-500">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ── Stat card ─────────────────────────────────────────────────────── */

export function StatCard({
  label,
  value,
  accent = "brand",
  hint,
}: {
  label: string;
  value: React.ReactNode;
  accent?: "brand" | "sky" | "violet" | "amber" | "rose" | "red" | "slate";
  hint?: string;
}) {
  const accents = {
    brand: "border-l-brand-600",
    sky: "border-l-sky-500",
    violet: "border-l-violet-500",
    amber: "border-l-amber-500",
    rose: "border-l-rose-400",
    red: "border-l-red-500",
    slate: "border-l-slate-400",
  }[accent];
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 border-l-4 bg-white px-4 py-3 shadow-sm",
        accents,
      )}
    >
      <p className="text-[12px] font-medium tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
