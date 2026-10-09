"use client";

import { useActionState, useMemo, useState } from "react";
import { saveSmsTemplateAction } from "@/app/actions/doctors";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Banner, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/form";
import {
  DEFAULT_SMS_TEMPLATE,
  SMS_VARIABLES,
  renderSmsTemplate,
  sampleSmsInput,
  unknownVariables,
} from "@/lib/sms";

export interface TemplateDoctor {
  id: string;
  name: string;
  smsTemplate: string | null;
}

/**
 * Doctor-specific SMS template editor with a variable reference and a live
 * sample preview. Templates are stored in the database (per doctor).
 */
export function SmsTemplateEditor({ doctors }: { doctors: TemplateDoctor[] }) {
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? "");
  const current = doctors.find((d) => d.id === doctorId);
  const [template, setTemplate] = useState(
    current?.smsTemplate || DEFAULT_SMS_TEMPLATE,
  );
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
    setTemplate(doc?.smsTemplate || DEFAULT_SMS_TEMPLATE);
  }

  function insertVariable(name: string) {
    setTemplate((t) => `${t}${t.endsWith("\n") || t === "" ? "" : " "}{{${name}}}`);
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
              {d.smsTemplate ? "" : " (default template)"}
            </option>
          ))}
        </Select>
      </Field>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="doctorId" value={doctorId} />
        {state.error && <Banner type="error">{state.error}</Banner>}
        {state.ok && state.message && (
          <Banner type="success">{state.message}</Banner>
        )}

        <Field
          label="SMS template"
          htmlFor="smsTemplate"
          error={state.fieldErrors?.smsTemplate}
          hint="If left unsaved, the default template is used."
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
            Variables (click to insert)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SMS_VARIABLES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVariable(v)}
                className="rounded-full border border-slate-300 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-600 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
              >
                {`{{${v}}}`}
              </button>
            ))}
          </div>
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
            <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-700">
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
