"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ListIcon, ReportSerialIcon } from "@/components/ui/icons";

export function SerialModeToggle({
  mode,
  date,
  doctorId,
  regularCount,
  reportCount,
}: {
  mode: "regular" | "report";
  date: string;
  doctorId: string;
  regularCount?: number;
  reportCount?: number;
}) {
  const query = new URLSearchParams();
  if (date) query.set("date", date);
  if (doctorId) query.set("doctorId", doctorId);
  const qStr = query.toString() ? `?${query.toString()}` : "";

  return (
    <div
      role="tablist"
      aria-label="Serial mode"
      className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1"
    >
      <Link
        href={`/serials${qStr}`}
        role="tab"
        aria-selected={mode === "regular"}
        className={cn(
          "flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-[13px] font-semibold transition-all",
          mode === "regular"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50",
        )}
      >
        <ListIcon size={16} className={mode === "regular" ? "text-brand-600" : "text-slate-400"} />
        <span>Regular visits</span>
        {regularCount != null && regularCount > 0 && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.2 text-[11px] font-bold",
              mode === "regular" ? "bg-slate-100 text-slate-700" : "bg-slate-200 text-slate-600",
            )}
          >
            {regularCount}
          </span>
        )}
      </Link>

      <Link
        href={`/report-serials${qStr}`}
        role="tab"
        aria-selected={mode === "report"}
        className={cn(
          "flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-[13px] font-semibold transition-all",
          mode === "report"
            ? "bg-amber-500 text-white shadow-sm"
            : "text-amber-800 hover:text-amber-900 hover:bg-amber-100/60",
        )}
      >
        <ReportSerialIcon size={16} className={mode === "report" ? "text-white" : "text-amber-700"} />
        <span>Report serials</span>
        {reportCount != null && reportCount > 0 && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.2 text-[11px] font-bold",
              mode === "report" ? "bg-amber-600 text-white" : "bg-amber-200 text-amber-900",
            )}
          >
            {reportCount}
          </span>
        )}
      </Link>
    </div>
  );
}
