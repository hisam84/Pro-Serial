"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  cancelSerialAction,
  changeSerialNumberAction,
} from "@/app/actions/serials";
import type { SerialClientRow, SmsPayload } from "@/lib/serial-client";
import type { FormState } from "@/app/actions/auth";
import { Button, buttonClass } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { MessageIcon, XCircleIcon } from "@/components/ui/icons";
import { SmsModal } from "./sms-modal";

/** SMS + Cancel actions on the detail page. */
export function DetailActions({
  row,
  sms,
}: {
  row: SerialClientRow;
  sms: SmsPayload;
}) {
  const router = useRouter();
  const [smsOpen, setSmsOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    cancelSerialAction,
    {},
  );

  // Close the confirm dialog when the server action succeeds (render-adjust
  // pattern — React docs "you might not need an effect").
  const [cancelPrevOk, setCancelPrevOk] = useState(state.ok);
  if (cancelPrevOk !== state.ok) {
    setCancelPrevOk(state.ok);
    if (state.ok) setCancelOpen(false);
  }

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  if (row.status === "cancelled") {
    return (
      <Banner type="info">This serial has been cancelled — its details are kept in history.</Banner>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => setSmsOpen(true)}
        className={buttonClass("primary", "md", "flex-1")}
      >
        <MessageIcon size={17} />
        Send SMS
      </button>
      <button
        type="button"
        onClick={() => setCancelOpen(true)}
        className={buttonClass("danger", "md", "flex-1")}
      >
        <XCircleIcon size={17} />
        Cancel serial
      </button>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => {
          const fd = new FormData();
          fd.set("appointmentId", row.id);
          formAction(fd);
        }}
        title="Cancel this serial?"
        message={`The serial for “${row.patientName}” will be cancelled. The number stays in history and is never reused.`}
        confirmLabel="Yes, cancel it"
        danger
        loading={pending}
      />

      <SmsModal open={smsOpen} onClose={() => setSmsOpen(false)} payload={sms} />
    </div>
  );
}

/** Deliberate, conflict-checked serial number change (clinic admin only). */
export function ChangeSerialForm({
  appointmentId,
  currentNumber,
}: {
  appointmentId: string;
  currentNumber: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    changeSerialNumberAction,
    {},
  );

  // Close the dialog on success (render-adjust pattern).
  const [numPrevOk, setNumPrevOk] = useState(state.ok);
  if (numPrevOk !== state.ok) {
    setNumPrevOk(state.ok);
    if (state.ok) setOpen(false);
  }

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <div className="rounded-xl border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-[14px] font-medium text-slate-700 hover:bg-slate-50"
      >
        Change serial number
        <span className="text-slate-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <form action={formAction} className="space-y-3 border-t border-slate-100 p-4">
          {state.error && <Banner type="error">{state.error}</Banner>}
          {state.ok && state.message && (
            <Banner type="success">{state.message}</Banner>
          )}
          <p className="text-[12px] text-slate-500">
            Current number:{" "}
            <strong>{currentNumber != null ? currentNumber : "—"}</strong>.
            If the number is already used (including cancelled ones), the change is rejected.
          </p>
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <Field
            label="New serial number"
            htmlFor="serialNumber"
            error={state.fieldErrors?.serialNumber}
          >
            <Input
              id="serialNumber"
              name="serialNumber"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={currentNumber ?? ""}
              required
              error={Boolean(state.fieldErrors?.serialNumber)}
            />
          </Field>
          <Button type="submit" loading={pending} size="md" className="w-full">
            Change number
          </Button>
        </form>
      )}
    </div>
  );
}
