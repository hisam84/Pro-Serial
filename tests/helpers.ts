/**
 * Shared test fixtures. All data is fictional.
 */
import { createTestDb, type Db } from "@/db";
import {
  clinics,
  doctorAttendants,
  doctors,
  users,
} from "@/db/schema";
import type { AuditActor } from "@/lib/audit";
import type { CreateSerialParams } from "@/lib/serials";

/**
 * One PGlite instance per test file (memory-friendly); fixtures insert
 * independent rows so tests stay isolated.
 */
let dbPromise: Promise<Db> | null = null;

export async function freshDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = createTestDb().then((r) => r.db);
  }
  return dbPromise;
}

let fixtureCounter = 0;

/** Unique username so fixtures can share one database. */
function uniqUsername(prefix: string): string {
  fixtureCounter += 1;
  return `${prefix}_${fixtureCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

export interface Fixture {
  db: Db;
  clinicId: string;
  otherClinicId: string;
  superAdmin: AuditActor;
  clinicAdmin: AuditActor;
  otherClinicAdmin: AuditActor;
  attendant: AuditActor;
  unassignedAttendant: AuditActor;
  doctorId: string;
  otherDoctorId: string;
  unassignedDoctorId: string;
}

export async function buildFixture(): Promise<Fixture> {
  const db = await freshDb();

  const [clinic] = await db
    .insert(clinics)
    .values({ name: "Demo Clinic", timezone: "Asia/Dhaka" })
    .returning();
  const [otherClinic] = await db
    .insert(clinics)
    .values({ name: "Other Clinic" })
    .returning();

  const [superAdminUser] = await db
    .insert(users)
    .values({
      clinicId: null,
      name: "Super Admin",
      username: uniqUsername("super"),
      passwordHash: "x",
      role: "super_admin",
    })
    .returning();
  const [adminUser] = await db
    .insert(users)
    .values({
      clinicId: clinic.id,
      name: "Clinic Admin",
      username: uniqUsername("admin"),
      passwordHash: "x",
      role: "clinic_admin",
    })
    .returning();
  const [otherAdminUser] = await db
    .insert(users)
    .values({
      clinicId: otherClinic.id,
      name: "Other Admin",
      username: uniqUsername("admin2"),
      passwordHash: "x",
      role: "clinic_admin",
    })
    .returning();
  const [attendantUser] = await db
    .insert(users)
    .values({
      clinicId: clinic.id,
      name: "Attendant",
      username: uniqUsername("att1"),
      passwordHash: "x",
      role: "attendant",
    })
    .returning();
  const [unassignedAttendantUser] = await db
    .insert(users)
    .values({
      clinicId: clinic.id,
      name: "Other Attendant",
      username: uniqUsername("att2"),
      passwordHash: "x",
      role: "attendant",
    })
    .returning();

  const [doctor] = await db
    .insert(doctors)
    .values({ clinicId: clinic.id, name: "Dr. Kamal", specialty: "Medicine" })
    .returning();
  const [unassignedDoctor] = await db
    .insert(doctors)
    .values({ clinicId: clinic.id, name: "Dr. Selim" })
    .returning();
  const [otherDoctor] = await db
    .insert(doctors)
    .values({ clinicId: otherClinic.id, name: "Dr. Rahim" })
    .returning();

  await db.insert(doctorAttendants).values({
    clinicId: clinic.id,
    doctorId: doctor.id,
    userId: attendantUser.id,
  });

  return {
    db,
    clinicId: clinic.id,
    otherClinicId: otherClinic.id,
    superAdmin: {
      id: superAdminUser.id,
      name: superAdminUser.name,
      role: "super_admin",
      clinicId: null,
    },
    clinicAdmin: {
      id: adminUser.id,
      name: adminUser.name,
      role: "clinic_admin",
      clinicId: clinic.id,
    },
    otherClinicAdmin: {
      id: otherAdminUser.id,
      name: otherAdminUser.name,
      role: "clinic_admin",
      clinicId: otherClinic.id,
    },
    attendant: {
      id: attendantUser.id,
      name: attendantUser.name,
      role: "attendant",
      clinicId: clinic.id,
    },
    unassignedAttendant: {
      id: unassignedAttendantUser.id,
      name: unassignedAttendantUser.name,
      role: "attendant",
      clinicId: clinic.id,
    },
    doctorId: doctor.id,
    otherDoctorId: otherDoctor.id,
    unassignedDoctorId: unassignedDoctor.id,
  };
}

/** Fills CreateSerialParams defaults; pass actor + doctorId in tests. */
export function serialParams(
  over: Partial<CreateSerialParams> &
    Pick<CreateSerialParams, "actor" | "doctorId">,
): CreateSerialParams {
  return {
    appointmentDate: "2026-10-09",
    patientType: "new",
    patientName: "Rahim Uddin",
    patientMobile: "01712345678",
    patientAddress: "Dhaka",
    isReference: false,
    referenceDetails: "",
    notes: "",
    requireAddress: false,
    ...over,
  };
}
