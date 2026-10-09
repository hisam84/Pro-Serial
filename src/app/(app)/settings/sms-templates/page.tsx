import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { canManageSmsTemplates } from "@/lib/rbac";
import { listDoctors } from "@/lib/doctors";
import { SmsTemplateEditor } from "@/components/settings/sms-template-editor";
import { LinkBack } from "@/components/ui/link-back";

export const metadata = { title: "SMS template" };

export default async function SmsTemplatesPage() {
  const db = await getDb();
  const user = await requireUser(db);
  if (!canManageSmsTemplates(user) || !user.clinicId) redirect("/unauthorized");

  const doctors = await listDoctors(db, user.clinicId, { includeInactive: true });

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <LinkBack href="/settings">Settings</LinkBack>
        <h1 className="mt-1 text-xl font-bold text-slate-900">SMS template</h1>
        <p className="text-[13px] text-slate-500">
          Set a separate message for new and old patients for each doctor.
        </p>
      </div>

      <SmsTemplateEditor
        doctors={doctors.map((d) => ({
          id: d.id,
          name: d.name,
          smsTemplateNew: d.smsTemplateNew,
          smsTemplateOld: d.smsTemplateOld,
        }))}
      />
    </div>
  );
}
