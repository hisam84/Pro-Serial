/**
 * Server-side input validation (Zod). Every mutation validates here before
 * touching the database. Messages are user-facing and kept in English.
 */
import { z } from "zod";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const uuidSchema = z.string().regex(uuidRegex, "Invalid ID.");
export const isoDateSchema = z.string().regex(isoDateRegex, "Invalid date.");

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9._-]{3,32}$/,
    "Username must be 3–32 characters (lowercase letters, numbers, . _ -).",
  );

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.");

/* ── Auth ──────────────────────────────────────────────────────────── */

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "New password cannot be the same as the old one.",
    path: ["newPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const resetPasswordSchema = z.object({
  userId: uuidSchema,
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/* ── Clinic ────────────────────────────────────────────────────────── */

export const clinicInputSchema = z.object({
  name: z.string().trim().min(2, "Clinic name is required.").max(120),
  address: z.string().trim().max(240).default(""),
  phone: z.string().trim().max(40).default(""),
  timezone: z.string().trim().min(1).default("Asia/Dhaka"),
  requireAddress: z.boolean().default(false),
});
export type ClinicInput = z.infer<typeof clinicInputSchema>;

export const clinicStatusSchema = z.object({
  clinicId: uuidSchema,
  status: z.enum(["active", "suspended", "deactivated"]),
});

export const clinicCreateSchema = clinicInputSchema.extend({
  adminName: z.string().trim().min(2, "Admin name is required.").max(120),
  adminUsername: usernameSchema,
  adminPassword: passwordSchema,
});

/* ── Doctor ────────────────────────────────────────────────────────── */

export const doctorInputSchema = z.object({
  name: z.string().trim().min(2, "Doctor name is required.").max(120),
  specialty: z.string().trim().max(120).default(""),
  phone: z.string().trim().max(40).default(""),
  instructions: z.string().trim().max(600).default(""),
  smsTemplateNew: z.string().trim().max(1200).nullable().default(null),
  smsTemplateOld: z.string().trim().max(1200).nullable().default(null),
  status: z.enum(["active", "inactive"]).default("active"),
});
export type DoctorInput = z.infer<typeof doctorInputSchema>;

export const smsTemplateSchema = z.object({
  doctorId: uuidSchema,
  patientType: z.enum(["new", "old"]),
  smsTemplate: z.string().trim().max(1200),
});

/* ── Users (attendants / clinic admin) ─────────────────────────────── */

export const attendantCreateSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(120),
  phone: z.string().trim().max(40).default(""),
  username: usernameSchema,
  password: passwordSchema,
  doctorIds: z.array(uuidSchema).default([]),
});
export type AttendantCreateInput = z.infer<typeof attendantCreateSchema>;

export const attendantUpdateSchema = z.object({
  userId: uuidSchema,
  name: z.string().trim().min(2, "Name is required.").max(120),
  phone: z.string().trim().max(40).default(""),
  status: z.enum(["active", "disabled"]).default("active"),
  doctorIds: z.array(uuidSchema).default([]),
});

/* ── Patient / serial ──────────────────────────────────────────────── */

export const serialCreateSchema = z
  .object({
    doctorId: uuidSchema,
    appointmentDate: isoDateSchema,
    patientType: z.enum(["new", "old"]),
    patientName: z.string().trim().min(2, "Patient name is required.").max(120),
    patientMobile: z.string().trim().min(7, "Mobile number is required.").max(25),
    patientAddress: z.string().trim().max(240).default(""),
    isReference: z.boolean().default(false),
    referenceDetails: z.string().trim().max(240).default(""),
    notes: z.string().trim().max(600).default(""),
  })
  .superRefine((d, ctx) => {
    if (d.isReference && !d.referenceDetails) {
      ctx.addIssue({
        code: "custom",
        message: "Reference details are required.",
        path: ["referenceDetails"],
      });
    }
    if (!d.isReference && d.referenceDetails) {
      // tolerated — details ignored for regular serials
    }
  });
export type SerialCreateInput = z.infer<typeof serialCreateSchema>;

export const serialUpdateSchema = z.object({
  appointmentId: uuidSchema,
  patientName: z.string().trim().min(2, "Patient name is required.").max(120),
  patientMobile: z.string().trim().min(7, "Mobile number is required.").max(25),
  patientAddress: z.string().trim().max(240).default(""),
  referenceDetails: z.string().trim().max(240).default(""),
  notes: z.string().trim().max(600).default(""),
});

export const serialCancelSchema = z.object({
  appointmentId: uuidSchema,
  reason: z.string().trim().max(240).default(""),
});

export const serialCompleteSchema = z.object({
  appointmentId: uuidSchema,
});

export const serialChangeNumberSchema = z.object({
  appointmentId: uuidSchema,
  serialNumber: z.coerce
    .number()
    .int("Serial number must be an integer.")
    .min(1, "Serial number must be at least 1.")
    .max(100000, "Serial number is too large."),
});

export const serialMoveSchema = z.object({
  appointmentId: uuidSchema,
  direction: z.enum(["up", "down"]),
});

/* ── Reports ───────────────────────────────────────────────────────── */

export const reportFilterSchema = z.object({
  report: z
    .enum([
      "datewise",
      "new",
      "old",
      "doctor",
      "cancellation",
      "summary",
    ])
    .default("datewise"),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  date: isoDateSchema.optional(),
  doctorId: z.string().regex(uuidRegex).optional().or(z.literal("")),
  patientType: z.enum(["new", "old", ""]).default(""),
  status: z.enum(["active", "cancelled", "completed", ""]).default(""),
});

export function parseOr<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: unknown } }, value: unknown, fallback: T): T {
  const result = schema.safeParse(value);
  return result.success ? (result.data as T) : fallback;
}
