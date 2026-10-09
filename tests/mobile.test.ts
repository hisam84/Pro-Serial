import { describe, expect, it } from "vitest";
import { normalizeMobile, isBdMobile } from "@/lib/mobile";

describe("mobile normalization", () => {
  it("normalizes BD mobile formats to 8801XXXXXXXXX", () => {
    for (const input of ["01712345678", "+8801712345678", "8801712345678", "1712345678", "01712-345678"]) {
      const r = normalizeMobile(input);
      expect(r.ok, input).toBe(true);
      expect(r.normalized, input).toBe("8801712345678");
      expect(r.dial, input).toBe("+8801712345678");
    }
  });

  it("preserves the display value as typed", () => {
    const r = normalizeMobile(" 01712-345678 ");
    expect(r.display).toBe("01712-345678");
  });

  it("rejects empty and too-short numbers", () => {
    expect(normalizeMobile("").ok).toBe(false);
    expect(normalizeMobile("12345").ok).toBe(false);
    expect(normalizeMobile("0171234567").ok).toBe(false); // 10 digits, invalid BD
  });

  it("accepts generic international numbers 7-15 digits", () => {
    const r = normalizeMobile("00442071234567");
    expect(r.ok).toBe(true);
    expect(r.normalized).toBe("00442071234567");
    expect(isBdMobile(r.normalized)).toBe(false);
  });

  it("classifies Bangladesh mobiles", () => {
    expect(isBdMobile("8801712345678")).toBe(true);
    expect(isBdMobile("8802712345678")).toBe(false);
  });
});
