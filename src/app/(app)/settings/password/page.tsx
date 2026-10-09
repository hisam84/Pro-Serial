import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { PasswordForm } from "@/components/settings/password-form";
import { LinkBack } from "@/components/ui/link-back";
import { Card, CardBody } from "@/components/ui/card";
import { Suspense } from "react";

export const metadata = { title: "Change password" };

export default async function PasswordPage() {
  const db = await getDb();
  const user = await requireUser(db);
  void user;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <LinkBack href="/settings">Settings</LinkBack>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          Change password
        </h1>
      </div>
      <Card>
        <CardBody>
          <Suspense>
            <PasswordForm />
          </Suspense>
        </CardBody>
      </Card>
    </div>
  );
}
