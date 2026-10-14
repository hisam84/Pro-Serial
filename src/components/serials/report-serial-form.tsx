"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import {
  createSerialAction,
  lookupPatientAction,
  type CreateSerialState,
  type PatientSuggestion,
} from "@/app/actions/serials";
import type { SmsPayload } from "@/lib/serial-client";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SearchIcon, UserIcon } from "@/components/ui/icons";
import { SmsModal } from "./sms-modal";
import { cn } from "@/lib/utils";
import type { DoctorOption } from "./serial-form";

export function NewReportSerialForm({
  doctors,
  defaultDoctorId,
  defaultDate,
  requireAddress,
  initialPatientType = "report_new",
  initialPatientName = "",
  initialPatientMobile = "",
  initialPatientAddress = "",
}: {
  doctors: DoctorOption[];
  defaultDoctorId: string;
  defaultDate: string;
  requireAddress: boolean;
  initialPatientType?: "report_new" | "report_old";
  initialPatientName?: string;
  initialPatientMobile?: string;
  initialPatientAddress?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    CreateSerialState,
    FormData
  >(createSerialAction, {});
  const [patientType, setPatientType] = useState<"report_new" | "report_old">(
    initialPatientType === "report_old" ? "report_old" : "report_new",
  );
  const [suggestions, setSuggestions] = useState<PatientSuggestion[]>([]);
  const [sms, setSms] = useState<SmsPayload | null>(null);
  const [lookupPending, startLookup] = useTransition();

  async function handleLookup() {
    const input = document.getElementById("patientMobile") as HTMLInputElement | null;
    const mobile = input?.value?.trim();
    if (!mobile) return;
    startLookup(async () => {
      const fd = new FormData();
      fd.set("patientMobile", mobile);
      const res = await lookupPatientAction(fd);
      setSuggestions(res.found ?? []);
    });
  }

  function applySuggestion(s: PatientSuggestion) {
    const nameEl = document.getElementById("patientName") as HTMLInputElement | null;
    const addrEl = document.getElementById("patientAddress") as HTMLInputElement | null;
    if (nameEl && !nameEl.value.trim()) nameEl.value = s.name;
    if (addrEl && !addrEl.value.trim()) addrEl.value = s.address;
    setSuggestions([]);
  }

  const created = state.ok && state.created ? state.created : null;
  const showSms = Boolean(created && !state.error);
  if (created && showSms && !sms) {
    setSms(created.sms);
  }

  return (
    <>
      <form action={formAction} className="space-y-4">
        {state.error && <Banner type="error">{state.error}</Banner>}

        <Field label="Report patient type" required>
          <div
            role="radiogroup"
            aria-label="Report patient type"
            className="grid grid-cols-2 gap-2 rounded-xl border border-amber-300 bg-amber-50/70 p-1.5"
          >
            <button
              type="button"
              role="radio"
              aria-checked={patientType === "report_new"}
              onClick={() => setPatientType("report_new")}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg p-2.5 text-center transition-all",
                patientType === "report_new"
                  ? "bg-white text-amber-900 shadow-sm ring-1 ring-amber-400"
                  : "text-amber-800/80 hover:bg-white/60",
              )}
            >
              <span className="text-[14px] font-bold">Report (New patient)</span>
              <span className="text-[11px] text-amber-700">নতুন রোগী রিপোর্ট দেখাতে এসেছে</span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={patientType === "report_old"}
              onClick={() => setPatientType("report_old")}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg p-2.5 text-center transition-all",
                patientType === "report_old"
                  ? "bg-white text-orange-900 shadow-sm ring-1 ring-orange-400"
                  : "text-orange-800/80 hover:bg-white/60",
              )}
            >
              <span className="text-[14px] font-bold">Report (Old patient)</span>
              <span className="text-[11px] text-orange-700">পুরাতন রোগী রিপোর্ট দেখাতে এসেছে</span>
            </button>
          </div>
          <input type="hidden" name="patientType" value={patientType} />
        </Field>

        <Field
          label="Doctor"
          htmlFor="doctorId"
          required
          error={state.fieldErrors?.doctorId}
        >
          <Select
            id="doctorId"
            name="doctorId"
            defaultValue={defaultDoctorId}
            required
            error={Boolean(state.fieldErrors?.doctorId)}
          >
            {doctors.length === 0 && <option value="">No doctors</option>}
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.specialty ? ` — ${d.specialty}` : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Appointment date"
          htmlFor="appointmentDate"
          required
          error={state.fieldErrors?.appointmentDate}
        >
          <Input
            id="appointmentDate"
            name="appointmentDate"
            type="date"
            defaultValue={defaultDate}
            required
            error={Boolean(state.fieldErrors?.appointmentDate)}
          />
        </Field>

        {/* Mobile + Search */}
        <div>
          <Field
            label="Mobile number"
            htmlFor="patientMobile"
            required
            error={state.fieldErrors?.patientMobile}
            hint="Enter 11 digits (e.g. 017xxxxxxxx). Tap “Find” to reuse previous details."
          >
            <div className="flex gap-2">
              <Input
                id="patientMobile"
                name="patientMobile"
                type="tel"
                defaultValue={initialPatientMobile}
                placeholder="01712345678"
                required
                autoComplete="off"
                onBlur={handleLookup}
                error={Boolean(state.fieldErrors?.patientMobile)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleLookup}
                loading={lookupPending}
                className="shrink-0"
              >
                <SearchIcon size={16} />
                Find
              </Button>
            </div>
          </Field>
        </div>

        {suggestions.length > 0 && (
          <Banner type="info" title="Existing patient record found">
            <ul className="mt-1 space-y-1.5">
              {suggestions.map((s, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between gap-2 rounded-md bg-white/70 px-2.5 py-1.5"
                >
                  <span className="min-w-0 text-[13px]">
                    <UserIcon size={14} className="mr-1 inline text-amber-600" />
                    <span className="font-medium">{s.name}</span>
                    {s.address && (
                      <span className="text-slate-500"> — {s.address}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="shrink-0 rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
                  >
                    Use
                  </button>
                </li>
              ))}
            </ul>
          </Banner>
        )}

        <Field
          label="Patient name"
          htmlFor="patientName"
          required
          error={state.fieldErrors?.patientName}
        >
          <Input
            id="patientName"
            name="patientName"
            defaultValue={initialPatientName}
            placeholder="Enter the patient's full name"
            required
            autoComplete="off"
            error={Boolean(state.fieldErrors?.patientName)}
          />
        </Field>

        <Field
          label="Address"
          htmlFor="patientAddress"
          required={requireAddress}
          error={state.fieldErrors?.patientAddress}
          hint={requireAddress ? undefined : "Optional"}
        >
          <Input
            id="patientAddress"
            name="patientAddress"
            defaultValue={initialPatientAddress}
            placeholder="Enter address"
            error={Boolean(state.fieldErrors?.patientAddress)}
          />
        </Field>

        <Field label="Notes (optional)" htmlFor="notes" error={state.fieldErrors?.notes}>
          <Textarea
            id="notes"
            name="notes"
            rows={2}
            placeholder="e.g. Blood test and X-ray report review"
            className="text-[14px]"
            error={Boolean(state.fieldErrors?.notes)}
          />
        </Field>

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => router.back()}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            loading={pending}
            className="flex-[2] bg-amber-600 hover:bg-amber-700 text-white"
          >
            Save report serial
          </Button>
        </div>
      </form>

      {sms && created && (
        <SmsModal
          open
          onClose={() => {
            setSms(null);
            router.push(
              `/report-serials?date=${encodeURIComponent(created.appointmentDate)}&doctorId=${encodeURIComponent(created.doctorId)}`,
            );
            router.refresh();
          }}
          payload={sms}
        />
      )}
    </>
  );
}
