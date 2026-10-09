"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  cancelSerialAction,
  moveSerialNumberAction,
} from "@/app/actions/serials";
import type { SerialClientRow, SmsPayload } from "@/lib/serial-client";
import type { FormState } from "@/app/actions/auth";
import { Badge } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  MessageIcon,
  PencilIcon,
  PhoneIcon,
  XCircleIcon,
} from "@/components/ui/icons";
import { SmsModal, smsSerialLabel } from "./sms-modal";
import { formatDateCompact, toDigits, cn } from "@/lib/utils";
import { patientTypeLabel } from "@/lib/sms";

/**
 * One serial/reference row: large serial badge, patient info, and compact
 * actions (edit, SMS, cancel). Cancelled rows keep their number and history.
 */
export function SerialCard({
  row,
  canEdit,
  canChangeNumber,
  canReorder = false,
  canMoveUp = false,
  canMoveDown = false,
  sms,
}: {
  row: SerialClientRow;
  canEdit: boolean;
  canChangeNumber: boolean;
  canReorder?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  /** Prebuilt SMS payload (server-rendered with the doctor's template). */
  sms: SmsPayload;
}) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    cancelSerialAction,
    {},
  );
  const [moveState, moveFormAction, movePending] = useActionState<
    FormState,
    FormData
  >(moveSerialNumberAction, {});

  // Close the confirm dialog on success (render-adjust pattern).
  const [cancelPrevOk, setCancelPrevOk] = useState(state.ok);
  if (cancelPrevOk !== state.ok) {
    setCancelPrevOk(state.ok);
    if (state.ok) setCancelOpen(false);
  }

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  useEffect(() => {
    if (moveState.ok) router.refresh();
  }, [moveState, router]);

  const cancelled = row.status === "cancelled";

  return (
    <li
      className={cn(
        "print-card rounded-xl border bg-white p-1.5 shadow-sm",
        cancelled ? "border-red-100 bg-red-50/40" : "border-slate-200",
        row.isReference && !cancelled && "border-rose-200 bg-rose-50/40",
      )}
    >
      <div className="flex min-h-12 items-center gap-2.5">
        {/* Serial badge */}
        <div className="flex shrink-0 items-center gap-1.5">
          {canReorder && !row.isReference && !cancelled && (
            <form action={moveFormAction} className="flex flex-col">
              <input type="hidden" name="appointmentId" value={row.id} />
              <button
                type="submit"
                name="direction"
                value="up"
                disabled={!canMoveUp || movePending}
                aria-label="Move serial up"
                title="Move serial up"
                className="flex size-[22px] items-center justify-center rounded text-slate-500 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowUpIcon size={16} />
              </button>
              <button
                type="submit"
                name="direction"
                value="down"
                disabled={!canMoveDown || movePending}
                aria-label="Move serial down"
                title="Move serial down"
                className="flex size-[22px] items-center justify-center rounded text-slate-500 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowDownIcon size={16} />
              </button>
            </form>
          )}
          {row.isReference ? (
            <span
              className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-rose-300 bg-rose-100 px-2 text-[13px] font-bold text-rose-800"
              aria-label="Reference entry"
              title="Reference"
            >
              Ref
            </span>
          ) : (
            <span
              className={cn(
                "flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-2 text-xl font-bold",
                cancelled
                  ? "bg-red-100 text-red-400 line-through"
                  : row.patientType === "new"
                    ? "bg-sky-100 text-sky-800"
                    : "bg-violet-100 text-violet-800",
              )}
              aria-label={`Serial number ${row.serialNumber ?? ""}`}
            >
              {row.serialNumber != null ? toDigits(row.serialNumber) : "—"}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Link
            href={`/serials/${row.id}`}
            className="min-w-0 truncate text-[14px] font-semibold text-slate-900 underline-offset-2 hover:underline"
          >
            {row.patientName}
          </Link>
          <Badge
            variant={row.patientType === "new" ? "new" : "old"}
            className="shrink-0"
          >
            {patientTypeLabel(row.patientType)}
          </Badge>
        </div>

        <button
          type="button"
          onClick={() => setDetailsOpen((open) => !open)}
          aria-expanded={detailsOpen}
          aria-label={detailsOpen ? "Hide patient details" : "Show patient details and actions"}
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <ChevronDownIcon
            size={19}
            className={cn("transition-transform", detailsOpen && "rotate-180")}
          />
        </button>
      </div>

      {detailsOpen && (
        <div className="mt-1 space-y-3 border-t border-slate-100 px-1 pb-1 pt-3">
          <div className="space-y-1.5 text-[13px] text-slate-600">
            <a
              href={`tel:${sms.dial}`}
              className="inline-flex min-h-9 items-center gap-2 text-slate-700 hover:text-brand-700"
            >
              <PhoneIcon size={14} className="text-slate-400" />
              {row.patientMobileDisplay}
            </a>
            {row.patientAddress && <p>{row.patientAddress}</p>}
            <p>{formatDateCompact(row.appointmentDate)}</p>
            {row.isReference && row.referenceDetails && (
              <p className="inline-flex rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[12px] text-rose-800">
                Reference: {row.referenceDetails}
              </p>
            )}
            {row.notes && <p className="text-slate-500">📝 {row.notes}</p>}
            {cancelled && (
              <p className="text-red-600">
                Cancelled
                {row.cancelledByName ? ` by ${row.cancelledByName}` : ""}
                {row.cancelReason ? ` · ${row.cancelReason}` : ""}
              </p>
            )}
          </div>

          {moveState.error && (
            <p role="alert" className="text-[12px] text-red-600">
              {moveState.error}
            </p>
          )}

          {canEdit && (
            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
              {!cancelled && (
                <>
                  <button
                    type="button"
                    onClick={() => setSmsOpen(true)}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-700"
                  >
                    <MessageIcon size={17} />
                    Send SMS
                  </button>
                  <Link
                    href={`/serials/${row.id}`}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <PencilIcon size={16} />
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => setCancelOpen(true)}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-100 text-[13px] font-medium text-red-600 hover:bg-red-50"
                  >
                    <XCircleIcon size={17} />
                    Cancel serial
                  </button>
                </>
              )}
              {canChangeNumber && !row.isReference && !cancelled && (
                <Link
                  href={`/serials/${row.id}`}
                  className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  Change number
                </Link>
              )}
              {cancelled && (
                <Link
                  href={`/serials/${row.id}`}
                  className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  View details
                </Link>
              )}
            </div>
          )}
        </div>
      )}

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

      <SmsModal
        open={smsOpen}
        onClose={() => setSmsOpen(false)}
        payload={sms}
        serialLabel={smsSerialLabel(row.serialNumber, row.isReference)}
      />
    </li>
  );
}
