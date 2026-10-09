"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/form";
import { CopyIcon, MessageIcon, PhoneIcon } from "@/components/ui/icons";
import { buildSmsLink } from "@/lib/sms";
import type { SmsPayload } from "@/lib/serial-client";
import { toDigits } from "@/lib/utils";

/**
 * SMS composition modal. The app NEVER sends SMS itself — "Send SMS" opens
 * the device's native SMS app with a prefilled message (sms: link). The user
 * must press Send there. A copy fallback is provided for devices/browsers
 * that cannot handle sms: links.
 */
export function SmsModal({
  open,
  onClose,
  payload,
  serialLabel,
}: {
  open: boolean;
  onClose: () => void;
  payload: SmsPayload;
  /** e.g. "3" or "Reference" — shown in the summary. */
  serialLabel?: string;
}) {
  const [message, setMessage] = useState(payload.message);
  const [copied, setCopied] = useState(false);

  const link = buildSmsLink(payload.dial, message);

  async function copyAll() {
    const text = `Number: ${payload.mobileDisplay}\n\n${message}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — select text instead.
      const el = document.getElementById("sms-message") as HTMLTextAreaElement | null;
      el?.select();
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Send SMS"
      description="This opens your SMS app — press Send there to deliver the message."
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-[13px]">
          <div>
            <dt className="text-slate-500">Patient</dt>
            <dd className="font-medium text-slate-800">{payload.patientName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Mobile</dt>
            <dd className="flex items-center gap-1.5 font-medium text-slate-800">
              <PhoneIcon size={14} className="text-slate-400" />
              <a href={`tel:${payload.dial}`} className="underline decoration-slate-300">
                {payload.mobileDisplay}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Doctor</dt>
            <dd className="font-medium text-slate-800">{payload.doctorName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Serial / date</dt>
            <dd className="font-medium text-slate-800">
              {serialLabel ?? payload.serialLabel} · {payload.appointmentDate}
            </dd>
          </div>
        </dl>

        <Field label="Message" htmlFor="sms-message" hint="You can edit the message if needed.">
          <Textarea
            id="sms-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="text-[14px] leading-relaxed"
          />
        </Field>

        <Banner type="info">
          This app never sends SMS by itself — it opens the SMS app on your phone; send
          the message from there.
        </Banner>

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <a
            href={link}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 text-[15px] font-medium text-white hover:bg-brand-800"
          >
            <MessageIcon size={18} />
            Open in SMS app
          </a>
          <Button type="button" variant="outline" onClick={copyAll} className="h-12">
            <CopyIcon size={17} />
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} className="h-12">
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Summary line inside the modal list rows. */
export function smsSerialLabel(serialNumber: number | null, isReference: boolean): string {
  if (isReference) return "Reference";
  return serialNumber != null ? toDigits(serialNumber) : "—";
}
