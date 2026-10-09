"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import {
  requireUser,
  toActor,
  type SessionUser,
} from "@/lib/auth";
import { canUseSerials } from "@/lib/rbac";
import {
  cancelSerialEntry,
  changeSerialNumber,
  createSerialEntry,
  findPatientsByMobile,
  updateSerialEntry,
  type SerialRow,
} from "@/lib/serials";
import { buildSmsInput, renderSmsTemplate, buildSmsLink } from "@/lib/sms";
import { effectiveSmsTemplate, getDoctor } from "@/lib/doctors";
import { normalizeMobile } from "@/lib/mobile";
import {
  serialCancelSchema,
  serialChangeNumberSchema,
  serialCreateSchema,
  serialUpdateSchema,
} from "@/lib/validation";
import { clinics, doctors } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { FormState } from "./auth";

export type { FormState };

import {
  toClientRow,
  type SerialClientRow,
  type SmsPayload,
} from "@/lib/serial-client";
export type { SerialClientRow, SmsPayload };

async function requireSerialsUser(): Promise<{
  db: Awaited<ReturnType<typeof getDb>>;
  user: SessionUser;
}> {
  const db = await getDb();
  const user = await requireUser(db);
  if (!canUseSerials(user) || !user.clinicId) redirect("/unauthorized");
  return { db, user };
}

/** Renders the doctor-specific SMS for an appointment row. */
function buildSmsPayloadFrom(
  row: SerialRow,
  smsTemplate: string | null,
  clinicName: string,
): SmsPayload {
  const input = buildSmsInput({
    patientName: row.patientName,
    patientMobile: row.patientMobileDisplay,
    patientAddress: row.patientAddress,
    patientType: row.patientType,
    serialNumber: row.serialNumber,
    appointmentDate: row.appointmentDate,
    doctorName: row.doctorName,
    clinicName,
    referenceDetails: row.referenceDetails,
    isReference: row.isReference,
  });
  const message = renderSmsTemplate(effectiveSmsTemplate({ smsTemplate }), input);
  const mobile = normalizeMobile(row.patientMobileDisplay);
  return {
    patientName: row.patientName,
    mobileDisplay: row.patientMobileDisplay,
    dial: mobile.dial || row.patientMobileDisplay,
    doctorName: row.doctorName,
    clinicName,
    appointmentDate: row.appointmentDate,
    serialLabel: row.isReference
      ? "Reference"
      : row.serialNumber != null
        ? String(row.serialNumber)
        : "—",
    message,
    smsLink: buildSmsLink(mobile.dial || row.patientMobileDisplay, message),
  };
}

/** Full SMS payload with clinic name + doctor template loaded. */
export async function getSmsPayloadFor(
  db: Awaited<ReturnType<typeof getDb>>,
  user: SessionUser,
  row: SerialRow,
): Promise<SmsPayload> {
  const [doctor] = await db
    .select({ smsTemplate: doctors.smsTemplate })
    .from(doctors)
    .where(eq(doctors.id, row.doctorId))
    .limit(1);
  const [clinic] = await db
    .select({ name: clinics.name })
    .from(clinics)
    .where(eq(clinics.id, user.clinicId!))
    .limit(1);
  return buildSmsPayloadFrom(
    row,
    doctor?.smsTemplate ?? null,
    clinic?.name ?? "",
  );
}

/* ── Create ────────────────────────────────────────────────────────── */

export interface CreateSerialState extends FormState {
  created?: SerialClientRow & { sms: SmsPayload };
}

