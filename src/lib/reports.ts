/**
 * Report services.
 *
 * All reports are built on top of the same permission-scoped serial query,
 * so counts always respect clinic isolation and doctor assignments.
 */
import type { Db } from "@/db";
import type { AuditActor } from "@/lib/audit";
import {
  listSerials,
  summarizeCounts,
  type SerialCounts,
  type SerialRow,
} from "@/lib/serials";
import type { PatientType } from "@/db/schema";

export interface ReportFilters {
  /** Single date (YYYY-MM-DD) — used by most reports. */
  date?: string;
  /** Range (inclusive) — used by cancellation + summary reports. */
  from?: string;
  to?: string;
  doctorId?: string;
  patientType?: PatientType | "";
  status?: "active" | "cancelled" | "";
}

export interface DoctorSummaryRow {
  doctorId: string;
  doctorName: string;
  counts: SerialCounts;
}

function baseFilters(
  filters: ReportFilters,
  extra: { patientType?: PatientType | ""; status?: "active" | "cancelled" | "" } = {},
) {
  return {
    date: filters.date,
    from: filters.from,
    to: filters.to,
    doctorId: filters.doctorId || undefined,
    patientType: extra.patientType ?? filters.patientType ?? "",
    status: extra.status ?? filters.status ?? "",
  };
}

/** 1. Date-wise serial list (references first, then serial order). */
export async function datewiseReport(
  db: Db,
  actor: AuditActor,
  filters: ReportFilters,
): Promise<SerialRow[]> {
  return listSerials(db, actor, baseFilters(filters));
}

/** 2/3. New / old patient reports. */
export async function patientTypeReport(
  db: Db,
  actor: AuditActor,
  patientType: PatientType,
  filters: ReportFilters,
): Promise<SerialRow[]> {
  return listSerials(
    db,
    actor,
    baseFilters(filters, { patientType, status: filters.status || "active" }),
  );
}

/** 4. Doctor-wise counts + lists. */
export async function doctorWiseReport(
  db: Db,
  actor: AuditActor,
  filters: ReportFilters,
): Promise<{ doctors: DoctorSummaryRow[]; rows: SerialRow[] }> {
  const rows = await listSerials(db, actor, baseFilters(filters));
  const byDoctor = new Map<string, DoctorSummaryRow>();
  for (const row of rows) {
    let entry = byDoctor.get(row.doctorId);
    if (!entry) {
      entry = {
        doctorId: row.doctorId,
        doctorName: row.doctorName,
        counts: {
          activeNew: 0,
          activeOld: 0,
          activeReference: 0,
          cancelled: 0,
          activeTotal: 0,
        },
      };
      byDoctor.set(row.doctorId, entry);
    }
  }
  // summarize per doctor
  for (const entry of byDoctor.values()) {
    entry.counts = summarizeCounts(rows.filter((r) => r.doctorId === entry.doctorId));
  }
  return {
    doctors: [...byDoctor.values()].sort((a, b) =>
      a.doctorName.localeCompare(b.doctorName, "bn"),
    ),
    rows,
  };
}

/** 5. Cancellation report. */
export async function cancellationReport(
  db: Db,
  actor: AuditActor,
  filters: ReportFilters,
): Promise<SerialRow[]> {
  return listSerials(db, actor, baseFilters(filters, { status: "cancelled" }));
}

/** 6. Daily summary counts. */
export interface DailySummary extends SerialCounts {
  totalEntries: number;
}

export async function dailySummary(
  db: Db,
  actor: AuditActor,
  filters: ReportFilters,
): Promise<DailySummary> {
  const rows = await listSerials(db, actor, baseFilters(filters));
  const counts = summarizeCounts(rows);
  return {
    ...counts,
    totalEntries: rows.length,
  };
}
