/**
 * Demo seed data — DEVELOPMENT ONLY. All records are fictional.
 *
 *   npm run db:seed
 *
 * Refuses to run against production (NODE_ENV=production) unless
 * ALLOW_PRODUCTION_SEED=1 is explicitly set. Never runs automatically.
 */
import { count } from "drizzle-orm";
import { closeDb, resolveDb } from "../src/db/index";
import {
  clinics,
  doctorAttendants,
  doctors,
  users,
} from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";
import { createSerialEntry } from "../src/lib/serials";

async function main() {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_PRODUCTION_SEED) {
    console.error("Seeding a production database is not allowed.");
    process.exit(1);
  }

  const { db } = await resolveDb();

  const [{ total: userCount }] = await db.select({ total: count() }).from(users);
  if (Number(userCount) > 0) {
    console.log("Database already has users — seed skipped (for safety).");
    console.log("Empty the database and run again to re-seed.");
    await closeDb();
    return;
  }

  console.log("→ Creating fictional demo data…");

  // ── Clinic 1 ──────────────────────────────────────────────────────
  const [clinic1] = await db
    .insert(clinics)
    .values({
      name: "Demo Medical Centre",
      address: "10 Kazi Nazrul Islam Avenue, Karwan Bazar, Dhaka",
      phone: "01711111111",
      timezone: "Asia/Dhaka",
      requireAddress: false,
      status: "active",
    })
    .returning();

  // ── Clinic 2 (for tenant-isolation demos) ─────────────────────────
  const [clinic2] = await db
    .insert(clinics)
    .values({
      name: "Shahin Diagnostic Centre",
      address: "5 Agrabad, Chittagong",
      phone: "01811111111",
      timezone: "Asia/Dhaka",
      status: "active",
    })
    .returning();

  // ── Users ─────────────────────────────────────────────────────────
  const password = async (p: string) => hashPassword(p);

  await db
    .insert(users)
    .values({
      clinicId: null,
      name: "Demo Super Admin",
      username: "super",
      passwordHash: await password("SuperAdmin123!"),
      role: "super_admin",
    })
    .returning();

  await db
    .insert(users)
    .values({
      clinicId: clinic1.id,
      name: "Md. Rafiqul Islam",
      username: "admin",
      passwordHash: await password("Admin12345!"),
      role: "clinic_admin",
    })
    .returning();

  await db.insert(users).values({
    clinicId: clinic2.id,
    name: "Nusrat Jahan",
    username: "admin2",
    passwordHash: await password("Admin12345!"),
    role: "clinic_admin",
  });

  const [att1] = await db
    .insert(users)
    .values({
      clinicId: clinic1.id,
      name: "Salma Akter",
      username: "attendant",
      passwordHash: await password("Attendant123!"),
      role: "attendant",
    })
    .returning();

  const [att2] = await db
    .insert(users)
    .values({
      clinicId: clinic1.id,
      name: "Zahid Hasan",
      username: "attendant2",
      passwordHash: await password("Attendant123!"),
      role: "attendant",
    })
    .returning();

  // ── Doctors ───────────────────────────────────────────────────────
  const [doc1] = await db
    .insert(doctors)
    .values({
      clinicId: clinic1.id,
      name: "Dr. Kamal Uddin",
      specialty: "Medicine specialist",
      phone: "01911111111",
      instructions: "9 AM–1 PM. Please bring reports.",
      smsTemplate: `{{clinic_name}}
Dear {{patient_name}}, your serial with {{doctor_name}} is {{serial_number}} ({{patient_type}}), on {{appointment_date}}.
Please arrive on time. Thank you.`,
      status: "active",
    })
    .returning();

  const [doc2] = await db
    .insert(doctors)
    .values({
      clinicId: clinic1.id,
      name: "Dr. Fatema Akter",
      specialty: "Gynaecology & obstetrics specialist",
      phone: "01922222222",
      instructions: "4 PM–8 PM.",
      status: "active",
    })
    .returning();

  await db.insert(doctors).values({
    clinicId: clinic2.id,
    name: "Dr. Selim Mia",
    specialty: "Paediatrics specialist",
    status: "active",
  });

  // ── Assignments: att1 → doc1+doc2, att2 → doc2 ────────────────────
  await db.insert(doctorAttendants).values([
    { clinicId: clinic1.id, doctorId: doc1.id, userId: att1.id },
    { clinicId: clinic1.id, doctorId: doc2.id, userId: att1.id },
    { clinicId: clinic1.id, doctorId: doc2.id, userId: att2.id },
  ]);

  // ── A few serials for today (fictional patients) ──────────────────
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const actor = {
    id: att1.id,
    name: att1.name,
    role: "attendant" as const,
    clinicId: clinic1.id,
  };

  const mk = (over: Record<string, unknown>) =>
    createSerialEntry(db, {
      actor,
      doctorId: doc1.id,
      appointmentDate: today,
      patientType: "new",
      patientName: "Rahim Uddin",
      patientMobile: "01712345678",
      patientAddress: "Mirpur-10, Dhaka",
      isReference: false,
      referenceDetails: "",
      notes: "",
      requireAddress: false,
      ...over,
    } as never);

  await mk({ patientName: "Rahim Uddin", patientMobile: "01712345678" });
  await mk({ patientName: "Karim Mia", patientMobile: "01712345679", patientType: "old" });
  await mk({ patientName: "Sumaya Akter", patientMobile: "01712345680" });
  await mk({ patientName: "Jahangir Alam", patientMobile: "01712345681", patientType: "old" });
  await mk({
    patientName: "Reference patient",
    patientMobile: "01712345682",
    isReference: true,
    referenceDetails: "Dr. Selim Mia",
    patientAddress: "",
  });

  const cancelled = await mk({
    patientName: "Cancelled patient",
    patientMobile: "01712345683",
  });
  if (cancelled.ok && cancelled.data) {
    const { cancelSerialEntry } = await import("../src/lib/serials");
    await cancelSerialEntry(db, {
      actor,
      appointmentId: cancelled.data.appointment.id,
      reason: "Could not come due to distance",
    });
  }

  await mk({
    doctorId: doc2.id,
    patientName: "Nasrin Sultana",
    patientMobile: "01712345684",
    patientType: "new",
    patientAddress: "",
  });

  console.log("✓ Seed complete. Demo logins (development only):");
  console.log("    Super Admin  : super / SuperAdmin123!");
  console.log("    Clinic Admin : admin / Admin12345!");
  console.log("    Attendant    : attendant / Attendant123!");
  console.log("    Attendant 2  : attendant2 / Attendant123!");
  console.log("    (second clinic: admin2 / Admin12345!)");
  await closeDb();
}

main().catch(async (e) => {
  console.error("Seed failed:", e);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
