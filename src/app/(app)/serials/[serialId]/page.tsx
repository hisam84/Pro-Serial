import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { clinics, doctors as doctorsTable } from "@/db/schema";
import { requireUser, toActor } from "@/lib/auth";
import { canUseSerials } from "@/lib/rbac";
import { getSerialForActor } from "@/lib/serials";
import { listAuditForEntity } from "@/lib/audit";
import {
  buildSmsInput,
  buildSmsLink,
  patientTypeLabel,
  renderSmsTemplate,
} from "@/lib/sms";
import { effectiveSmsTemplate } from "@/lib/doctors";
import { normalizeMobile } from "@/lib/mobile";
import {
  toClientRow,
  type SmsPayload,
} from "@/lib/serial-client";
import { EditSerialForm } from "@/components/serials/serial-form";
import {
  ChangeSerialForm,
  DetailActions,
} from "@/components/serials/detail-actions";
import { LinkBack } from "@/components/ui/link-back";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  formatDate,
  formatDateTime,
  toDigits,
} from "@/lib/utils";

export const metadata = { title: "Serial details" };

interface PageProps {
  params: Promise<{ serialId: string }>;
}

export default async function SerialDetailPage({ params }: PageProps) {
  const { serialId } = await params;
  const db = await getDb();
  const user = await requireUser(db);
  if (!canUseSerials(user) || !user.clinicId) redirect("/unauthorized");

  const row = await getSerialForActor(db, toActor(user), serialId);
  if (!row) {
    return (
      <div className="mx-auto max-w-xl space-y-3 py-6 text-center">
        <p className="text-[15px] text-slate-600">
          Serial not found or you do not have permission to view it.
        </p>
        <LinkBack href="/serials">Back to serial list</LinkBack>
      </div>
    );
  }

  const [clinic] = await db
    .select({ name: clinics.name, requireAddress: clinics.requireAddress })
    .from(clinics)
    .where(eq(clinics.id, user.clinicId))
    .limit(1);
  const [doctor] = await db
    .select({
      smsTemplateNew: doctorsTable.smsTemplateNew,
      smsTemplateOld: doctorsTable.smsTemplateOld,
    })
    .from(doctorsTable)
    .where(eq(doctorsTable.id, row.doctorId))
    .limit(1);

  const input = buildSmsInput({
    patientName: row.patientName,
    patientMobile: row.patientMobileDisplay,
    patientAddress: row.patientAddress,
    patientType: row.patientType,
    serialNumber: row.serialNumber,
    appointmentDate: row.appointmentDate,
    doctorName: row.doctorName,
    clinicName: clinic?.name ?? "",
    referenceDetails: row.referenceDetails,
    isReference: row.isReference,
  });
  const message = renderSmsTemplate(
    effectiveSmsTemplate(
      {
        smsTemplateNew: doctor?.smsTemplateNew ?? null,
        smsTemplateOld: doctor?.smsTemplateOld ?? null,
      },
      row.patientType,
    ),
    input,
  );
  const mobile = normalizeMobile(row.patientMobileDisplay);
  const sms: SmsPayload = {
    patientName: row.patientName,
    mobileDisplay: row.patientMobileDisplay,
    dial: mobile.dial || row.patientMobileDisplay,
    doctorName: row.doctorName,
    clinicName: clinic?.name ?? "",
    appointmentDate: row.appointmentDate,
    serialLabel: row.isReference
      ? "Reference"
      : row.serialNumber != null
        ? toDigits(row.serialNumber)
        : "—",
    message,
    smsLink: buildSmsLink(mobile.dial || row.patientMobileDisplay, message),
  };

  const audit = await listAuditForEntity(db, "appointment", row.id);
  const client = toClientRow(row);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <LinkBack
          href={`/serials?date=${encodeURIComponent(row.appointmentDate)}&doctorId=${encodeURIComponent(row.doctorId)}`}
        >
          Serial list
        </LinkBack>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          {row.patientName}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {row.isReference ? (
            <Badge variant="reference">Reference</Badge>
          ) : (
            <Badge variant="brand">
              Serials {row.serialNumber != null ? toDigits(row.serialNumber) : "—"}
            </Badge>
          )}
          <Badge variant={row.patientType === "new" ? "new" : "old"}>
            {patientTypeLabel(row.patientType)}
          </Badge>
          <Badge
            variant={
              row.status === "active"
                ? "active"
                : row.status === "completed"
                  ? "completed"
                  : "cancelled"
            }
          >
            {row.status === "active"
              ? "Active"
              : row.status === "completed"
                ? "Completed"
                : "Cancelled"}
          </Badge>
        </div>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader title="Summary" />
        <CardBody>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[14px]">
            <div>
              <dt className="text-[12px] text-slate-500">Doctor</dt>
              <dd className="font-medium text-slate-800">{row.doctorName}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-slate-500">Date</dt>
              <dd className="font-medium text-slate-800">
                {formatDate(row.appointmentDate)}
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-slate-500">Mobile</dt>
              <dd>
                <a
                  href={`tel:${sms.dial}`}
                  className="font-medium text-brand-700 underline-offset-2 hover:underline"
                >
                  {row.patientMobileDisplay}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-slate-500">Address</dt>
              <dd className="font-medium text-slate-800">
                {row.patientAddress || "—"}
              </dd>
            </div>
            {row.isReference && (
              <div className="col-span-2">
                <dt className="text-[12px] text-slate-500">Reference details</dt>
                <dd className="font-medium text-slate-800">
                  {row.referenceDetails}
                </dd>
              </div>
            )}
            {row.notes && (
              <div className="col-span-2">
                <dt className="text-[12px] text-slate-500">Note</dt>
                <dd className="font-medium text-slate-800">{row.notes}</dd>
              </div>
            )}
          </dl>
        </CardBody>
      </Card>

      {row.status === "active" && <DetailActions row={client} sms={sms} />}

      {/* Edit */}
      {row.status === "active" && (
        <Card>
          <CardHeader title="Edit details" subtitle="Do not change the serial number here." />
          <CardBody>
            <EditSerialForm row={client} requireAddress={clinic?.requireAddress ?? false} />
          </CardBody>
        </Card>
      )}

      {/* Change serial number — clinic admin only */}
      {user.role === "clinic_admin" && row.status === "active" && !row.isReference && (
        <ChangeSerialForm appointmentId={row.id} currentNumber={row.serialNumber} />
      )}

      {/* Audit history */}
      <Card>
        <CardHeader title="Activity history" />
        <CardBody>
          {audit.length === 0 ? (
            <p className="text-[13px] text-slate-500">No records.</p>
          ) : (
            <ol className="space-y-2.5">
              {audit.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start gap-2.5 border-l-2 border-slate-100 pl-3"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-800">
                      {auditActionLabel(a.action)}
                    </p>
                    <p className="text-[12px] text-slate-500">
                      {a.actorName || "—"} · {formatDateTime(a.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function auditActionLabel(action: string): string {
  switch (action) {
    case "create_serial":
      return "Serial created";
    case "create_reference":
      return "Reference created";
    case "update_serial":
      return "Details updated";
    case "cancel_serial":
      return "Serial cancelled";
    case "change_serial_number":
      return "Serial number changed";
    default:
      return action;
  }
}
