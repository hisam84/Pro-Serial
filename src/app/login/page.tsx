import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";
import { isPgLiteMode } from "@/db";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const db = await getDb();
  const user = await getSessionUser(db);
  if (user) {
    redirect(user.role === "super_admin" ? "/super-admin" : user.role === "clinic_admin" ? "/clinic" : "/serials");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-700 text-2xl font-bold text-white shadow-lg shadow-brand-700/25">
            S
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Serial Pro</h1>
          <p className="mt-1 text-[15px] text-slate-500">
            Clinic serial and appointment management
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          If you have trouble, contact your clinic admin.
        </p>
        {isPgLiteMode() && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
            Demo mode: using the local demo database.{" "}
            <code className="font-mono">npm run db:seed</code> to create demo accounts.
          </p>
        )}
      </div>
    </main>
  );
}
