import { describe, expect, it } from "vitest";
import {
  buildSmsInput,
  buildSmsLink,
  buildWhatsAppLink,
  DEFAULT_NEW_PATIENT_SMS_TEMPLATE,
  DEFAULT_OLD_PATIENT_SMS_TEMPLATE,
  DEFAULT_SMS_TEMPLATE,
  REFERENCE_SERIAL_LABEL,
  renderSmsTemplate,
  sampleSmsInput,
  unknownVariables,
} from "@/lib/sms";
import { effectiveSmsTemplate } from "@/lib/doctors";

describe("SMS template rendering", () => {
  it("selects the template for the patient's type and uses that type's default", () => {
    const templates = {
      smsTemplateNew: "New: {{patient_name}}",
      smsTemplateOld: "Returning: {{patient_name}}",
    };

    expect(effectiveSmsTemplate(templates, "new")).toBe(
      "New: {{patient_name}}",
    );
    expect(effectiveSmsTemplate(templates, "old")).toBe(
      "Returning: {{patient_name}}",
    );
    expect(effectiveSmsTemplate({}, "new")).toBe(
      DEFAULT_NEW_PATIENT_SMS_TEMPLATE,
    );
    expect(effectiveSmsTemplate({}, "old")).toBe(
      DEFAULT_OLD_PATIENT_SMS_TEMPLATE,
    );
  });

  it("renders all supported variables", () => {
    const input = sampleSmsInput();
    const template = [
      "{{patient_name}}",
      "{{patient_mobile}}",
      "{{patient_address}}",
      "{{patient_type}}",
      "{{serial_number}}",
      "{{serial_number_bangla}}",
      "{{appointment_date}}",
      "{{appointment_date_bangla}}",
      "{{doctor_name}}",
      "{{clinic_name}}",
      "{{reference_details}}",
    ].join("|");
    const out = renderSmsTemplate(template, input);
    expect(out).toBe(
      [
        input.patient_name,
        input.patient_mobile,
        input.patient_address,
        input.patient_type,
        input.serial_number,
        input.serial_number_bangla,
        input.appointment_date,
        input.appointment_date_bangla,
        input.doctor_name,
        input.clinic_name,
        input.reference_details,
      ].join("|"),
    );
  });

  it("handles unknown variables safely (no throw, left visible)", () => {
    const out = renderSmsTemplate("Hello {{unknown_var}} {{patient_name}}", {
      patient_name: "Karim",
    });
    expect(out).toBe("Hello {{unknown_var}} Karim");
    expect(unknownVariables("{{patient_name}} {{nope}} {{__proto__}}")).toEqual([
      "nope",
      "__proto__",
    ]);
  });

  it("never executes template content", () => {
    const evil = "{{patient_name}} ${process.exit(1)} {{constructor}}";
    const out = renderSmsTemplate(evil, { patient_name: "X" });
    expect(out).toBe("X ${process.exit(1)} {{constructor}}");
  });

  it("renders reference serial_number as 'Not applicable'", () => {
    const input = buildSmsInput({
      patientName: "Test",
      patientMobile: "01711111111",
      patientAddress: "",
      patientType: "new",
      serialNumber: null,
      appointmentDate: "2026-10-09",
      doctorName: "Doc",
      clinicName: "Clinic",
      referenceDetails: "Dr. X",
      isReference: true,
    });
    expect(input.serial_number).toBe(REFERENCE_SERIAL_LABEL);
    expect(input.serial_number_bangla).toBe("প্রযোজ্য নয়");
  });

  it("includes the weekday in appointment date variables and renders Bengali values", () => {
    const input = buildSmsInput({
      patientName: "Test",
      patientMobile: "01711111111",
      patientAddress: "",
      patientType: "new",
      serialNumber: 27,
      appointmentDate: "2026-10-09",
      doctorName: "Doc",
      clinicName: "Clinic",
      referenceDetails: null,
      isReference: false,
    });

    expect(input.appointment_date).toBe("9 October 2026 (Friday)");
    expect(input.appointment_date_bangla).toBe("শুক্রবার, ৯ অক্টোবর ২০২৬");
    expect(input.serial_number).toBe("27");
    expect(input.serial_number_bangla).toBe("২৭");
  });

  it("renders regular serial numbers numerically", () => {
    const input = buildSmsInput({
      patientName: "Test",
      patientMobile: "01711111111",
      patientAddress: "",
      patientType: "old",
      serialNumber: 7,
      appointmentDate: "2026-10-09",
      doctorName: "Doc",
      clinicName: "Clinic",
      referenceDetails: null,
      isReference: false,
    });
    expect(input.serial_number).toBe("7");
    const msg = renderSmsTemplate(DEFAULT_SMS_TEMPLATE, input);
    expect(msg).toContain("Serial: 7");
    expect(msg).toContain("Test");
    expect(msg).toContain("Doc");
    expect(msg).toContain("Clinic");
  });

  it("tolerates whitespace inside placeholders", () => {
    const out = renderSmsTemplate("{{ patient_name }}", { patient_name: "A" });
    expect(out).toBe("A");
  });

  it("builds sms: links with URL-encoded bodies", () => {
    const link = buildSmsLink("+8801712345678", "Serial: 1\nThank you");
    expect(link.startsWith("sms:+8801712345678?&body=")).toBe(true);
    expect(link).toContain(encodeURIComponent("Serial: 1\nThank you"));
  });

  it("opens WhatsApp with the template message and normalized phone digits", () => {
    const message = "Serial: ২\nশুক্রবার, ৯ অক্টোবর";
    expect(buildWhatsAppLink("+880 1712-345678", message)).toBe(
      `https://wa.me/8801712345678?text=${encodeURIComponent(message)}`,
    );
  });

  it("does not build a WhatsApp link for invalid mobile numbers", () => {
    expect(buildWhatsAppLink("123", "Hello")).toBeNull();
  });
});
