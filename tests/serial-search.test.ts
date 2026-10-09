import { describe, expect, it } from "vitest";
import { matchesPatientSearch } from "@/lib/serials";

const patient = {
  patientName: "Rahim Uddin",
  patientMobile: "8801712345678",
  patientMobileDisplay: "01712345678",
};

describe("patient serial search", () => {
  it("matches patient names without case sensitivity", () => {
    expect(matchesPatientSearch(patient, "rahim")).toBe(true);
  });

  it("matches the displayed or normalized mobile number", () => {
    expect(matchesPatientSearch(patient, "017123")).toBe(true);
    expect(matchesPatientSearch(patient, "+88017123")).toBe(true);
  });

  it("matches Bangla mobile digits", () => {
    expect(matchesPatientSearch(patient, "০১৭১২৩")).toBe(true);
  });

  it("does not match unrelated searches and treats blank input as all rows", () => {
    expect(matchesPatientSearch(patient, "Karim")).toBe(false);
    expect(matchesPatientSearch(patient, "   ")).toBe(true);
  });
});
