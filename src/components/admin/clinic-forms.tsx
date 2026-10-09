"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  createClinicAction,
  resetClinicAdminPasswordAction,
  setClinicStatusAction,
  updateClinicAction,
  type ClinicFormState,
  type ResetPasswordState,
} from "@/app/actions/clinics";
import type { FormState } from "@/app/actions/auth";
import { Button, buttonClass } from "@/components/ui/button";
import { Banner, Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { CopyIcon } from "@/components/ui/icons";

function zodFieldsOf(state: { fieldErrors?: Record<string, string> }) {
  return state.fieldErrors ?? {};
}

const TIMEZONES = [
  ["Asia/Dhaka", "Bangladesh (Asia/Dhaka)"],
  ["Asia/Kolkata", "India (Asia/Kolkata)"],
  ["Asia/Kathmandu", "Nepal (Asia/Kathmandu)"],
  ["UTC", "UTC"],
];

/* ── Create clinic (Super Admin) ───────────────────────────────────── */

export function CreateClinicForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    ClinicFormState,
    FormData
  >(createClinicAction, {});
  const errors = zodFieldsOf(state);

  useEffect(() => {
    if (state.ok && state.created) {
      // give the user a moment to see the success banner
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Banner type="error">{state.error}</Banner>}
      {state.ok && state.created && (
        <Banner type="success" title="Clinic created">
          <p>
            Admin username:{" "}
            <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono">
              {state.created.adminUsername}
            </code>
          </p>
          <p className="mt-1">
            The admin must change the password after the first login.
          </p>
          <button
            type="button"
            className={buttonClass("outline", "sm", "mt-2")}
            onClick={() =>
              router.push(`/super-admin/clinics/${state.created!.clinicId}`)
            }
          >
            View clinic details
          </button>
        </Banner>
      )}

      <fieldset className="space-y-4">
        <legend className="mb-1 text-[15px] font-semibold text-slate-800">
          Clinic information
        </legend>
        <Field label="Clinic name" htmlFor="name" required error={errors.name}>
          <Input id="name" name="name" required error={Boolean(errors.name)} />
        </Field>
        <Field label="Address" htmlFor="address" error={errors.address}>
          <Input id="address" name="address" error={Boolean(errors.address)} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={errors.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            error={Boolean(errors.phone)}
          />
        </Field>
        <Field label="Timezone" htmlFor="timezone" error={errors.timezone}>
          <Select id="timezone" name="timezone" defaultValue="Asia/Dhaka">
            {TIMEZONES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Checkbox
          id="requireAddress"
          name="requireAddress"
          label="Make patient address required in the serial form"
        />
      </fieldset>

      <fieldset className="space-y-4 border-t border-slate-100 pt-4">
        <legend className="mb-1 text-[15px] font-semibold text-slate-800">
          Clinic admin account
        </legend>
        <Field label="Admin name" htmlFor="adminName" required error={errors.adminName}>
          <Input
            id="adminName"
            name="adminName"
            required
            error={Boolean(errors.adminName)}
          />
        </Field>
        <Field
          label="Username"
          htmlFor="adminUsername"
          required
          error={errors.adminUsername}
          hint="Lowercase letters, numbers, . _ -"
        >
          <Input
            id="adminUsername"
            name="adminUsername"
            autoComplete="off"
            required
            error={Boolean(errors.adminUsername)}
          />
        </Field>
        <Field
          label="Initial password"
          htmlFor="adminPassword"
          required
          error={errors.adminPassword}
          hint="At least 8 characters — share it with the admin in person securely."
        >
          <Input
            id="adminPassword"
            name="adminPassword"
            type="text"
            autoComplete="off"
            required
            error={Boolean(errors.adminPassword)}
          />
        </Field>
      </fieldset>

      <div className="flex gap-2 pt-2">
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
          Create clinic
        </Button>
      </div>
    </form>
  );
}

/* ── Edit clinic (Super Admin / own clinic admin) ──────────────────── */

export function EditClinicForm({
  clinic,
  isSuperAdmin,
}: {
  clinic: {
    id: string;
    name: string;
    address: string;
    phone: string;
    timezone: string;
    requireAddress: boolean;
    status: string;
  };
  isSuperAdmin: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateClinicAction,
    {},
  );
  const errors = zodFieldsOf(state);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="clinicId" value={clinic.id} />
      {state.error && <Banner type="error">{state.error}</Banner>}
      {state.ok && state.message && (
        <Banner type="success">{state.message}</Banner>
      )}

      <Field label="Clinic name" htmlFor="name" required error={errors.name}>
        <Input
          id="name"
          name="name"
          defaultValue={clinic.name}
          required
          error={Boolean(errors.name)}
        />
      </Field>
      <Field label="Address" htmlFor="address" error={errors.address}>
        <Input
          id="address"
          name="address"
          defaultValue={clinic.address}
          error={Boolean(errors.address)}
        />
      </Field>
      <Field label="Phone" htmlFor="phone" error={errors.phone}>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={clinic.phone}
          error={Boolean(errors.phone)}
        />
      </Field>
      <Field label="Timezone" htmlFor="timezone" error={errors.timezone}>
        <Select id="timezone" name="timezone" defaultValue={clinic.timezone}>
          {TIMEZONES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Checkbox
        id="requireAddress"
        name="requireAddress"
        label="Make patient address required in the serial form"
        defaultChecked={clinic.requireAddress}
      />

      <Button type="submit" size="lg" loading={pending} className="w-full">
        Save
      </Button>
      {!isSuperAdmin && (
        <p className="text-[12px] text-slate-500">
          Only a super admin can change account status.
        </p>
      )}
    </form>
  );
}

/* ── Status control (Super Admin) ──────────────────────────────────── */

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  suspended: "Suspended",
  deactivated: "Deactivated",
};

export function ClinicStatusControl({
  clinicId,
  status,
}: {
  clinicId: string;
  status: string;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    setClinicStatusAction,
    {},
  );

  return (
    <div className="space-y-3">
      {state.error && <Banner type="error">{state.error}</Banner>}
      {state.ok && state.message && (
        <Banner type="success">{state.message}</Banner>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[14px] text-slate-600">
          Current status:{" "}
          <strong className="text-slate-800">{STATUS_LABEL[status] ?? status}</strong>
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["active", "suspended", "deactivated"] as const).map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending || s === status}
            onClick={() => setConfirm(s)}
            className={buttonClass(
              s === "active" ? "outline" : "danger",
              "sm",
              s === status ? "opacity-40" : "",
            )}
          >
            {s === "active"
              ? "Activate"
              : s === "suspended"
                ? "Suspend"
                : "Deactivate"}
          </button>
        ))}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const fd = new FormData();
          fd.set("clinicId", clinicId);
          fd.set("status", confirm ?? "active");
          formAction(fd);
          setConfirm(null);
        }}
        title="Change status?"
        message={`The clinic status will be changed to “${STATUS_LABEL[confirm ?? ""] ?? ""}”. Users of suspended or deactivated clinics will not be able to sign in.`}
        confirmLabel="Yes, change it"
        danger={confirm !== "active"}
        loading={pending}
      />
    </div>
  );
}

/* ── Reset clinic admin password (Super Admin) ─────────────────────── */

export function ResetClinicAdminPassword({ clinicId }: { clinicId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    ResetPasswordState,
    FormData
  >(resetClinicAdminPasswordAction, {});
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-3">
      {state.error && <Banner type="error">{state.error}</Banner>}
      {state.ok && state.reset && (
        <Banner type="success" title="Temporary password created">
          <p>
            Username:{" "}
            <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono">
              {state.reset.username}
            </code>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2">
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
            Hand this password to the admin securely — they must change it at next
            login. It will not be shown again.
          </p>
        </Banner>
      )}

      {!state.reset && (
        <Button variant="outline" onClick={() => setOpen(true)}>
          Reset admin password
        </Button>
      )}

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          const fd = new FormData();
          fd.set("clinicId", clinicId);
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
