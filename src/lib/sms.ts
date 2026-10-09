/**
 * SMS template rendering.
 *
 * Templates are plain text with {{variable}} placeholders. Rendering is pure
 * string substitution — template content is NEVER executed. Unknown variables
 * are left untouched (so typos are visible) and never throw.
 */
import type { PatientType } from "@/db/schema";
import { formatDateWithDay } from "@/lib/utils";

export const SMS_VARIABLES = [
  "patient_name",
  "patient_mobile",
  "patient_address",
  "patient_type",
  "serial_number",
  "serial_number_bangla",
  "appointment_date",
  "appointment_date_bangla",
  "doctor_name",
  "clinic_name",
  "reference_details",
] as const;

export type SmsVariable = (typeof SMS_VARIABLES)[number];

export interface SmsRenderInput {
  patient_name: string;
  patient_mobile: string;
  patient_address: string;
  patient_type: string;
  serial_number: string;
  serial_number_bangla: string;
  appointment_date: string;
  appointment_date_bangla: string;
  doctor_name: string;
  clinic_name: string;
  reference_details: string;
}

/** Used when a doctor has no custom template. */
export const DEFAULT_SMS_TEMPLATE = `{{clinic_name}} — {{doctor_name}}
Dear {{patient_name}}, your appointment date is {{appointment_date}}. Serial: {{serial_number}}.
Thank you.`;

export const DEFAULT_NEW_PATIENT_SMS_TEMPLATE = `{{clinic_name}} — {{doctor_name}}
Dear {{patient_name}}, welcome. Your appointment date is {{appointment_date}}. Serial: {{serial_number}}.
Thank you.`;

export const DEFAULT_OLD_PATIENT_SMS_TEMPLATE = `{{clinic_name}} — {{doctor_name}}
Dear {{patient_name}}, your appointment date is {{appointment_date}}. Serial: {{serial_number}}.
Thank you for choosing us again.`;

export const REFERENCE_SERIAL_LABEL = "Not applicable";

const VARIABLE_PATTERN = /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/g;
const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

function toBanglaDigits(value: string): string {
  return value.replace(/\d/g, (digit) => BANGLA_DIGITS[Number(digit)]);
}

function formatBanglaAppointmentDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;

  const [, year, month, day] = match;
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), 12),
  );
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return isoDate;
  }

  const parts = new Intl.DateTimeFormat("bn-BD-u-nu-beng", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("weekday")}, ${part("day")} ${part("month")} ${part("year")}`;
}

export function renderSmsTemplate(
  template: string,
  input: Partial<SmsRenderInput>,
): string {
  return template.replace(VARIABLE_PATTERN, (match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(input, name)) {
      const value = input[name as SmsVariable];
      return value ?? "";
    }
    return match; // unknown variable: keep as-is, never throw
  });
}

/** Lists unknown placeholders found in a template (for editor warnings). */
export function unknownVariables(template: string): string[] {
  const known = new Set<string>(SMS_VARIABLES);
  const found = new Set<string>();
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    const name = match[1];
    if (!known.has(name)) found.add(name);
  }
  return [...found];
}

export function patientTypeLabel(type: PatientType): string {
  return type === "new" ? "New patient" : "Old patient";
}

/** Builds the render input for a real appointment. */
export function buildSmsInput(params: {
  patientName: string;
  patientMobile: string;
  patientAddress: string;
  patientType: PatientType;
  serialNumber: number | null;
  appointmentDate: string;
  doctorName: string;
  clinicName: string;
  referenceDetails: string | null;
  isReference: boolean;
}): SmsRenderInput {
  return {
    patient_name: params.patientName,
    patient_mobile: params.patientMobile,
    patient_address: params.patientAddress,
    patient_type: patientTypeLabel(params.patientType),
    serial_number: params.isReference
      ? REFERENCE_SERIAL_LABEL
      : params.serialNumber != null
        ? String(params.serialNumber)
        : "",
    serial_number_bangla: params.isReference
      ? "প্রযোজ্য নয়"
      : params.serialNumber != null
        ? toBanglaDigits(String(params.serialNumber))
        : "",
    appointment_date: formatDateWithDay(params.appointmentDate),
    appointment_date_bangla: formatBanglaAppointmentDate(
      params.appointmentDate,
    ),
    doctor_name: params.doctorName,
    clinic_name: params.clinicName,
    reference_details: params.referenceDetails ?? "",
  };
}

/**
 * Sample data for the live preview in the template editor.
 * Clearly fictional — never real patient data.
 */
export function sampleSmsInput(): SmsRenderInput {
  return {
    patient_name: "Rahim Uddin",
    patient_mobile: "01712345678",
    patient_address: "Mirpur-10, Dhaka",
    patient_type: "New patient",
    serial_number: "3",
    serial_number_bangla: "৩",
    appointment_date: "9 October 2026 (Friday)",
    appointment_date_bangla: "শুক্রবার, ৯ অক্টোবর ২০২৬",
    doctor_name: "Dr. Kamal Uddin",
    clinic_name: "Demo Medical",
    reference_details: "Dr. Selim Mia",
  };
}

/**
 * Native SMS handoff link. The app NEVER sends SMS itself — it opens the
 * device's SMS application with a prefilled body.
 *
 * `sms:` URI conventions differ slightly per platform; `?&body=` is accepted
 * by iOS and most Android browsers.
 */
export function buildSmsLink(dialNumber: string, message: string): string {
  return `sms:${dialNumber}?&body=${encodeURIComponent(message)}`;
}
