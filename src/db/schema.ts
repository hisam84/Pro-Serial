/**
 * Serial Pro — Drizzle ORM schema (PostgreSQL / Neon / PGlite).
 *
 * Migrations are plain SQL files in ./migrations and are applied by ./migrate.ts.
 * Keep this file and the SQL migrations in sync.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ── Enums ─────────────────────────────────────────────────────────── */

export const clinicStatusEnum = pgEnum("clinic_status", [
  "active",
  "suspended",
  "deactivated",
]);

export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "clinic_admin",
  "attendant",
  "doctor",
]);

export const userStatusEnum = pgEnum("user_status", ["active", "disabled"]);

export const doctorStatusEnum = pgEnum("doctor_status", ["active", "inactive"]);

export const patientTypeEnum = pgEnum("patient_type", ["new", "old"]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "active",
  "cancelled",
  "completed",
]);

/* ── Tables ────────────────────────────────────────────────────────── */

export const clinics = pgTable("clinics", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  timezone: text("timezone").notNull().default("Asia/Dhaka"),
  /** When true, patient address is required on the serial form. */
  requireAddress: boolean("require_address").notNull().default(false),
  status: clinicStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nullable ONLY for platform-level super admin accounts. */
    clinicId: uuid("clinic_id").references(() => clinics.id),
    name: text("name").notNull(),
    phone: text("phone").notNull().default(""),
    /** Normalized (lowercase) unique login identifier. */
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull(),
    status: userStatusEnum("status").notNull().default("active"),
    /** Set when an admin issues a temporary password; forces a change at login. */
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_username_uq").on(t.username),
    index("users_clinic_idx").on(t.clinicId),
  ],
);

export const doctors = pgTable(
  "doctors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    name: text("name").notNull(),
    specialty: text("specialty").notNull().default(""),
    phone: text("phone").notNull().default(""),
    profileImageUrl: text("profile_image_url"),
    /** Serial/visit instructions shown to staff (optional). */
    instructions: text("instructions").notNull().default(""),
    /** Doctor-specific SMS template; null → built-in default template. */
    smsTemplate: text("sms_template"),
    smsTemplateNew: text("sms_template_new"),
    smsTemplateOld: text("sms_template_old"),
    status: doctorStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("doctors_clinic_idx").on(t.clinicId)],
);

export const doctorAttendants = pgTable(
  "doctor_attendants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("doctor_attendants_uq").on(t.doctorId, t.userId),
    index("doctor_attendants_user_idx").on(t.userId),
    index("doctor_attendants_clinic_idx").on(t.clinicId),
  ],
);

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    name: text("name").notNull(),
    address: text("address").notNull().default(""),
    /** E.g. 8801712345678 — used for matching existing patients. */
    mobileNormalized: text("mobile_normalized").notNull(),
    /** As typed by staff, for display and SMS links. */
    mobileDisplay: text("mobile_display").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("patients_clinic_mobile_idx").on(t.clinicId, t.mobileNormalized),
    index("patients_clinic_name_idx").on(t.clinicId, t.name),
  ],
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    /** Appointment day, stored as DATE (YYYY-MM-DD) in the clinic's timezone. */
    appointmentDate: date("appointment_date", { mode: "string" }).notNull(),
    patientType: patientTypeEnum("patient_type").notNull(),
    /** Null for reference entries — references never consume a serial number. */
    serialNumber: integer("serial_number"),
    isReference: boolean("is_reference").notNull().default(false),
    referenceDetails: text("reference_details"),
    status: appointmentStatusEnum("status").notNull().default("active"),
    notes: text("notes").notNull().default(""),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    cancelledBy: uuid("cancelled_by").references(() => users.id),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("appointments_clinic_doctor_date_idx").on(
      t.clinicId,
      t.doctorId,
      t.appointmentDate,
    ),
    index("appointments_patient_idx").on(t.patientId),
    index("appointments_created_by_idx").on(t.createdBy),
    // Regular serials are unique per clinic+doctor+date+patient type.
    // Includes cancelled rows so a cancelled number is never reused.
    uniqueIndex("appointments_serial_uq")
      .on(
        t.clinicId,
        t.doctorId,
        t.appointmentDate,
        t.patientType,
        t.serialNumber,
      )
      .where(sql`is_reference = false AND serial_number IS NOT NULL`),
  ],
);

/**
 * Concurrency-safe serial counter. Allocation is a single atomic
 * INSERT ... ON CONFLICT DO UPDATE ... RETURNING so parallel requests can
 * never receive the same number.
 */
export const serialCounters = pgTable(
  "serial_counters",
  {
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id),
    appointmentDate: date("appointment_date", { mode: "string" }).notNull(),
    patientType: patientTypeEnum("patient_type").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({
      columns: [t.clinicId, t.doctorId, t.appointmentDate, t.patientType],
    }),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** SHA-256 of the opaque session token; raw tokens are never stored. */
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_uq").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
    index("sessions_expires_idx").on(t.expiresAt),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nullable for platform-level (super admin) actions. */
    clinicId: uuid("clinic_id").references(() => clinics.id),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    /** Denormalized actor name, kept for readability if the user changes. */
    actorName: text("actor_name").notNull().default(""),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    beforeData: jsonb("before_data").$type<Record<string, unknown> | null>(),
    afterData: jsonb("after_data").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_clinic_idx").on(t.clinicId),
    index("audit_entity_idx").on(t.entityType, t.entityId),
    index("audit_actor_idx").on(t.actorUserId),
  ],
);

/* ── Inferred types ────────────────────────────────────────────────── */

export type Clinic = typeof clinics.$inferSelect;
export type User = typeof users.$inferSelect;
export type Doctor = typeof doctors.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type PatientType = (typeof patientTypeEnum.enumValues)[number];
export type ClinicStatus = (typeof clinicStatusEnum.enumValues)[number];
