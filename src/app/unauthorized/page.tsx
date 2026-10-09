import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";

export const metadata = { title: "Access denied" };

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <Banner type="error" title="You do not have access to this page.">
          Your role is not allowed to view this information.
        </Banner>
        <Link href="/" className={buttonClass("primary", "md")}>
          Back to home
        </Link>
      </div>
    </main>
  );
}
