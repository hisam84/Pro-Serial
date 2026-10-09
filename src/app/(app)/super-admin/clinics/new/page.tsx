import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireSuperAdmin } from "@/lib/auth";
import { CreateClinicForm } from "@/components/admin/clinic-forms";
import { LinkBack } from "@/components/ui/link-back";
import { Card, CardBody } from "@/components/ui/card";

export const metadata = { title: "New clinic" };

export default async function NewClinicPage() {
  const db = await getDb();
  await requireSuperAdmin(db);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <LinkBack href="/super-admin/clinics">Clinic list</LinkBack>
        <h1 className="mt-1 text-xl font-bold text-slate-900">New clinic</h1>
        <p className="text-[13px] text-slate-500">
          The clinic and its admin account are created together.
        </p>
      </div>
      <Card>
        <CardBody>
          <CreateClinicForm />
        </CardBody>
      </Card>
    </div>
  );
}