export async function createSerialAction(
  _prev: CreateSerialState,
  formData: FormData,
): Promise<CreateSerialState> {
  const { db, user } = await requireSerialsUser();

  const parsed = serialCreateSchema.safeParse({
    doctorId: formData.get("doctorId"),
    appointmentDate: formData.get("appointmentDate"),
    patientType: formData.get("patientType"),
    patientName: formData.get("patientName"),
    patientMobile: formData.get("patientMobile"),
    patientAddress: formData.get("patientAddress") ?? "",
    isReference: formData.get("isReference") === "on" || formData.get("isReference") === "true",
    referenceDetails: formData.get("referenceDetails") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Please fix the errors in the form.", fieldErrors };
  }

  // Clinic settings: address requirement.
  const [clinic] = await db
    .select({ requireAddress: clinics.requireAddress })
    .from(clinics)
    .where(eq(clinics.id, user.clinicId!))
    .limit(1);

  const result = await createSerialEntry(db, {
    actor: toActor(user),
    doctorId: parsed.data.doctorId,
    appointmentDate: parsed.data.appointmentDate,
    patientType: parsed.data.patientType,
    patientName: parsed.data.patientName,
    patientMobile: parsed.data.patientMobile,
    patientAddress: parsed.data.patientAddress,
    isReference: parsed.data.isReference,
    referenceDetails: parsed.data.referenceDetails,
    notes: parsed.data.notes,
    requireAddress: clinic?.requireAddress ?? false,
  });

  if (!result.ok || !result.data) {
    return {
      error: result.error ?? "Could not save the serial.",
      fieldErrors: result.fieldErrors,
    };
  }

  const row: SerialRow = {
    id: result.data.appointment.id,
    appointmentDate: result.data.appointment.appointmentDate,
    patientType: result.data.appointment.patientType,
    serialNumber: result.data.appointment.serialNumber,
    isReference: result.data.appointment.isReference,
    referenceDetails: result.data.appointment.referenceDetails,
    status: result.data.appointment.status,
    notes: result.data.appointment.notes,
    createdAt: result.data.appointment.createdAt,
    updatedAt: result.data.appointment.updatedAt,
    cancelledAt: result.data.appointment.cancelledAt,
    cancelReason: result.data.appointment.cancelReason,
    patientId: result.data.patient.id,
    patientName: result.data.patient.name,
    patientMobile: result.data.patient.mobileNormalized,
    patientMobileDisplay: result.data.patient.mobileDisplay,
    patientAddress: result.data.patient.address,
    doctorId: result.data.appointment.doctorId,
    doctorName: formData.get("doctorName")?.toString() ?? "",
    cancelledByName: null,
  };
  // Prefer the authoritative doctor name from the DB.
  const [doctorRow] = await db
    .select({ name: doctors.name })
    .from(doctors)
    .where(eq(doctors.id, row.doctorId))
    .limit(1);
  if (doctorRow) row.doctorName = doctorRow.name;
  const sms = await getSmsPayloadFor(db, user, row);

  return {
    ok: true,
    message: "Serial saved.",
    created: { ...toClientRow(row), sms },
  };
}

/* ── Update ────────────────────────────────────────────────────────── */

export async function updateSerialAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { db, user } = await requireSerialsUser();

  const parsed = serialUpdateSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    patientName: formData.get("patientName"),
    patientMobile: formData.get("patientMobile"),
    patientAddress: formData.get("patientAddress") ?? "",
    referenceDetails: formData.get("referenceDetails") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Please fix the errors in the form.", fieldErrors };
  }

  const result = await updateSerialEntry(db, {
    actor: toActor(user),
    appointmentId: parsed.data.appointmentId,
    patientName: parsed.data.patientName,
    patientMobile: parsed.data.patientMobile,
    patientAddress: parsed.data.patientAddress,
    referenceDetails: parsed.data.referenceDetails,
    notes: parsed.data.notes,
  });

  if (!result.ok) {
    return {
      error: result.error ?? "Update failed.",
      fieldErrors: result.fieldErrors,
    };
  }
  return { ok: true, message: "Serial updated." };
}

/* ── Cancel ────────────────────────────────────────────────────────── */

export async function cancelSerialAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { db, user } = await requireSerialsUser();

  const parsed = serialCancelSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    return { error: "Please provide valid information." };
  }

  const result = await cancelSerialEntry(db, {
    actor: toActor(user),
    appointmentId: parsed.data.appointmentId,
    reason: parsed.data.reason,
  });
  if (!result.ok) {
    return { error: result.error ?? "Cancellation failed." };
  }
  return { ok: true, message: "Serial cancelled." };
}

/* ── Manual serial change ──────────────────────────────────────────── */

export async function changeSerialNumberAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { db, user } = await requireSerialsUser();

  const parsed = serialChangeNumberSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    serialNumber: formData.get("serialNumber"),
  });
  if (!parsed.success) {
    return {
      error: "Invalid serial number.",
      fieldErrors: { serialNumber: "Enter a valid serial number." },
    };
  }

  const result = await changeSerialNumber(db, {
    actor: toActor(user),
    appointmentId: parsed.data.appointmentId,
    serialNumber: parsed.data.serialNumber,
  });
  if (!result.ok) {
    return {
      error: result.error ?? "Change failed.",
      fieldErrors: result.fieldErrors,
    };
  }
  return { ok: true, message: "Serial number changed." };
}

/* ── Existing patient lookup (suggestion only) ─────────────────────── */

export interface PatientSuggestion {
  name: string;
  address: string;
  mobileDisplay: string;
}

export async function lookupPatientAction(
  formData: FormData,
): Promise<{ ok: boolean; found?: PatientSuggestion[] }> {
  const { db, user } = await requireSerialsUser();
  const mobile = String(formData.get("patientMobile") ?? "");
  const found = await findPatientsByMobile(db, user.clinicId!, mobile);
  return {
    ok: true,
    found: found.slice(0, 3).map((p) => ({
      name: p.name,
      address: p.address,
      mobileDisplay: p.mobileDisplay,
    })),
  };
}
