import { describe, expect, it } from "vitest";
import {
  cancelSerialEntry,
  createSerialEntry,
  getSerialForActor,
  listSerials,
  listSerialsByIds,
} from "@/lib/serials";
import {
  canAccessDoctor,
  accessibleDoctorIds,
} from "@/lib/rbac";
import { createClinic, setClinicStatus } from "@/lib/clinics";
import { createDoctor, updateDoctor } from "@/lib/doctors";
import {
  createAttendant,
  getAttendant,
  resetAttendantPassword,
  updateAttendant,
} from "@/lib/staff";
import { buildFixture, serialParams } from "./helpers";

describe("tenant isolation & authorization", () => {
  it("an attendant can only manage assigned doctors", async () => {
    const f = await buildFixture();

    expect(await canAccessDoctor(f.db, f.attendant, f.doctorId)).toBe(true);
    expect(await canAccessDoctor(f.db, f.attendant, f.unassignedDoctorId)).toBe(false);

    const denied = await createSerialEntry(
      f.db,
      serialParams({
        actor: f.attendant,
        doctorId: f.unassignedDoctorId,
        patientMobile: "01711111101",
      }),
    );
    expect(denied.ok).toBe(false);
  });

  it("clinic admin can manage all doctors of their clinic, but not other clinics'", async () => {
    const f = await buildFixture();

    expect(await canAccessDoctor(f.db, f.clinicAdmin, f.doctorId)).toBe(true);
    expect(await canAccessDoctor(f.db, f.clinicAdmin, f.unassignedDoctorId)).toBe(true);
    expect(await canAccessDoctor(f.db, f.clinicAdmin, f.otherDoctorId)).toBe(false);

    const denied = await createSerialEntry(
      f.db,
      serialParams({
        actor: f.clinicAdmin,
        doctorId: f.otherDoctorId,
        patientMobile: "01711111101",
      }),
    );
    expect(denied.ok).toBe(false);
  });

  it("records from one clinic are invisible to another clinic (IDOR-safe)", async () => {
    const f = await buildFixture();
    const created = await createSerialEntry(
      f.db,
      serialParams({
        actor: f.attendant,
        doctorId: f.doctorId,
        patientMobile: "01711111101",
      }),
    );
    const id = created.data!.appointment.id;

    // other clinic's admin cannot read, edit, or cancel it
    expect(await getSerialForActor(f.db, f.otherClinicAdmin, id)).toBeNull();
    const crossList = await listSerials(f.db, f.otherClinicAdmin, {
      date: "2026-10-09",
    });
    expect(crossList.length).toBe(0);

    const deniedCancel = await cancelSerialEntry(f.db, {
      actor: f.otherClinicAdmin,
      appointmentId: id,
      reason: "malicious",
    });
    expect(deniedCancel.ok).toBe(false);

    // even by ID list
    expect(await listSerialsByIds(f.db, f.otherClinicAdmin, [id])).toEqual([]);
  });

  it("an unassigned attendant cannot see another attendant's serials", async () => {
    const f = await buildFixture();
    const created = await createSerialEntry(
      f.db,
      serialParams({
        actor: f.attendant,
        doctorId: f.doctorId,
        patientMobile: "01711111101",
      }),
    );
    const id = created.data!.appointment.id;

    expect(await getSerialForActor(f.db, f.unassignedAttendant, id)).toBeNull();
    const rows = await listSerials(f.db, f.unassignedAttendant, {
      date: "2026-10-09",
    });
    expect(rows.length).toBe(0);
  });

  it("clinic users cannot create clinics; super admin can", async () => {
    const f = await buildFixture();

    const denied = await createClinic(f.db, f.clinicAdmin as never, {
      name: "New clinic",
      address: "",
      phone: "",
      timezone: "Asia/Dhaka",
      requireAddress: false,
      adminName: "X",
      adminUsername: "xx",
      adminPassword: "password123",
    });
    expect(denied.ok).toBe(false);

    const denied2 = await createClinic(f.db, f.attendant as never, {
      name: "New clinic",
      address: "",
      phone: "",
      timezone: "Asia/Dhaka",
      requireAddress: false,
      adminName: "X",
      adminUsername: "xy",
      adminPassword: "password123",
    });
    expect(denied2.ok).toBe(false);

    const created = await createClinic(f.db, f.superAdmin as never, {
      name: "New clinic",
      address: "Dhaka",
      phone: "01711111111",
      timezone: "Asia/Dhaka",
      requireAddress: false,
      adminName: "New Admin",
      adminUsername: "newadmin",
      adminPassword: "password123",
    });
    expect(created.ok).toBe(true);
  });

  it("only super admin can change clinic status", async () => {
    const f = await buildFixture();
    const denied = await setClinicStatus(
      f.db,
      f.clinicAdmin as never,
      f.clinicId,
      "suspended",
    );
    expect(denied.ok).toBe(false);

    const allowed = await setClinicStatus(
      f.db,
      f.superAdmin as never,
      f.clinicId,
      "suspended",
    );
    expect(allowed.ok).toBe(true);
    expect(allowed.data?.status).toBe("suspended");
  });

  it("clinic admin cannot manage doctors of another clinic", async () => {
    const f = await buildFixture();
    const denied = await updateDoctor(f.db, f.otherClinicAdmin as never, f.doctorId, {
      name: "Hacked",
      specialty: "",
      phone: "",
      instructions: "",
      smsTemplateNew: null,
      smsTemplateOld: null,
      status: "inactive",
    });
    expect(denied.ok).toBe(false);

    const deniedCreate = await createDoctor(f.db, f.attendant as never, {
      name: "Dr. New",
      specialty: "",
      phone: "",
      instructions: "",
      smsTemplateNew: null,
      smsTemplateOld: null,
      status: "active",
    });
    expect(deniedCreate.ok).toBe(false);
  });

  it("attendant management is clinic-scoped and role-gated", async () => {
    const f = await buildFixture();

    // attendant cannot create attendants
    const denied = await createAttendant(f.db, f.attendant as never, {
      name: "New",
      username: "newatt",
      password: "password123",
      doctorIds: [],
    });
    expect(denied.ok).toBe(false);

    // clinic admin cannot attach another clinic's doctor to an attendant
    const created = await createAttendant(f.db, f.clinicAdmin as never, {
      name: "New attendant",
      phone: "01712345678",
      username: "newatt",
      password: "password123",
      doctorIds: [f.doctorId, f.otherDoctorId],
    });
    expect(created.ok).toBe(true);
    expect(
      (await getAttendant(f.db, f.clinicId, created.data!.userId))?.phone,
    ).toBe("01712345678");

    const ids = await accessibleDoctorIds(f.db, {
      id: created.data!.userId,
      name: "x",
      role: "attendant",
      clinicId: f.clinicId,
    });
    expect(ids).toContain(f.doctorId);
    expect(ids).not.toContain(f.otherDoctorId);

    // other clinic's admin cannot reset this attendant
    const deniedReset = await resetAttendantPassword(
      f.db,
      f.otherClinicAdmin as never,
      created.data!.userId,
    );
    expect(deniedReset.ok).toBe(false);

    const allowedReset = await resetAttendantPassword(
      f.db,
      f.clinicAdmin as never,
      created.data!.userId,
    );
    expect(allowedReset.ok).toBe(true);
  });

  it("updateAttendant rejects cross-clinic doctor assignment", async () => {
    const f = await buildFixture();
    const created = await createAttendant(f.db, f.clinicAdmin as never, {
      name: "Attendant",
      username: "attx",
      password: "password123",
      doctorIds: [],
    });

    await updateAttendant(f.db, f.clinicAdmin as never, {
      userId: created.data!.userId,
      name: "Attendant",
      phone: "01812345678",
      status: "active",
      doctorIds: [f.otherDoctorId], // foreign doctor — must be filtered out
    });
    expect(
      (await getAttendant(f.db, f.clinicId, created.data!.userId))?.phone,
    ).toBe("01812345678");

    const ids = await accessibleDoctorIds(f.db, {
      id: created.data!.userId,
      name: "x",
      role: "attendant",
      clinicId: f.clinicId,
    });
    expect(ids).toEqual([]);
  });
});
