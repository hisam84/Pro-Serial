"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { canManageDoctors, canManageSmsTemplates } from "@/lib/rbac";
import {
  createDoctor,
  saveSmsTemplate,
  updateDoctor,
} from "@/lib/doctors";
import {
  doctorInputSchema,
  smsTemplateSchema,
} from "@/lib/validation";
import type { FormState } from "./auth";

async function requireClinicAdmin() {
  const db = await getDb();
  const user = await requireUser(db);
  if (!canManageDoctors(user) || !user.clinicId) redirect("/unauthorized");
  return { db, user };
}

function zodFields(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export async function createDoctorAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { db, user } = await requireClinicAdmin();

  const parsed = doctorInputSchema.safeParse({
    name: formData.get("name"),
    specialty: formData.get("specialty") ?? "",
    phone: formData.get("phone") ?? "",
    instructions: formData.get("instructions") ?? "",
    smsTemplate: formData.get("smsTemplate")
      ? String(formData.get("smsTemplate"))
      : null,
    status: formData.get("status") === "inactive" ? "inactive" : "active",
  });
  if (!parsed.success) {
    return { error: "Please fix the errors in the form.", fieldErrors: zodFields(parsed.error) };
  }

  const result = await createDoctor(db, user, parsed.data);
  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors };
  }
  return { ok: true, message: "Doctor added." };
}

export async function updateDoctorAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { db, user } = await requireClinicAdmin();
  const doctorId = String(formData.get("doctorId") ?? "");

  const parsed = doctorInputSchema.safeParse({
    name: formData.get("name"),
    specialty: formData.get("specialty") ?? "",
    phone: formData.get("phone") ?? "",
    instructions: formData.get("instructions") ?? "",
    smsTemplate: formData.get("smsTemplate")
      ? String(formData.get("smsTemplate"))
      : null,
    status: formData.get("status") === "inactive" ? "inactive" : "active",
  });
  if (!parsed.success) {
    return { error: "Please fix the errors in the form.", fieldErrors: zodFields(parsed.error) };
  }

  const result = await updateDoctor(db, user, doctorId, parsed.data);
  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors };
  }
  return { ok: true, message: "Doctor details updated." };
}

export async function saveSmsTemplateAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const db = await getDb();
  const user = await requireUser(db);
  if (!canManageSmsTemplates(user) || !user.clinicId) redirect("/unauthorized");

  const parsed = smsTemplateSchema.safeParse({
    doctorId: formData.get("doctorId"),
    smsTemplate: formData.get("smsTemplate"),
  });
  if (!parsed.success) {
    return { error: "Invalid template.", fieldErrors: zodFields(parsed.error) };
  }

  const result = await saveSmsTemplate(
    db,
    user,
    parsed.data.doctorId,
    parsed.data.smsTemplate,
  );
  if (!result.ok) return { error: result.error };
  return { ok: true, message: "SMS template saved." };
}
