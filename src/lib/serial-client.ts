/**
 * Serializable row/payload types shared between server components and client
 * components (kept outside the "use server" action modules on purpose).
 */
import type { SerialRow } from "@/lib/serials";

/** Serializable snapshot of a serial row for client components. */
export interface SerialClientRow {
  id: string;
  appointmentDate: string;
  patientType: "new" | "old";
  serialNumber: number | null;
  isReference: boolean;
  referenceDetails: string | null;
  status: "active" | "cancelled" | "completed";
  notes: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  patientId: string;
  patientName: string;
  patientMobile: string;
  patientMobileDisplay: string;
  patientAddress: string;
  doctorId: string;
  doctorName: string;
  cancelledByName: string | null;
}

/** SMS payload handed to the client-side composition modal. */
export interface SmsPayload {
  patientName: string;
  mobileDisplay: string;
  dial: string;
  doctorName: string;
  clinicName: string;
  appointmentDate: string;
  serialLabel: string;
  message: string;
  smsLink: string;
}

export function toClientRow(row: SerialRow): SerialClientRow {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
  };
}
