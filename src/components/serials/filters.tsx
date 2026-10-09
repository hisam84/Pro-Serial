"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { CalendarIcon, SearchIcon, StethoscopeIcon } from "@/components/ui/icons";
import type { DoctorOption } from "./serial-form";
import { toDigits } from "@/lib/utils";

export function SerialFilters({
  date,
  doctorId,
  query,
  doctors,
  tab,
  counts,
}: {
  date: string;
  doctorId: string;
  query: string;
  doctors: DoctorOption[];
  tab: "all" | "new" | "old";
  counts: { activeNew: number; activeOld: number; activeReference: number; cancelled: number };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [searchText, setSearchText] = useState(query);

  const update = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      startTransition(() => {
        router.replace(`/serials?${params.toString()}`);
      });
    },
    [router, searchParams],
  );

  useEffect(() => {
    const normalizedQuery = searchText.trim();
    if (normalizedQuery === query) return;

    const timeout = window.setTimeout(() => {
      update({ q: normalizedQuery });
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [query, searchText, update]);

  return (
    <div className={cn("space-y-3", pending && "opacity-70")}>
      {/* Date + doctor */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Date</span>
          <CalendarIcon
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => update({ date: e.target.value })}
            className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-[15px] text-slate-800 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25"
          />
        </label>

        {doctors.length > 1 ? (
          <label className="relative flex-1">
            <span className="sr-only">Doctor</span>
            <StethoscopeIcon
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <select
              value={doctorId}
              onChange={(e) => update({ doctorId: e.target.value })}
              className="h-11 w-full appearance-none rounded-lg border border-slate-300 bg-white pl-10 pr-9 text-[15px] text-slate-800 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                backgroundPosition: "right 0.7rem center",
              }}
            >
              <option value="">All doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.specialty ? ` — ${d.specialty}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          doctors[0] && (
            <div className="flex h-11 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3.5 text-[15px] text-slate-700">
              <StethoscopeIcon size={17} className="text-slate-400" />
              <span className="truncate font-medium">{doctors[0].name}</span>
            </div>
          )
        )}
      </div>

      <div role="search">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search patient name or mobile number</span>
          <SearchIcon
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            name="q"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Patient name or mobile number"
            className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-[15px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25"
          />
        </label>
      </div>

      {/* Category tabs */}
      <div
        role="tablist"
        aria-label="Patient type"
        className="grid grid-cols-3 gap-1 rounded-lg border border-slate-300 bg-slate-100 p-1"
      >
        {(
          [
            ["all", `All (${toDigits(counts.activeNew + counts.activeOld)})`],
            ["new", `New (${toDigits(counts.activeNew)})`],
            ["old", `Old (${toDigits(counts.activeOld)})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            type="button"
            onClick={() => update({ tab: key === "all" ? "" : key })}
            className={cn(
              "h-9 rounded-md text-[14px] font-medium transition-colors",
              tab === key
                ? "bg-white text-brand-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
