"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { setReportSubmissionAction } from "@/app/actions/serials";
import type { FormState } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

export function ReportSubmissionButton({
  appointmentId,
  submitted,
}: {
  appointmentId: string;
  submitted: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    setReportSubmissionAction,
    {},
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <div className="col-span-full space-y-1.5">
      <form action={formAction}>
        <input type="hidden" name="appointmentId" value={appointmentId} />
        <input name="submitted" type="hidden" value={String(!submitted)} />
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "flex min-h-11 w-full items-center justify-center rounded-lg border px-3 text-[13px] font-medium disabled:opacity-60",
            submitted
              ? "border-amber-200 text-amber-700 hover:bg-amber-50"
              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
          )}
        >
          {pending
            ? "Updating report status…"
            : submitted
              ? "Mark report not submitted"
              : "Mark report submitted"}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="text-[12px] text-red-600">
          {state.error}
        </p>
      )}
    </div>
  );
}
