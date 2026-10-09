"use client";

import { useActionState, useMemo, useState } from "react";
import { saveSmsTemplateAction } from "@/app/actions/doctors";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Banner, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/form";
import {
  DEFAULT_NEW_PATIENT_SMS_TEMPLATE,
  DEFAULT_OLD_PATIENT_SMS_TEMPLATE,
  SMS_VARIABLES,
  renderSmsTemplate,
  sampleSmsInput,
  unknownVariables,
} from "@/lib/sms";

export interface TemplateDoctor {
  id: string;
  name: string;
  smsTemplateNew: string | null;
  smsTemplateOld: string | null;
}

function templateFor(
  doctor: TemplateDoctor | undefined,
  patientType: "new" | "old",
): string {
  const template =
    patientType === "new"
      ? doctor?.smsTemplateNew
      : doctor?.smsTemplateOld;
  return (
    template?.trim() ||
    (patientType === "new"
      ? DEFAULT_NEW_PATIENT_SMS_TEMPLATE
      : DEFAULT_OLD_PATIENT_SMS_TEMPLATE)
  );
}

/**
 * Doctor-specific SMS template editor with a variable reference and a live
 * sample preview. Templates are stored in the database (per doctor).
 */
export function SmsTemplateEditor({ doctors }: { doctors: TemplateDoctor[] }) {
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? "");
  const [patientType, setPatientType] = useState<"new" | "old">("new");
  const current = doctors.find((d) => d.id === doctorId);
  const [template, setTemplate] = useState(() =>
    templateFor(current, "new"),
  );
  const [copyStatus, setCopyStatus] = useState<{
    variable: string;
    error?: string;
  } | null>(null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveSmsTemplateAction,
    {},
  );

  const unknown = useMemo(() => unknownVariables(template), [template]);
  const preview = useMemo(
    () => renderSmsTemplate(template, sampleSmsInput()),
    [template],
  );

  function selectDoctor(id: string) {
    setDoctorId(id);
    const doc = doctors.find((d) => d.id === id);
    setTemplate(templateFor(doc, patientType));
  }

  function selectPatientType(type: "new" | "old") {
    setPatientType(type);
    setTemplate(templateFor(current, type));
  }

  async function copyVariable(name: string) {
    const variable = `{{${name}}}`;
    try {
      await navigator.clipboard.writeText(variable);
      setCopyStatus({ variable });
      window.setTimeout(() => setCopyStatus(null), 2000);
    } catch {
      setCopyStatus({
        variable,
        error: "Could not copy. Check clipboard permissions and try again.",
      });
    }
  }

  if (doctors.length === 0) {
    return (
      <Banner type="info">Add a doctor first to edit templates.</Banner>
    );
  }

  return (
    <div className="space-y-4">
      <Field label="Doctor" htmlFor="template-doctor">
        <Select
          id="template-doctor"
          value={doctorId}
          onChange={(e) => selectDoctor(e.target.value)}
        >
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {(patientType === "new"
                ? d.smsTemplateNew
                : d.smsTemplateOld)
                ? ""
                : " (default template)"}
            </option>
          ))}
        </Select>
      </Field>

      <div>
        <p className="mb-1.5 text-[14px] font-medium text-slate-800">
          Patient type
        </p>
        <div
          role="radiogroup"
          aria-label="Patient type"
          className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1"
        >
          {(
            [
              ["new", "New patient"],
              ["old", "Old patient"],
            ] as const
          ).map(([type, label]) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={patientType === type}
              onClick={() => selectPatientType(type)}
              className={`min-h-11 rounded-lg px-3 text-[14px] font-medium transition-colors ${
                patientType === type
                  ? type === "new"
                    ? "bg-white text-sky-800 shadow-sm"
                    : "bg-white text-violet-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="doctorId" value={doctorId} />
        <input type="hidden" name="patientType" value={patientType} />
        {state.error && <Banner type="error">{state.error}</Banner>}
        {state.ok && state.message && (
          <Banner type="success">{state.message}</Banner>
        )}

        <Field
          label={`${patientType === "new" ? "New" : "Old"} patient SMS template`}
          htmlFor="smsTemplate"
          error={state.fieldErrors?.smsTemplate}
          hint="Clear the field to use the built-in default template."
        >
          <Textarea
            id="smsTemplate"
            name="smsTemplate"
            rows={6}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="text-[14px] leading-relaxed"
            error={Boolean(state.fieldErrors?.smsTemplate)}
          />
        </Field>

        <div>
          <p className="mb-1.5 text-[13px] font-medium text-slate-700">
            Variables (click to copy)
          </p>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex w-max flex-nowrap gap-1.5">
            {SMS_VARIABLES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => void copyVariable(v)}
                className="min-h-10 shrink-0 rounded-full border border-slate-200 bg-white px-3 font-mono text-[11px] text-slate-600 transition-colors hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
              >
                {`{{${v}}}`}
              </button>
            ))}
            </div>
          </div>
          {copyStatus && (
            <p
              role={copyStatus.error ? "alert" : "status"}
              className={`mt-2 text-[12px] ${
                copyStatus.error ? "text-red-600" : "text-emerald-700"
              }`}
            >
              {copyStatus.error ?? `${copyStatus.variable} copied to clipboard.`}
            </p>
          )}
          {unknown.length > 0 && (
            <p className="mt-2 text-[12px] text-amber-700">
              Unknown variables: {unknown.join(", ")} — they stay unchanged in the
              message.
            </p>
          )}
        </div>

        <Card>
          <CardHeader title="Sample preview" subtitle="Shown with fictional sample data" />
          <CardBody>
            <pre className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-700">
              {preview}
            </pre>
          </CardBody>
        </Card>

        <Button type="submit" size="lg" loading={pending} className="w-full">
          Save template
        </Button>
      </form>
    </div>
  );
}
