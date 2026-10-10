import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { clinics } from "@/db/schema";
import { eq } from "drizzle-orm";
import { BottomNav, SideNav, TopBar } from "@/components/shell/shell";
import { PwaInstallPrompt } from "@/components/shell/pwa-install-prompt";
import { SiteFooter } from "@/components/shell/site-footer";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const db = await getDb();
  const user = await getSessionUser(db);
  if (!user) redirect("/login");

  let clinicName: string | null = null;
  if (user.clinicId) {
    const rows = await db
      .select({ name: clinics.name })
      .from(clinics)
      .where(eq(clinics.id, user.clinicId))
      .limit(1);
    clinicName = rows[0]?.name ?? null;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar userName={user.name} clinicName={clinicName} role={user.role} />
      <PwaInstallPrompt />
      <div className="mx-auto flex w-full max-w-6xl flex-1">
        <SideNav role={user.role} />
        <main className="min-w-0 flex-1 px-4 pb-24 pt-4 sm:px-6 lg:pb-10 lg:pt-6">
          {children}
        </main>
      </div>
      <SiteFooter />
      <BottomNav role={user.role} />
    </div>
  );
}
