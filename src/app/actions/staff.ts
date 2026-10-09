"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { canManageStaff } from "@/lib/rbac";
import {
  createAttendant,
  resetAttendantPassword,
  updateAttendant,
} from "@/lib/staff";
import {
  attendantCreateSchema,
  attendantUpdateSchema,
  resetPasswordSchema,
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

async function requireClinicAdmin() {
  const db = await getDb();
  const user = await requireUser(db);
  if (!canManageStaff(user) || !user.clinicId) redirect("/unauthorized");
  return { db, user };
}

function doctorIdsFrom(formData: FormData): string[] {
  return formData
    .getAll("doctorIds")
    .map(String)
    .filter((s) => s.length > 0);
}

export interface StaffFormState extends FormState {
  reset?: { username: string; tempPassword: string };
  created?: { userId: string; username: string };
}

export async function createAttendantAction(
  _prev: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const { db, user } = await requireClinicAdmin();

  const parsed = attendantCreateSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    username: formData.get("username"),
    password: formData.get("password"),
    doctorIds: doctorIdsFrom(formData),
  });
  if (!parsed.success) {
    return { error: "Please fix the errors in the form.", fieldErrors: zodFields(parsed.error) };
  }

  const result = await createAttendant(db, user, parsed.data);
  if (!result.ok || !result.data) {
    return {
      error: result.error ?? "Could not create the attendant.",
      fieldErrors: result.fieldErrors,
    };
  }
  return {
    ok: true,
    message: "Attendant created.",
    created: result.data,
  };
}

export async function updateAttendantAction(
  _prev: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const { db, user } = await requireClinicAdmin();

  const parsed = attendantUpdateSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    status: formData.get("status") === "disabled" ? "disabled" : "active",
    doctorIds: doctorIdsFrom(formData),
  });
  if (!parsed.success) {
    return { error: "Please fix the errors in the form.", fieldErrors: zodFields(parsed.error) };
  }

  const result = await updateAttendant(db, user, parsed.data);
  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors };
  }
  return { ok: true, message: "User details updated." };
}

export async function resetAttendantPasswordAction(
  _prev: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const { db, user } = await requireClinicAdmin();

  const parsed = resetPasswordSchema.safeParse({
    userId: formData.get("userId"),
    newPassword: formData.get("newPassword"),
  });
  // The admin flow generates its own temporary password; we only need the id.
  const userId = String(formData.get("userId") ?? "");
  if (!userId && !parsed.success) return { error: "Please provide valid information." };

  const result = await resetAttendantPassword(db, user, userId);
  if (!result.ok || !result.data) {
    return { error: result.error ?? "Could not reset the password." };
  }
  return {
    ok: true,
    message: "A temporary password was created — shown only once.",
    reset: result.data,
  };
}
