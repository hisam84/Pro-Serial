import { describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { appointments } from "@/db/schema";
import {
  cancelSerialEntry,
  changeSerialNumber,
  createSerialEntry,
  listSerials,
  moveSerialNumber,
  updateSerialEntry,
} from "@/lib/serials";
import { buildFixture, serialParams } from "./helpers";

describe("serial allocation rules", () => {
  it("gives separate sequences for new and old patients", async () => {
    const f = await buildFixture();

    const r1 = await createSerialEntry(
      f.db,
      serialParams({
        actor: f.attendant,
        doctorId: f.doctorId,
        patientType: "new",
        patientName: "New 1",
        patientMobile: "01711111101",
      }),
    );
    const r2 = await createSerialEntry(
      f.db,
      serialParams({
        actor: f.attendant,
        doctorId: f.doctorId,
        patientType: "old",
        patientName: "Old 1",
        patientMobile: "01711111102",
      }),
    );
    const r3 = await createSerialEntry(
      f.db,
      serialParams({
        actor: f.attendant,
        doctorId: f.doctorId,
        patientType: "new",
        patientName: "New 2",
        patientMobile: "01711111103",
      }),
    );

    expect(r1.data?.serialNumber).toBe(1);
    expect(r2.data?.serialNumber).toBe(1); // old has its own sequence
    expect(r3.data?.serialNumber).toBe(2);
  });

  it("resets sequences per doctor and per date", async () => {
    const f = await buildFixture();

    const a = await createSerialEntry(
      f.db,
      serialParams({ actor: f.attendant, doctorId: f.doctorId }),
    );
    const b = await createSerialEntry(
      f.db,
      serialParams({
        actor: f.attendant,
        doctorId: f.doctorId,
        appointmentDate: "2026-10-10",
      }),
    );
    const c = await createSerialEntry(
      f.db,
      serialParams({
        actor: f.clinicAdmin,
        doctorId: f.unassignedDoctorId,
      }),
    );

    expect(a.data?.serialNumber).toBe(1);
    expect(b.data?.serialNumber).toBe(1); // different date → restarts
    expect(c.data?.serialNumber).toBe(1); // different doctor → restarts
  });

  it("never gives references a serial number and never increments the counter", async () => {
    const f = await buildFixture();
    const mk = (over: Record<string, unknown>) =>
      createSerialEntry(
        f.db,
        serialParams({
          actor: f.attendant,
          doctorId: f.doctorId,
          ...over,
        } as never),
      );

    const ref1 = await mk({
      isReference: true,
      referenceDetails: "Dr. Selim",
      patientName: "Reference patient",
      patientMobile: "01711111111",
    });
    const ref2 = await mk({
      isReference: true,
      referenceDetails: "Dr. Karim",
      patientName: "Reference patient 2",
      patientMobile: "01711111112",
    });
    const regular = await mk({
      patientName: "General",
      patientMobile: "01711111113",
    });

    expect(ref1.data?.serialNumber).toBeNull();
    expect(ref2.data?.serialNumber).toBeNull();
    expect(regular.data?.serialNumber).toBe(1); // references did NOT consume numbers

    const rows = await listSerials(f.db, f.attendant, {
      date: "2026-10-09",
      doctorId: f.doctorId,
    });
    expect(rows[0].isReference).toBe(true);
    expect(rows[0].serialNumber).toBeNull();
    expect(rows[1].isReference).toBe(true);
    expect(rows[2].serialNumber).toBe(1);
  });

  it("is safe under concurrent creation (no duplicate serials)", async () => {
    const f = await buildFixture();
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        createSerialEntry(
          f.db,
          serialParams({
            actor: f.attendant,
            doctorId: f.doctorId,
            patientName: `Patient ${i}`,
            patientMobile: `01711111${String(100 + i)}`,
            patientAddress: "",
          }),
        ),
      ),
    );

    expect(results.every((r) => r.ok)).toBe(true);
    const numbers = results
      .map((r) => (r.ok ? r.data!.serialNumber : -1))
      .sort((a, b) => (a as number) - (b as number));
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    const rows = await f.db
      .select({ n: appointments.serialNumber })
      .from(appointments)
      .where(
        and(
          eq(appointments.appointmentDate, "2026-10-09"),
          eq(appointments.clinicId, f.clinicId),
          eq(appointments.doctorId, f.doctorId),
        ),
      );
    expect(new Set(rows.map((r) => r.n)).size).toBe(12);
  });

  it("does not reuse cancelled serial numbers and keeps history", async () => {
    const f = await buildFixture();
    const mk = (mobile: string) =>
      createSerialEntry(
        f.db,
        serialParams({
          actor: f.attendant,
          doctorId: f.doctorId,
          patientMobile: mobile,
          patientAddress: "",
        }),
      );

    const first = await mk("01711111101");
    const second = await mk("01711111102");
    expect(first.data?.serialNumber).toBe(1);
    expect(second.data?.serialNumber).toBe(2);

    await cancelSerialEntry(f.db, {
      actor: f.attendant,
      appointmentId: first.data!.appointment.id,
      reason: "No-show",
    });

    const third = await mk("01711111103");
    expect(third.data?.serialNumber).toBe(3); // NOT 1 again

    const rows = await listSerials(f.db, f.attendant, {
      date: "2026-10-09",
      doctorId: f.doctorId,
    });
    const cancelled = rows.find((r) => r.id === first.data!.appointment.id);
    expect(cancelled?.status).toBe("cancelled");
    expect(cancelled?.serialNumber).toBe(1); // history preserved
  });

  it("editing patient details preserves the serial number", async () => {
    const f = await buildFixture();
    const created = await createSerialEntry(
      f.db,
      serialParams({
        actor: f.attendant,
        doctorId: f.doctorId,
        patientName: "Rahim",
        patientMobile: "01712345678",
      }),
    );
    const before = created.data!.serialNumber;

    const updated = await updateSerialEntry(f.db, {
      actor: f.attendant,
      appointmentId: created.data!.appointment.id,
      patientName: "Rahim Uddin",
      patientMobile: "01712345679",
      patientAddress: "Chittagong",
      referenceDetails: "",
      notes: "Note",
    });

    expect(updated.ok).toBe(true);
    expect(updated.data?.serialNumber).toBe(before);
    expect(updated.data?.patientName).toBe("Rahim Uddin");
  });

  it("manual serial change is clinic-admin only, atomic and conflict-checked", async () => {
    const f = await buildFixture();
    const mk = (mobile: string) =>
      createSerialEntry(
        f.db,
        serialParams({
          actor: f.attendant,
          doctorId: f.doctorId,
          patientMobile: mobile,
          patientAddress: "",
        }),
      );

    const a = await mk("01711111101");
    const b = await mk("01711111102");
    expect(a.data?.serialNumber).toBe(1);
    expect(b.data?.serialNumber).toBe(2);

    const denied = await changeSerialNumber(f.db, {
      actor: f.attendant,
      appointmentId: b.data!.appointment.id,
      serialNumber: 5,
    });
    expect(denied.ok).toBe(false);

    const changed = await changeSerialNumber(f.db, {
      actor: f.clinicAdmin,
      appointmentId: b.data!.appointment.id,
      serialNumber: 5,
    });
    expect(changed.ok).toBe(true);
    expect(changed.data?.serialNumber).toBe(5);

    const conflict = await changeSerialNumber(f.db, {
      actor: f.clinicAdmin,
      appointmentId: a.data!.appointment.id,
      serialNumber: 5,
    });
    expect(conflict.ok).toBe(false);

    // future allocations avoid the manually-assigned number
    const c = await mk("01711111103");
    expect(c.data?.serialNumber).toBe(6);
  });

  it("moves serials up and down by swapping adjacent active queue positions", async () => {
    const f = await buildFixture();
    const make = (mobile: string) =>
      createSerialEntry(
        f.db,
        serialParams({
          actor: f.clinicAdmin,
          doctorId: f.doctorId,
          patientType: "new",
          patientMobile: mobile,
        }),
      );
    const first = await make("01711111201");
    const second = await make("01711111202");
    const third = await make("01711111203");

    const denied = await moveSerialNumber(f.db, {
      actor: f.superAdmin,
      appointmentId: second.data!.appointment.id,
      direction: "up",
    });
    expect(denied.ok).toBe(false);

    const movedUp = await moveSerialNumber(f.db, {
      actor: f.clinicAdmin,
      appointmentId: third.data!.appointment.id,
      direction: "up",
    });
    expect(movedUp.ok).toBe(true);
    expect(movedUp.data?.serialNumber).toBe(2);

    const afterUp = await listSerials(f.db, f.clinicAdmin, {
      date: "2026-10-09",
      doctorId: f.doctorId,
      patientType: "new",
    });
    expect(afterUp.find((row) => row.id === second.data!.appointment.id)?.serialNumber).toBe(3);

    const movedDown = await moveSerialNumber(f.db, {
      actor: f.attendant,
      appointmentId: third.data!.appointment.id,
      direction: "down",
    });
    expect(movedDown.ok).toBe(true);
    expect(movedDown.data?.serialNumber).toBe(3);

    const firstCannotMoveUp = await moveSerialNumber(f.db, {
      actor: f.clinicAdmin,
      appointmentId: first.data!.appointment.id,
      direction: "up",
    });
    expect(firstCannotMoveUp.ok).toBe(false);
  });

  it("rejects manual change onto a cancelled serial number", async () => {
    const f = await buildFixture();
    const mk = (mobile: string) =>
      createSerialEntry(
        f.db,
        serialParams({
          actor: f.clinicAdmin,
          doctorId: f.doctorId,
          patientMobile: mobile,
          patientAddress: "",
        }),
      );

    const a = await mk("01711111101");
    await mk("01711111102");
    await cancelSerialEntry(f.db, {
      actor: f.clinicAdmin,
      appointmentId: a.data!.appointment.id,
      reason: "",
    });

    const rows = await listSerials(f.db, f.clinicAdmin, {
      date: "2026-10-09",
      doctorId: f.doctorId,
    });
    const second = rows.find((r) => r.serialNumber === 2)!;

    const attempt = await changeSerialNumber(f.db, {
      actor: f.clinicAdmin,
      appointmentId: second.id,
      serialNumber: 1, // cancelled — must not be reused
    });
    expect(attempt.ok).toBe(false);
  });

  it("cancellation is idempotent-safe and keeps the audit record", async () => {
    const f = await buildFixture();
    const created = await createSerialEntry(
      f.db,
      serialParams({ actor: f.attendant, doctorId: f.doctorId }),
    );

    const first = await cancelSerialEntry(f.db, {
      actor: f.attendant,
      appointmentId: created.data!.appointment.id,
      reason: "First reason",
    });
    expect(first.ok).toBe(true);
    expect(first.data?.status).toBe("cancelled");

    const second = await cancelSerialEntry(f.db, {
      actor: f.attendant,
      appointmentId: created.data!.appointment.id,
      reason: "Second",
    });
    expect(second.ok).toBe(false); // already cancelled

    const { listAuditForEntity } = await import("@/lib/audit");
    const audit = await listAuditForEntity(
      f.db,
      "appointment",
      created.data!.appointment.id,
    );
    const actions = audit.map((a) => a.action);
    expect(actions).toContain("create_serial");
    expect(actions).toContain("cancel_serial");
  });

  it("db constraint prevents duplicate serial numbers even under raw inserts", async () => {
    const f = await buildFixture();
    const created = await createSerialEntry(
      f.db,
      serialParams({ actor: f.clinicAdmin, doctorId: f.doctorId }),
    );

    await expect(
      f.db.execute(sql.raw(`
        INSERT INTO appointments (clinic_id, doctor_id, patient_id, appointment_date, patient_type, serial_number, is_reference)
        VALUES ('${f.clinicId}', '${f.doctorId}', '${created.data!.patient.id}', '2026-10-09', 'new', 1, false)
      `)),
    ).rejects.toThrow();
  });
});
