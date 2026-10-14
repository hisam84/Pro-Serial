"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { cn, toDigits } from "@/lib/utils";
import { CalendarIcon, SearchIcon, StethoscopeIcon } from "@/components/ui/icons";
import type { DoctorOption } from "./serial-form";

export type ReportTab = "all" | "report_new" | "report_old";

interface ReportQueueFiltersProps {
  date: string;
  doctorId: string;
  query: string;
  doctors: DoctorOption[];
  tab: ReportTab;
  reportSubmission: "" | "submitted" | "not_submitted";
  counts: {
    activeReportNew: number;
    activeReportOld: number;
    activeReport: number;
  };
}

export function ReportQueueFilters({
  date,
  doctorId,
  query,
  doctors,
  tab,
  reportSubmission,
  counts,
}: ReportQueueFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [searchVal, setSearchVal] = useState(query);

  const pushParams = useCallback(
    (patch: Record<string, string | null>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(patch)) {
        if (val === null || val === "") p.delete(key);
        else p.set(key, val);
      }
      startTransition(() => {
        router.replace(`/report-serials?${p.toString()}`);
      });
    },
    [router, searchParams],
  );

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    pushParams({ q: searchVal.trim() || null });
  }

  return (
    <div className={cn("space-y-3", pending && "opacity-70 transition-opacity")}>
      {/* Doctor & Date */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <label className="relative block">
          <span className="sr-only">Doctor</span>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <StethoscopeIcon size={18} />
          </div>
          <select
            value={doctorId}
            onChange={(e) => pushParams({ doctorId: e.target.value })}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-8 text-[14px] font-medium text-slate-800 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20"
          >
            {doctors.length === 0 && <option value="">No doctors</option>}
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.specialty ? ` · ${d.specialty}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="relative block">
          <span className="sr-only">Date</span>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <CalendarIcon size={18} />
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => pushParams({ date: e.target.value })}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-[14px] font-medium text-slate-800 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20"
          />
        </label>
      </div>

      {/* Search & Lab submission status */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <SearchIcon size={18} />
          </div>
          <input
            type="search"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Search report patient by name or mobile…"
            className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-14 text-[14px] outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20"
          />
          {searchVal && (
            <button
              type="button"
              onClick={() => {
                setSearchVal("");
                pushParams({ q: null });
              }}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-[12px] font-medium text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </form>

        <select
          value={reportSubmission}
          onChange={(e) => pushParams({ reportSubmission: e.target.value || null })}
          aria-label="Filter by lab report submission"
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20"
        >
          <option value="">All report statuses</option>
          <option value="not_submitted">Report not submitted</option>
          <option value="submitted">Report submitted</option>
        </select>
      </div>

      {/* Tabs: All reports, Report (New), Report (Old) */}
      <div
        role="tablist"
        aria-label="Report patient categories"
        className="grid grid-cols-3 gap-1 rounded-xl border border-amber-200 bg-amber-50/60 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "all"}
          onClick={() => pushParams({ tab: null })}
          className={cn(
            "min-h-10 rounded-lg px-2 text-[13px] font-medium transition-colors",
            tab === "all"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900",
          )}
        >
          All reports ({toDigits(counts.activeReport)})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === "report_new"}
          onClick={() => pushParams({ tab: "report_new" })}
          className={cn(
            "min-h-10 rounded-lg px-2 text-[13px] font-medium transition-colors",
            tab === "report_new"
              ? "bg-white text-amber-800 shadow-sm"
              : "text-amber-800/80 hover:text-amber-900",
          )}
        >
          Report · New ({toDigits(counts.activeReportNew)})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === "report_old"}
          onClick={() => pushParams({ tab: "report_old" })}
          className={cn(
            "min-h-10 rounded-lg px-2 text-[13px] font-medium transition-colors",
            tab === "report_old"
              ? "bg-white text-orange-800 shadow-sm"
              : "text-orange-800/80 hover:text-orange-900",
          )}
        >
          Report · Old ({toDigits(counts.activeReportOld)})
        </button>
      </div>
    </div>
  );
}
