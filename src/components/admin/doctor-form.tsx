"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import {
  createDoctorAction,
  updateDoctorAction,
} from "@/app/actions/doctors";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";

function errorsOf(state: FormState) {
  return state.fieldErrors ?? {};
}

export function DoctorForm({
  doctor,
}: {
  doctor?: {
    id: string;
    name: string;
    specialty: string;
    phone: string;
    instructions: string;
    smsTemplateNew: string | null;
    smsTemplateOld: string | null;
    status: string;
  };
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    doctor ? updateDoctorAction : createDoctorAction,
    {},
  );
  const errors = errorsOf(state);

  return (
    <form action={formAction} className="space-y-4">
      {doctor && <input type="hidden" name="doctorId" value={doctor.id} />}
      {state.error && <Banner type="error">{state.error}</Banner>}
      {state.ok && state.message && (
        <Banner type="success">{state.message}</Banner>
      )}

      <Field label="Doctor name" htmlFor="name" required error={errors.name}>
        <Input
          id="name"
          name="name"
          defaultValue={doctor?.name ?? ""}
          required
          error={Boolean(errors.name)}
        />
      </Field>

      <Field
        label="Specialty / designation"
        htmlFor="specialty"
        error={errors.specialty}
        hint="Optional"
      >
        <Input
          id="specialty"
          name="specialty"
          defaultValue={doctor?.specialty ?? ""}
          placeholder="e.g. Medicine, Cardiology"
          error={Boolean(errors.specialty)}
        />
      </Field>

      <Field label="Phone" htmlFor="phone" error={errors.phone} hint="Optional">
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={doctor?.phone ?? ""}
          error={Boolean(errors.phone)}
        />
      </Field>

      <Field
        label="Serial / visit instructions"
        htmlFor="instructions"
        error={errors.instructions}
        hint="Optional — visible to staff"
      >
        <Textarea
          id="instructions"
          name="instructions"
          rows={3}
          defaultValue={doctor?.instructions ?? ""}
          className="text-[14px]"
        />
      </Field>

      {doctor && (
        <Field
          label="New patient SMS template"
          htmlFor="smsTemplateNew"
          error={errors.smsTemplateNew}
          hint="Leave blank to use the default. Edit both templates in Settings → SMS template."
        >
          <Textarea
            id="smsTemplateNew"
            name="smsTemplateNew"
            rows={4}
            defaultValue={doctor?.smsTemplateNew ?? ""}
            className="font-mono text-[13px]"
          />
        </Field>
      )}

      {doctor && (
        <Field
          label="Old patient SMS template"
          htmlFor="smsTemplateOld"
          error={errors.smsTemplateOld}
          hint="Leave blank to use the default template."
        >
          <Textarea
            id="smsTemplateOld"
            name="smsTemplateOld"
            rows={4}
            defaultValue={doctor?.smsTemplateOld ?? ""}
            className="font-mono text-[13px]"
          />
        </Field>
      )}

      <Field label="Status" htmlFor="status">
        <Select
          id="status"
          name="status"
          defaultValue={doctor?.status === "inactive" ? "inactive" : "active"}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </Field>

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" size="lg" loading={pending} className="flex-[2]">
          {doctor ? "Save" : "Add doctor"}
        </Button>
      </div>
    </form>
  );
}
