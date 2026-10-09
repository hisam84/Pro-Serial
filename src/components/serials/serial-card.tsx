"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  cancelSerialAction,
} from "@/app/actions/serials";
import type { SerialClientRow, SmsPayload } from "@/lib/serial-client";
import type { FormState } from "@/app/actions/auth";
import { Badge } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
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
  sms,
}: {
  row: SerialClientRow;
  canEdit: boolean;
  canChangeNumber: boolean;
  /** Prebuilt SMS payload (server-rendered with the doctor's template). */
  sms: SmsPayload;
}) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    cancelSerialAction,
    {},
  );

  // Close the confirm dialog on success (render-adjust pattern).
  const [cancelPrevOk, setCancelPrevOk] = useState(state.ok);
  if (cancelPrevOk !== state.ok) {
    setCancelPrevOk(state.ok);
    if (state.ok) setCancelOpen(false);
  }

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  const cancelled = row.status === "cancelled";

  return (
    <li
      className={cn(
        "print-card rounded-xl border bg-white p-3.5 shadow-sm",
        cancelled ? "border-red-100 bg-red-50/40" : "border-slate-200",
        row.isReference && !cancelled && "border-rose-200 bg-rose-50/40",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Serial badge */}
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

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/serials/${row.id}`}
              className="truncate text-[15px] font-semibold text-slate-900 underline-offset-2 hover:underline"
            >
              {row.patientName}
            </Link>
            <Badge variant={row.patientType === "new" ? "new" : "old"}>
              {patientTypeLabel(row.patientType)}
            </Badge>
            {cancelled && <Badge variant="cancelled">Cancelled</Badge>}
          </div>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-slate-500">
            <a
              href={`tel:${sms.dial}`}
              className="inline-flex items-center gap-1 text-slate-600 hover:text-brand-700"
            >
              <PhoneIcon size={13} />
              {row.patientMobileDisplay}
            </a>
            {row.patientAddress && (
              <span className="truncate">{row.patientAddress}</span>
            )}
            <span>{formatDateCompact(row.appointmentDate)}</span>
          </p>

          {row.isReference && row.referenceDetails && (
            <p className="mt-1 inline-flex rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[12px] text-rose-800">
              Reference: {row.referenceDetails}
            </p>
          )}

          {row.notes && (
            <p className="mt-1 text-[12px] text-slate-500">📝 {row.notes}</p>
          )}

          {cancelled && (
            <p className="mt-1 text-[12px] text-red-600">
              {formatDateCompact(row.appointmentDate)}
              {row.cancelledByName ? ` · Cancelled by: ${row.cancelledByName}` : ""}
              {row.cancelReason ? ` · Reason: ${row.cancelReason}` : ""}
            </p>
          )}
        </div>

        {/* Actions */}
        {canEdit && (
          <div className="flex shrink-0 items-center gap-1">
            {!cancelled && (
              <>
                <button
                  type="button"
                  onClick={() => setSmsOpen(true)}
                  aria-label="Send SMS"
                  title="Send SMS"
                  className="touch-target flex items-center justify-center rounded-lg text-slate-500 hover:bg-brand-50 hover:text-brand-700"
                >
                  <MessageIcon size={19} />
                </button>
                <Link
                  href={`/serials/${row.id}`}
                  aria-label="Edit"
                  title="Edit"
                  className="touch-target flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                  <PencilIcon size={18} />
                </Link>
                <button
                  type="button"
                  onClick={() => setCancelOpen(true)}
                  aria-label="Cancel serial"
                  title="Cancel serial"
                  className="touch-target flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <XCircleIcon size={19} />
                </button>
              </>
            )}
            {cancelled && (
              <Link
                href={`/serials/${row.id}`}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Details
              </Link>
            )}
          </div>
        )}
      </div>

      {canChangeNumber && !row.isReference && !cancelled && (
        <Link
          href={`/serials/${row.id}`}
          className="mt-2 block text-right text-[11px] text-slate-400 hover:text-brand-700"
        >
          Change serial number →
        </Link>
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
