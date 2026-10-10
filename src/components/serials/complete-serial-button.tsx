"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { completeSerialAction } from "@/app/actions/serials";
import type { FormState } from "@/app/actions/auth";
import { ConfirmDialog } from "@/components/ui/dialog";
import { CheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export function CompleteSerialButton({
  appointmentId,
  patientName,
  className,
}: {
  appointmentId: string;
  patientName: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    completeSerialAction,
    {},
  );

  const [previousSuccess, setPreviousSuccess] = useState(state.ok);
  if (previousSuccess !== state.ok) {
    setPreviousSuccess(state.ok);
    if (state.ok) setOpen(false);
  }

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className={cn(
          "flex min-h-11 items-center justify-center gap-2 rounded-lg border border-emerald-200 text-[13px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60",
          className,
        )}
      >
        <CheckIcon size={17} />
        Mark complete
      </button>
      {state.error && (
        <p role="alert" className="col-span-full text-[12px] text-red-600">
          {state.error}
        </p>
      )}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          const formData = new FormData();
          formData.set("appointmentId", appointmentId);
          formAction(formData);
        }}
        title="Mark this visit complete?"
        message={`Confirm that ${patientName} has finished the doctor's visit. This serial will remain in history and will no longer be editable or reorderable.`}
        confirmLabel="Yes, mark complete"
        cancelLabel="Not now"
        loading={pending}
      />
    </>
  );
}
