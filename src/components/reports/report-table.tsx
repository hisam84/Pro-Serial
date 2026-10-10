import { Badge } from "@/components/ui/card";
import {
  formatDate,
  formatDateCompact,
  formatDateTime,
  toDigits,
} from "@/lib/utils";
import { patientTypeLabel } from "@/lib/sms";
import type { SerialRow } from "@/lib/serials";

/**
 * Mobile-first report rows (cards) that become a table on larger screens.
 * Print styles produce a clean readable document.
 */
export function ReportTable({
  rows,
  showDoctor = true,
}: {
  rows: SerialRow[];
  showDoctor?: boolean;
}) {
  return (
    <div>
      {/* Mobile: cards */}
      <ul className="space-y-2 print:hidden">
        {rows.map((r) => (
          <li
            key={r.id}
            className={`rounded-xl border p-3 ${
              r.status === "cancelled"
                ? "border-red-100 bg-red-50/40"
                : r.status === "completed"
                  ? "border-emerald-100 bg-emerald-50/30"
                : r.isReference
                  ? "border-rose-200 bg-rose-50/40"
                  : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-slate-900">
                  {r.patientName}
                </p>
                <p className="text-[12px] text-slate-500">
                  {r.patientMobileDisplay}
                  {r.patientAddress ? ` · ${r.patientAddress}` : ""}
                </p>
                {r.isReference && r.referenceDetails && (
                  <p className="mt-0.5 text-[12px] text-rose-700">
                    Reference: {r.referenceDetails}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {r.isReference ? (
                  <Badge variant="reference">Reference</Badge>
                ) : (
                  <span
                    className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-base font-bold ${
                      r.patientType === "new"
                        ? "bg-sky-100 text-sky-800"
                        : "bg-violet-100 text-violet-800"
                    }`}
                  >
                    {r.serialNumber != null ? toDigits(r.serialNumber) : "—"}
                  </span>
                )}
                <Badge variant={r.patientType === "new" ? "new" : "old"}>
                  {patientTypeLabel(r.patientType)}
                </Badge>
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              {showDoctor && `${r.doctorName} · `}
              {formatDateCompact(r.appointmentDate)}
              {r.status === "cancelled" &&
                ` · Cancelled${r.cancelledByName ? ` (${r.cancelledByName})` : ""}`}
              {r.status === "completed" && " · Completed"}
            </p>
          </li>
        ))}
      </ul>

      {/* Desktop / print: table */}
      <table className="hidden w-full border-collapse text-left text-[13px] print:table">
        <thead>
          <tr className="border-b border-slate-300">
            <th className="py-1.5 pr-2 font-semibold">Serials</th>
            <th className="py-1.5 pr-2 font-semibold">Patient</th>
            <th className="py-1.5 pr-2 font-semibold">Mobile</th>
            <th className="py-1.5 pr-2 font-semibold">Type</th>
            {showDoctor && <th className="py-1.5 pr-2 font-semibold">Doctor</th>}
            <th className="py-1.5 pr-2 font-semibold">Date</th>
            <th className="py-1.5 pr-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100">
              <td className="py-1.5 pr-2 font-semibold">
                {r.isReference
                  ? "Reference"
                  : r.serialNumber != null
                    ? toDigits(r.serialNumber)
                    : "—"}
              </td>
              <td className="py-1.5 pr-2">
                {r.patientName}
                {r.isReference && r.referenceDetails
                  ? ` (${r.referenceDetails})`
                  : ""}
              </td>
              <td className="py-1.5 pr-2">{r.patientMobileDisplay}</td>
              <td className="py-1.5 pr-2">{patientTypeLabel(r.patientType)}</td>
              {showDoctor && <td className="py-1.5 pr-2">{r.doctorName}</td>}
              <td className="py-1.5 pr-2">{formatDateCompact(r.appointmentDate)}</td>
              <td className="py-1.5 pr-2">
                {r.status === "cancelled"
                  ? "Cancelled"
                  : r.status === "completed"
                    ? "Completed"
                    : "Active"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Daily summary as labelled stat rows. */
export function SummaryGrid({
  summary,
}: {
  summary: {
    activeNew: number;
    activeOld: number;
    activeReference: number;
    cancelled: number;
    completed: number;
    activeTotal: number;
    totalEntries: number;
  };
}) {
  const items: [string, number, string][] = [
    ["New patient", summary.activeNew, "text-sky-700"],
    ["Old patient", summary.activeOld, "text-violet-700"],
    ["Reference", summary.activeReference, "text-rose-700"],
    ["Active serials", summary.activeTotal, "text-brand-700"],
    ["Cancelled", summary.cancelled, "text-red-600"],
    ["Completed", summary.completed, "text-emerald-700"],
    ["Total entries", summary.totalEntries, "text-slate-800"],
  ];
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {items.map(([label, value, color]) => (
        <div
          key={label}
          className="print-card rounded-xl border border-slate-200 bg-white px-4 py-3"
        >
          <p className="text-[12px] text-slate-500">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{toDigits(value)}</p>
        </div>
      ))}
    </div>
  );
}

/** Compact doctor-wise summary table. */
export function DoctorSummaryTable({
  doctors,
}: {
  doctors: {
    doctorId: string;
    doctorName: string;
    counts: {
      activeNew: number;
      activeOld: number;
      activeReference: number;
      cancelled: number;
      completed: number;
      activeTotal: number;
    };
  }[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="w-full text-left text-[13px]">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 font-semibold text-slate-600">Doctor</th>
            <th className="px-3 py-2 font-semibold text-slate-600">New</th>
            <th className="px-3 py-2 font-semibold text-slate-600">Old</th>
            <th className="px-3 py-2 font-semibold text-slate-600">References</th>
            <th className="px-3 py-2 font-semibold text-slate-600">Cancelled</th>
            <th className="px-3 py-2 font-semibold text-slate-600">Completed</th>
            <th className="px-3 py-2 font-semibold text-slate-600">Active total</th>
          </tr>
        </thead>
        <tbody>
          {doctors.map((d) => (
            <tr key={d.doctorId} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium text-slate-800">
                {d.doctorName}
              </td>
              <td className="px-3 py-2">{toDigits(d.counts.activeNew)}</td>
              <td className="px-3 py-2">{toDigits(d.counts.activeOld)}</td>
              <td className="px-3 py-2">
                {toDigits(d.counts.activeReference)}
              </td>
              <td className="px-3 py-2 text-red-600">
                {toDigits(d.counts.cancelled)}
              </td>
              <td className="px-3 py-2 text-emerald-700">
                {toDigits(d.counts.completed)}
              </td>
              <td className="px-3 py-2 font-semibold">
                {toDigits(d.counts.activeTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportHeader({
  title,
  context,
}: {
  title: string;
  context: string[];
}) {
  return (
    <div className="mb-3">
      <h2 className="text-[16px] font-bold text-slate-900">{title}</h2>
      <p className="text-[12px] text-slate-500">{context.filter(Boolean).join(" · ")}</p>
    </div>
  );
}

export { formatDateTime, formatDate };
