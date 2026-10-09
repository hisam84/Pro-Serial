"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import {
  createAttendantAction,
  resetAttendantPasswordAction,
  updateAttendantAction,
  type StaffFormState,
} from "@/app/actions/staff";
import { Button, buttonClass } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { CopyIcon } from "@/components/ui/icons";

export interface StaffDoctorOption {
  id: string;
  name: string;
}

function errorsOf(state: { fieldErrors?: Record<string, string> }) {
  return state.fieldErrors ?? {};
}

/* ── Doctor assignment checkboxes ──────────────────────────────────── */

function DoctorCheckboxes({
  doctors,
  defaultSelected,
}: {
  doctors: StaffDoctorOption[];
  defaultSelected: string[];
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  return (
    <div className="space-y-2">
      {doctors.length === 0 && (
        <p className="text-[13px] text-slate-500">
          Add a doctor first to assign.
        </p>
      )}
      {doctors.map((d) => (
        <Checkbox
          key={d.id}
          id={`doctor-${d.id}`}
          name="doctorIds"
          value={d.id}
          label={d.name}
          checked={selected.includes(d.id)}
          onChange={(e) =>
            setSelected((prev) =>
              e.target.checked
                ? [...prev, d.id]
                : prev.filter((id) => id !== d.id),
            )
          }
        />
      ))}
    </div>
  );
}

/* ── Create attendant ──────────────────────────────────────────────── */

export function CreateAttendantForm({
  doctors,
}: {
  doctors: StaffDoctorOption[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    StaffFormState,
    FormData
  >(createAttendantAction, {});
  const errors = errorsOf(state);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Banner type="error">{state.error}</Banner>}
      {state.ok && state.created && (
        <Banner type="success" title="Attendant created">
          <p>
            Username:{" "}
            <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono">
              {state.created.username}
            </code>
          </p>
          <p className="mt-1 text-[12px]">
            Hand the username and password to the staff member securely.
          </p>
        </Banner>
      )}

      <Field label="Name" htmlFor="name" required error={errors.name}>
        <Input id="name" name="name" required error={Boolean(errors.name)} />
      </Field>

      <Field
        label="Username"
        htmlFor="username"
        required
        error={errors.username}
        hint="Lowercase letters, numbers, . _ -"
      >
        <Input
          id="username"
          name="username"
          autoComplete="off"
          required
          error={Boolean(errors.username)}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        required
        error={errors.password}
        hint="At least 8 characters"
      >
        <Input
          id="password"
          name="password"
          type="text"
          autoComplete="off"
          required
          error={Boolean(errors.password)}
        />
      </Field>

      <Field label="Doctor assignment">
        <DoctorCheckboxes doctors={doctors} defaultSelected={[]} />
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
          Create
        </Button>
      </div>
    </form>
  );
}

/* ── Edit attendant ────────────────────────────────────────────────── */

export function EditAttendantForm({
  attendant,
  doctors,
}: {
  attendant: {
    id: string;
    name: string;
    username: string;
    status: string;
    doctorIds: string[];
  };
  doctors: StaffDoctorOption[];
}) {
  const [state, formAction, pending] = useActionState<
    StaffFormState,
    FormData
  >(updateAttendantAction, {});
  const errors = errorsOf(state);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="userId" value={attendant.id} />
      {state.error && <Banner type="error">{state.error}</Banner>}
      {state.ok && state.message && (
        <Banner type="success">{state.message}</Banner>
      )}

      <Field label="Name" htmlFor="name" required error={errors.name}>
        <Input
          id="name"
          name="name"
          defaultValue={attendant.name}
          required
          error={Boolean(errors.name)}
        />
      </Field>

      <Field label="Username" hint="Cannot be changed">
        <Input value={attendant.username} disabled />
      </Field>

      <Field label="Status" htmlFor="status">
        <Select
          id="status"
          name="status"
          defaultValue={attendant.status === "disabled" ? "disabled" : "active"}
        >
          <option value="active">Active</option>
          <option value="disabled">Inactive</option>
        </Select>
      </Field>

      <Field label="Doctor assignment">
        <DoctorCheckboxes
          doctors={doctors}
          defaultSelected={attendant.doctorIds}
        />
      </Field>

      <Button type="submit" size="lg" loading={pending} className="w-full">
        Save
      </Button>
    </form>
  );
}

/* ── Reset attendant password ──────────────────────────────────────── */

export function ResetAttendantPassword({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    StaffFormState,
    FormData
  >(resetAttendantPasswordAction, {});
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-3">
      {state.error && <Banner type="error">{state.error}</Banner>}
      {state.ok && state.reset && (
        <Banner type="success" title="Temporary password created">
          <p className="flex flex-wrap items-center gap-2">
            Password:{" "}
            <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-[13px]">
              {state.reset.tempPassword}
            </code>
            <button
              type="button"
              className={buttonClass("outline", "sm")}
              onClick={async () => {
                await navigator.clipboard.writeText(state.reset!.tempPassword);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              <CopyIcon size={14} />
              {copied ? "Copied" : "Copy"}
            </button>
          </p>
          <p className="mt-1 text-[12px]">
            Hand it to the staff member securely — they must change it at next login.
            It will not be shown again.
          </p>
        </Banner>
      )}

      {!state.reset && (
        <Button variant="outline" onClick={() => setOpen(true)}>
          Reset password
        </Button>
      )}

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          const fd = new FormData();
          fd.set("userId", userId);
          formAction(fd);
          setOpen(false);
        }}
        title="Reset password?"
        message="A new temporary password will be generated and shown once. The current password will stop working."
        confirmLabel="Yes, reset"
        danger
        loading={pending}
      />
    </div>
  );
}
