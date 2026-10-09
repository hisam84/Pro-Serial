"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { cn } from "@/lib/utils";
import { PrintIcon, FilterIcon } from "@/components/ui/icons";
import type { DoctorOption } from "@/components/serials/serial-form";

const REPORT_TYPES = [
  ["datewise", "Date-wise serial list"],
  ["new", "New-patient report"],
  ["old", "Old-patient report"],
  ["doctor", "Doctor-wise report"],
  ["cancellation", "Cancellation report"],
  ["summary", "Daily summary"],
] as const;

export function ReportFilters({
  report,
  date,
  from,
  to,
  doctorId,
  doctors,
  patientType,
  status,
}: {
  report: string;
  date: string;
  from: string;
  to: string;
  doctorId: string;
  doctors: DoctorOption[];
  patientType: string;
  status: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      startTransition(() => {
        router.replace(`/reports?${params.toString()}`);
      });
    },
    [router, searchParams],
  );

  return (
    <div className={cn("space-y-3", pending && "opacity-70")}>
      <div>
        <label
          htmlFor="report-type"
          className="mb-1 block text-[13px] font-medium text-slate-700"
        >
          Report type
        </label>
        <select
          id="report-type"
          value={report}
          onChange={(e) => update({ report: e.target.value })}
          className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[15px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25"
        >
          {REPORT_TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-[12px] text-slate-500">Date (single)</span>
          <input
            type="date"
            value={date}
            onChange={(e) => update({ date: e.target.value })}
            className="h-11 w-full rounded-lg border border-slate-300 px-2.5 text-[14px] outline-none focus:border-brand-600"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] text-slate-500">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => update({ from: e.target.value })}
            className="h-11 w-full rounded-lg border border-slate-300 px-2.5 text-[14px] outline-none focus:border-brand-600"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] text-slate-500">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => update({ to: e.target.value })}
            className="h-11 w-full rounded-lg border border-slate-300 px-2.5 text-[14px] outline-none focus:border-brand-600"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] text-slate-500">Doctor</span>
          <select
            value={doctorId}
            onChange={(e) => update({ doctorId: e.target.value })}
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[14px] outline-none focus:border-brand-600"
          >
            <option value="">All doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {report === "datewise" && (
          <select
            value={patientType}
            onChange={(e) => update({ patientType: e.target.value })}
            className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-[14px] outline-none focus:border-brand-600"
          >
            <option value="">All patients</option>
            <option value="new">New only</option>
            <option value="old">Old only</option>
          </select>
        )}
        {(report === "datewise" || report === "doctor") && (
          <select
            value={status}
            onChange={(e) => update({ status: e.target.value })}
            className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-[14px] outline-none focus:border-brand-600"
          >
            <option value="">All statuses</option>
            <option value="active">Active only</option>
            <option value="cancelled">Cancelled only</option>
          </select>
        )}
        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50 no-print"
          >
            <PrintIcon size={16} />
            Print
          </button>
        </span>
      </div>
      <p className="flex items-center gap-1 text-[11px] text-slate-400">
        <FilterIcon size={12} />
        The report updates when the filters change.
      </p>
    </div>
  );
}
