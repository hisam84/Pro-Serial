/**
 * Mobile number handling for Bangladesh-centric clinics.
 * - Display value is preserved as typed.
 * - Normalized form is "8801XXXXXXXXX" for BD mobiles, digits-only otherwise.
 * - Dialable form is "+8801XXXXXXXXX" for BD mobiles.
 */

export interface MobileResult {
  ok: boolean;
  /** Digits-only normalized number used for matching/deduplication. */
  normalized: string;
  /** As typed by the user — shown in UI and used for sms: links. */
  display: string;
  /** Best-effort dialable number with country code. */
  dial: string;
  error?: string;
}

const BD_MOBILE = /^(?:880|0)?1[3-9]\d{8}$/;
const BD_LOOKING = /^(?:\+?880|0)?1\d+$/;

export function normalizeMobile(input: string): MobileResult {
  const display = input.trim();
  const cleaned = display.replace(/[\s\-().]/g, "");
  const digits = cleaned.replace(/\D/g, "");
  const error = "Enter a valid mobile number (e.g. 01712345678).";

  if (!digits) {
    return { ok: false, normalized: "", display, dial: "", error };
  }

  // Numbers that look like Bangladesh mobiles must match the BD pattern exactly
  // (catches typos like a missing digit). Other numbers use generic rules.
  if (BD_LOOKING.test(digits) || BD_MOBILE.test(digits)) {
    if (!BD_MOBILE.test(digits)) {
      return { ok: false, normalized: digits, display, dial: "", error };
    }
    // digits: 01… → keep; 8801… → 01…; 1… → 01…
    const local =
      digits.length === 11
        ? digits
        : digits.length === 13
          ? `0${digits.slice(3)}`
          : `0${digits}`;
    const normalized = `88${local}`; // 8801XXXXXXXXX
    return {
      ok: true,
      normalized,
      display,
      dial: `+${normalized}`,
    };
  }

  // Generic international / landline fallback: 7–15 digits.
  if (digits.length < 7 || digits.length > 15) {
    return { ok: false, normalized: digits, display, dial: digits, error };
  }
  return {
    ok: true,
    normalized: digits,
    display,
    dial: cleaned.startsWith("+") ? `+${digits}` : digits,
  };
}

/** Detects whether a string is a Bangladesh mobile (for sms: convenience). */
export function isBdMobile(normalized: string): boolean {
  return /^8801[3-9]\d{8}$/.test(normalized);
}
