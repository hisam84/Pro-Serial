"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import {
  createSerialAction,
  lookupPatientAction,
  updateSerialAction,
  type CreateSerialState,
  type PatientSuggestion,
} from "@/app/actions/serials";
import type { SerialClientRow, SmsPayload } from "@/lib/serial-client";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { SearchIcon, UserIcon } from "@/components/ui/icons";
import { SmsModal } from "./sms-modal";
import { cn } from "@/lib/utils";

export interface DoctorOption {
  id: string;
  name: string;
  specialty: string;
}

/** Patient type segmented control (New / Old). */
function PatientTypeTabs({
  value,
  onChange,
}: {
  value: "new" | "old";
  onChange: (v: "new" | "old") => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Patient type"
      className="grid grid-cols-2 gap-1 rounded-lg border border-slate-300 bg-slate-100 p-1"
    >
      {(
        [
          ["new", "New patient"],
          ["old", "Old patient"],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(key)}
          className={cn(
            "h-10 rounded-md text-[15px] font-medium transition-colors",
            value === key
              ? "bg-white text-brand-800 shadow-sm"
              : "text-slate-600 hover:text-slate-900",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* ── Create ────────────────────────────────────────────────────────── */

export function NewSerialForm({
  doctors,
  defaultDoctorId,
  defaultDate,
  requireAddress,
}: {
  doctors: DoctorOption[];
  defaultDoctorId: string;
  defaultDate: string;
  requireAddress: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    CreateSerialState,
    FormData
  >(createSerialAction, {});
  const [patientType, setPatientType] = useState<"new" | "old">("new");
  const [isReference, setIsReference] = useState(false);
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

  // After a successful save → open the SMS modal.
  const created = state.ok && state.created ? state.created : null;
  const showSms = Boolean(created && !state.error);
  if (created && showSms && !sms) {
    setSms(created.sms);
  }

  return (
    <>
      <form action={formAction} className="space-y-4">
        {state.error && <Banner type="error">{state.error}</Banner>}

        <Field label="Patient type" required>
          <PatientTypeTabs value={patientType} onChange={setPatientType} />
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
            {doctors.length === 0 && (
              <option value="">No doctors</option>
            )}
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

        <Field
          label="Patient name"
          htmlFor="patientName"
          required
          error={state.fieldErrors?.patientName}
        >
          <Input
            id="patientName"
            name="patientName"
            placeholder="Enter the patient's full name"
            required
            autoComplete="off"
            error={Boolean(state.fieldErrors?.patientName)}
          />
        </Field>

        <Field
          label="Mobile number"
          htmlFor="patientMobile"
          required
          error={state.fieldErrors?.patientMobile}
          hint="Suggestions appear if an old patient exists with the same number."
        >
          <div className="flex gap-2">
            <Input
              id="patientMobile"
              name="patientMobile"
              type="tel"
              inputMode="tel"
              placeholder="01XXXXXXXXX"
              required
              error={Boolean(state.fieldErrors?.patientMobile)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleLookup}
              loading={lookupPending}
              className="shrink-0 px-3"
              aria-label="Search old patients"
            >
              <SearchIcon size={18} />
            </Button>
          </div>
        </Field>

        {suggestions.length > 0 && (
          <Banner type="info" title="Existing patient found">
            <ul className="mt-1 space-y-1.5">
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-md bg-white/70 px-2.5 py-1.5"
                >
                  <span className="min-w-0 text-[13px]">
                    <UserIcon size={14} className="mr-1 inline text-sky-600" />
                    <span className="font-medium">{s.name}</span>
                    {s.address && (
                      <span className="text-slate-500"> — {s.address}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="shrink-0 rounded-md border border-sky-300 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
                  >
                    Use
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[12px] text-sky-700">
              Nothing changes automatically — the fields fill in when you press “Use”.
            </p>
          </Banner>
        )}

        <Field
          label="Address"
          htmlFor="patientAddress"
          required={requireAddress && !isReference}
          error={state.fieldErrors?.patientAddress}
          hint={requireAddress ? undefined : "Optional"}
        >
          <Input
            id="patientAddress"
            name="patientAddress"
            placeholder="Enter address"
            error={Boolean(state.fieldErrors?.patientAddress)}
          />
        </Field>

        <div className="rounded-lg border border-slate-200 p-3.5">
          <Checkbox
            id="isReference"
            name="isReference"
            label={
              <span>
                <span className="font-medium">Reference</span>
                <span className="block text-[12px] text-slate-500">
                  Reference entries never take a serial number.
                </span>
              </span>
            }
            checked={isReference}
            onChange={(e) => setIsReference(e.target.checked)}
          />
          {isReference && (
            <div className="mt-3">
              <Field
                label="Reference details"
                htmlFor="referenceDetails"
                required
                error={state.fieldErrors?.referenceDetails}
              >
                <Input
                  id="referenceDetails"
                  name="referenceDetails"
                  placeholder="e.g. Dr. Selim Mia"
                  error={Boolean(state.fieldErrors?.referenceDetails)}
                />
              </Field>
            </div>
          )}
        </div>

        <Field label="Notes (optional)" htmlFor="notes" error={state.fieldErrors?.notes}>
          <Textarea
            id="notes"
            name="notes"
            rows={2}
            placeholder="A short note if needed…"
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
          <Button type="submit" size="lg" loading={pending} className="flex-[2]">
            Save serial
          </Button>
        </div>
      </form>

      {sms && created && (
        <SmsModal
          open
          onClose={() => {
            setSms(null);
            router.push(
              `/serials?date=${encodeURIComponent(created.appointmentDate)}&doctorId=${encodeURIComponent(created.doctorId)}`,
            );
            router.refresh();
          }}
          payload={sms}
        />
      )}
    </>
  );
}

/* ── Edit ──────────────────────────────────────────────────────────── */

export function EditSerialForm({
  row,
  requireAddress,
}: {
  row: SerialClientRow;
  requireAddress: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateSerialAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="appointmentId" value={row.id} />
      {state.error && <Banner type="error">{state.error}</Banner>}
      {state.ok && state.message && (
        <Banner type="success">{state.message}</Banner>
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
          defaultValue={row.patientName}
          required
          error={Boolean(state.fieldErrors?.patientName)}
        />
      </Field>

      <Field
        label="Mobile number"
        htmlFor="patientMobile"
        required
        error={state.fieldErrors?.patientMobile}
      >
        <Input
          id="patientMobile"
          name="patientMobile"
          type="tel"
          inputMode="tel"
          defaultValue={row.patientMobileDisplay}
          required
          error={Boolean(state.fieldErrors?.patientMobile)}
        />
      </Field>

      <Field
        label="Address"
        htmlFor="patientAddress"
        required={requireAddress && !row.isReference}
        hint={requireAddress ? undefined : "Optional"}
        error={state.fieldErrors?.patientAddress}
      >
        <Input
          id="patientAddress"
          name="patientAddress"
          defaultValue={row.patientAddress}
          error={Boolean(state.fieldErrors?.patientAddress)}
        />
      </Field>

      {row.isReference && (
        <Field
          label="Reference details"
          htmlFor="referenceDetails"
          required
          error={state.fieldErrors?.referenceDetails}
        >
          <Input
            id="referenceDetails"
            name="referenceDetails"
            defaultValue={row.referenceDetails ?? ""}
            error={Boolean(state.fieldErrors?.referenceDetails)}
          />
        </Field>
      )}

      <Field label="Note" htmlFor="notes" error={state.fieldErrors?.notes}>
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={row.notes}
          className="text-[14px]"
        />
      </Field>

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
        Editing patient details does not change the serial number. To change the
        number, use “Change serial number” on the serial details page.
      </p>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.back()}
          className="flex-1"
        >
          Go back
        </Button>
        <Button type="submit" size="lg" loading={pending} className="flex-[2]">
          Save changes
        </Button>
      </div>
    </form>
  );
}
