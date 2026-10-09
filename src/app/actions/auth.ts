"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import {
  createSession,
  destroySession,
  getSessionUser,
  toActor,
  verifyPassword,
} from "@/lib/auth";
import { changeOwnPassword } from "@/lib/staff";
import { rateLimit, rateLimitReset } from "@/lib/rate-limit";
import { changePasswordSchema, loginSchema } from "@/lib/validation";

export interface FormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
}

/** Where each role lands after signing in. */
function homePathForRole(role: string): string {
  switch (role) {
    case "super_admin":
      return "/super-admin";
    case "clinic_admin":
      return "/clinic";
    default:
      return "/serials";
  }
}

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      error: "Enter username and password.",
    };
  }

  // Basic abuse protection (per-IP + per-username).
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limit = rateLimit(`login:${ip}:${parsed.data.username}`, 8, 15 * 60_000);
  if (!limit.allowed) {
    return {
      error: `Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.`,
    };
  }

  const db = await getDb();
  const username = parsed.data.username.trim().toLowerCase();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  const user = rows[0];

  // Same message for unknown user vs wrong password.
  const invalid = { error: "Invalid username or password." };
  if (!user || user.status !== "active") {
    return invalid;
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) return invalid;

  // Clinic must be active for clinic-scoped users.
  if (user.clinicId) {
    const { clinics } = await import("@/db/schema");
    const clinic = await db
      .select({ status: clinics.status })
      .from(clinics)
      .where(eq(clinics.id, user.clinicId))
      .limit(1);
    if (clinic[0] && clinic[0].status !== "active") {
      return {
        error:
          "This clinic account is not active. Contact your administrator.",
      };
    }
  }

  rateLimitReset(`login:${ip}:${parsed.data.username}`);
  await createSession(db, user.id);

  if (user.mustChangePassword) {
    redirect("/settings/password?force=1");
  }
  redirect(homePathForRole(user.role));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
}

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const db = await getDb();
  const user = await getSessionUser(db);
  if (!user) {
    redirect("/login");
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { error: "Please fix the errors in the form.", fieldErrors };
  }

  const result = await changeOwnPassword(db, user, {
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
  });

  if (!result.ok) {
    return {
      error: result.error,
      fieldErrors: result.fieldErrors,
    };
  }
  return {
    ok: true,
    message: "Password changed successfully.",
  };
}
