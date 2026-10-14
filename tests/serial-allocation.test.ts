import { describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { appointments } from "@/db/schema";
import {
  cancelSerialEntry,
  changeSerialNumber,
  completeSerialEntry,
  createSerialEntry,
  groupSerialRowsForDisplay,
  listSerials,
  moveSerialNumber,
  setReportSubmission,
  summarizeCounts,
  updateSerialEntry,
} from "@/lib/serials";
import { buildFixture, serialParams } from "./helpers";

describe("serial allocation rules", () => {
  it("groups completed serials and references after active entries and before cancelled", () => {
    const rows = [
      { id: "active-reference", isReference: true, status: "active" },
      { id: "completed-serial", isReference: false, status: "completed" },
      { id: "cancelled-reference", isReference: true, status: "cancelled" },
      { id: "active-serial", isReference: false, status: "active" },
      { id: "completed-reference", isReference: true, status: "completed" },
      { id: "cancelled-serial", isReference: false, status: "cancelled" },
    ] as const;

    const groups = groupSerialRowsForDisplay([...rows]);
    expect(
      [
        ...groups.activeReferences,
        ...groups.activeSerials,
        ...groups.completed,
        ...groups.cancelled,
      ].map((row) => row.id),
    ).toEqual([
      "active-reference",
      "active-serial",
      "completed-serial",
      "completed-reference",
      "cancelled-reference",
      "cancelled-serial",
    ]);
  });

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

  it("gives separate sequences for report patients (report_new and report_old) and counts them accurately", async () => {
    const f = await buildFixture();

    const rNew = await createSerialEntry(
      f.db,
      serialParams({
        actor: f.attendant,
        doctorId: f.doctorId,
        patientType: "new",
        patientName: "New 1",
        patientMobile: "01711111101",
      }),
    );
    const rOld = await createSerialEntry(
      f.db,
      serialParams({
        actor: f.attendant,
        doctorId: f.doctorId,
        patientType: "old",
        patientName: "Old 1",
        patientMobile: "01711111102",
      }),
    );
    const rRepNew1 = await createSerialEntry(
      f.db,
      serialParams({
        actor: f.attendant,
        doctorId: f.doctorId,
        patientType: "report_new",
        patientName: "Report New 1",
        patientMobile: "01711111103",
      }),
    );
    const rRepOld1 = await createSerialEntry(
      f.db,
      serialParams({
        actor: f.attendant,
        doctorId: f.doctorId,
        patientType: "report_old",
        patientName: "Report Old 1",
        patientMobile: "01711111104",
      }),
    );
    const rRepNew2 = await createSerialEntry(
      f.db,
      serialParams({
        actor: f.attendant,
        doctorId: f.doctorId,
        patientType: "report_new",
        patientName: "Report New 2",
        patientMobile: "01711111105",
      }),
    );
    const rRepOld2 = await createSerialEntry(
      f.db,
      serialParams({
        actor: f.attendant,
        doctorId: f.doctorId,
        patientType: "report_old",
        patientName: "Report Old 2",
        patientMobile: "01711111106",
      }),
    );

    // Each patient type sequence starts at 1 independently!
    expect(rNew.data?.serialNumber).toBe(1);
    expect(rOld.data?.serialNumber).toBe(1);
    expect(rRepNew1.data?.serialNumber).toBe(1);
    expect(rRepOld1.data?.serialNumber).toBe(1);

    // Increments sequentially within its own type
    expect(rRepNew2.data?.serialNumber).toBe(2);
    expect(rRepOld2.data?.serialNumber).toBe(2);

    const serials = await listSerials(f.db, f.attendant, {
      date: "2026-10-09",
      doctorId: f.doctorId,
    });
    const counts = summarizeCounts(serials);
    expect(counts.activeNew).toBe(1);
    expect(counts.activeOld).toBe(1);
    expect(counts.activeReportNew).toBe(2);
    expect(counts.activeReportOld).toBe(2);
    expect(counts.activeReport).toBe(4);
    expect(counts.activeTotal).toBe(6);
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

  it("marks a visit complete, updates counts, and keeps the audit record", async () => {
    const f = await buildFixture();
    const created = await createSerialEntry(
      f.db,
      serialParams({ actor: f.attendant, doctorId: f.doctorId }),
    );
    const appointmentId = created.data!.appointment.id;

    const result = await completeSerialEntry(f.db, {
      actor: f.attendant,
      appointmentId,
    });
    expect(result.ok).toBe(true);
    expect(result.data?.status).toBe("completed");
    expect(
      summarizeCounts(
        await listSerials(f.db, f.clinicAdmin, {
          date: "2026-10-09",
          doctorId: f.doctorId,
        }),
      ),
    ).toMatchObject({ activeNew: 0, completed: 1, activeTotal: 0 });

    const repeated = await completeSerialEntry(f.db, {
      actor: f.attendant,
      appointmentId,
    });
    expect(repeated.ok).toBe(false);
    expect(
      (
        await cancelSerialEntry(f.db, {
          actor: f.attendant,
          appointmentId,
          reason: "",
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await moveSerialNumber(f.db, {
          actor: f.attendant,
          appointmentId,
          direction: "down",
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await updateSerialEntry(f.db, {
          actor: f.attendant,
          appointmentId,
          patientName: "Edited patient",
          patientMobile: "01711111102",
          patientAddress: "",
          referenceDetails: "",
          notes: "",
        })
      ).ok,
    ).toBe(false);

    const { listAuditForEntity } = await import("@/lib/audit");
    const audit = await listAuditForEntity(f.db, "appointment", appointmentId);
    expect(audit.map((entry) => entry.action)).toContain("complete_serial");
  });

  it("does not complete a cancelled serial", async () => {
    const f = await buildFixture();
    const created = await createSerialEntry(
      f.db,
      serialParams({ actor: f.attendant, doctorId: f.doctorId }),
    );
    const appointmentId = created.data!.appointment.id;
    await cancelSerialEntry(f.db, {
      actor: f.attendant,
      appointmentId,
      reason: "",
    });

    const result = await completeSerialEntry(f.db, {
      actor: f.attendant,
      appointmentId,
    });
    expect(result.ok).toBe(false);
  });

  it("tracks report submission independently from visit completion", async () => {
    const f = await buildFixture();
    const created = await createSerialEntry(
      f.db,
      serialParams({ actor: f.attendant, doctorId: f.doctorId }),
    );
    const appointmentId = created.data!.appointment.id;
    await completeSerialEntry(f.db, {
      actor: f.attendant,
      appointmentId,
    });

    const completedRow = await listSerials(f.db, f.clinicAdmin, {
      date: "2026-10-09",
      doctorId: f.doctorId,
    });
    expect(completedRow[0]?.reportSubmitted).toBe(false);
    expect(
      await listSerials(f.db, f.clinicAdmin, {
        date: "2026-10-09",
        doctorId: f.doctorId,
        reportSubmission: "not_submitted",
      }),
    ).toHaveLength(1);

    const submitted = await setReportSubmission(f.db, {
      actor: f.attendant,
      appointmentId,
      submitted: true,
    });
    expect(submitted.ok).toBe(true);
    expect(submitted.data?.status).toBe("completed");
    expect(submitted.data?.reportSubmitted).toBe(true);
    expect(submitted.data?.reportSubmittedAt).toBeInstanceOf(Date);
    expect(
      await listSerials(f.db, f.clinicAdmin, {
        date: "2026-10-09",
        doctorId: f.doctorId,
        reportSubmission: "submitted",
      }),
    ).toHaveLength(1);

    const reverted = await setReportSubmission(f.db, {
      actor: f.attendant,
      appointmentId,
      submitted: false,
    });
    expect(reverted.ok).toBe(true);
    expect(reverted.data?.status).toBe("completed");
    expect(reverted.data?.reportSubmitted).toBe(false);
    expect(reverted.data?.reportSubmittedAt).toBeNull();

    const { listAuditForEntity } = await import("@/lib/audit");
    const audit = await listAuditForEntity(f.db, "appointment", appointmentId);
    expect(audit.map((entry) => entry.action)).toContain("mark_report_submitted");
    expect(audit.map((entry) => entry.action)).toContain(
      "mark_report_not_submitted",
    );
  });

  it("does not allow report status changes on cancelled serials", async () => {
    const f = await buildFixture();
    const created = await createSerialEntry(
      f.db,
      serialParams({ actor: f.attendant, doctorId: f.doctorId }),
    );
    const appointmentId = created.data!.appointment.id;
    await cancelSerialEntry(f.db, {
      actor: f.attendant,
      appointmentId,
      reason: "",
    });

    const result = await setReportSubmission(f.db, {
      actor: f.attendant,
      appointmentId,
      submitted: true,
    });
    expect(result.ok).toBe(false);
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

  it("allows creating and editing report serials with optional mobile while regular serials require it", async () => {
    const f = await buildFixture();

    // Regular serial fails without phone number
    const regFail = await createSerialEntry(
      f.db,
      serialParams({
        actor: f.attendant,
        doctorId: f.doctorId,
        patientType: "new",
        patientName: "Regular Patient",
        patientMobile: "",
      }),
    );
    expect(regFail.ok).toBe(false);
    expect(regFail.error).toContain("Mobile number is required");

    // Report serial succeeds without phone number (report_new)
    const repNew = await createSerialEntry(
      f.db,
      serialParams({
        actor: f.attendant,
        doctorId: f.doctorId,
        patientType: "report_new",
        patientName: "Report Patient New",
        patientMobile: "",
      }),
    );
    expect(repNew.ok).toBe(true);
    expect(repNew.data?.patient.mobileDisplay).toBe("");
    expect(repNew.data?.serialNumber).toBe(1);

    // Report serial succeeds without phone number (report_old)
    const repOld = await createSerialEntry(
      f.db,
      serialParams({
        actor: f.attendant,
        doctorId: f.doctorId,
        patientType: "report_old",
        patientName: "Report Patient Old",
        patientMobile: "   ",
      }),
    );
    expect(repOld.ok).toBe(true);
    expect(repOld.data?.patient.mobileDisplay).toBe("");
    expect(repOld.data?.serialNumber).toBe(1);

    // Update report serial to keep mobile empty
    const updated = await updateSerialEntry(f.db, {
      actor: f.attendant,
      appointmentId: repNew.data!.appointment.id,
      patientName: "Report Patient Renamed",
      patientMobile: "",
      patientAddress: "",
      referenceDetails: "",
      notes: "Reviewed tests",
    });
    expect(updated.ok).toBe(true);
    expect(updated.data?.patientMobileDisplay).toBe("");
  });
});
