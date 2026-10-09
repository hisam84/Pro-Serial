"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireSuperAdmin, requireUser } from "@/lib/auth";
import { canManageClinicSettings } from "@/lib/rbac";
import {
  createClinic,
  resetClinicAdminPassword,
  setClinicStatus,
  updateClinic,
} from "@/lib/clinics";
import {
  clinicCreateSchema,
  clinicInputSchema,
  clinicStatusSchema,
} from "@/lib/validation";
import type { FormState } from "./auth";

function zodFields(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export interface ClinicFormState extends FormState {
  created?: { clinicId: string; adminUsername: string };
  reset?: { username: string; tempPassword: string };
}

export async function createClinicAction(
  _prev: ClinicFormState,
  formData: FormData,
): Promise<ClinicFormState> {
  const db = await getDb();
  const user = await requireSuperAdmin(db);

  const parsed = clinicCreateSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") ?? "",
    phone: formData.get("phone") ?? "",
    timezone: formData.get("timezone") || "Asia/Dhaka",
    requireAddress: formData.get("requireAddress") === "on",
    adminName: formData.get("adminName"),
    adminUsername: formData.get("adminUsername"),
    adminPassword: formData.get("adminPassword"),
  });
  if (!parsed.success) {
    return { error: "Please fix the errors in the form.", fieldErrors: zodFields(parsed.error) };
  }

  const result = await createClinic(db, user, parsed.data);
  if (!result.ok || !result.data) {
    return { error: result.error ?? "Could not create the clinic." };
  }
  return {
    ok: true,
    message: "Clinic created.",
    created: result.data,
  };
}

export async function updateClinicAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const db = await getDb();
  const user = await requireUser(db);
  const clinicId = String(formData.get("clinicId") ?? "");

  // Super admin OR the clinic's own admin.
  const isSelf =
    canManageClinicSettings(user) && user.clinicId === clinicId;
  if (user.role !== "super_admin" && !isSelf) redirect("/unauthorized");

  const parsed = clinicInputSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") ?? "",
    phone: formData.get("phone") ?? "",
    timezone: formData.get("timezone") || "Asia/Dhaka",
    requireAddress: formData.get("requireAddress") === "on",
  });
  if (!parsed.success) {
    return { error: "Please fix the errors in the form.", fieldErrors: zodFields(parsed.error) };
  }

  const result = await updateClinic(db, user, clinicId, parsed.data);
  if (!result.ok) return { error: result.error };
  return { ok: true, message: "Clinic details updated." };
}

export async function setClinicStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const db = await getDb();
  const user = await requireSuperAdmin(db);

  const parsed = clinicStatusSchema.safeParse({
    clinicId: formData.get("clinicId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Please provide valid information." };

  const result = await setClinicStatus(db, user, parsed.data.clinicId, parsed.data.status);
  if (!result.ok) return { error: result.error };
  return {
    ok: true,
    message:
      parsed.data.status === "active"
        ? "Clinic activated."
        : parsed.data.status === "suspended"
          ? "Clinic suspended."
          : "Clinic deactivated.",
  };
}

export interface ResetPasswordState extends FormState {
  reset?: { username: string; tempPassword: string };
}

export async function resetClinicAdminPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const db = await getDb();
  const user = await requireSuperAdmin(db);
  const clinicId = String(formData.get("clinicId") ?? "");

  const result = await resetClinicAdminPassword(db, user, clinicId);
  if (!result.ok || !result.data) {
    return { error: result.error ?? "Could not reset the password." };
  }
  return {
    ok: true,
    message: "A temporary password was created — shown only once.",
    reset: result.data,
  };
}

/** Clinic admin updates their own clinic profile. */
export async function updateClinicProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const db = await getDb();
  const user = await requireUser(db);
  if (!canManageClinicSettings(user) || !user.clinicId) redirect("/unauthorized");

  const parsed = clinicInputSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") ?? "",
    phone: formData.get("phone") ?? "",
    timezone: formData.get("timezone") || "Asia/Dhaka",
    requireAddress: formData.get("requireAddress") === "on",
  });
  if (!parsed.success) {
    return { error: "Please fix the errors in the form.", fieldErrors: zodFields(parsed.error) };
  }

  const result = await updateClinic(db, user, user.clinicId, parsed.data);
  if (!result.ok) return { error: result.error };
  return { ok: true, message: "Clinic details updated." };
}
