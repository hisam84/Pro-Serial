import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireSuperAdmin } from "@/lib/auth";
import { listClinics } from "@/lib/clinics";
import { buttonClass } from "@/components/ui/button";
import { Badge, Card, CardBody, EmptyState } from "@/components/ui/card";
import { PlusIcon, SearchIcon } from "@/components/ui/icons";
import { toDigits } from "@/lib/utils";

export const metadata = { title: "Clinics" };

const STATUS_BADGE: Record<string, "active" | "cancelled" | "neutral"> = {
  active: "active",
  suspended: "cancelled",
  deactivated: "neutral",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  suspended: "Suspended",
  deactivated: "Deactivated",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function ClinicsPage({ searchParams }: PageProps) {
  const db = await getDb();
  await requireSuperAdmin(db);

  const sp = await searchParams;
  const search = first(sp.q);
  const status = first(sp.status) as "" | "active" | "suspended" | "deactivated";

  const rows = await listClinics(db, { search, status });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Clinics</h1>
        <Link href="/super-admin/clinics/new" className={buttonClass("primary", "md")}>
          <PlusIcon size={18} />
          New clinic
        </Link>
      </div>

      {/* Search + filter */}
      <form className="flex flex-col gap-2 sm:flex-row" action="/super-admin/clinics">
        <div className="relative flex-1">
          <SearchIcon
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search by clinic name or phone…"
            className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-[15px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25"
          />
        </div>
        <select
          name="status"
          defaultValue={status}
          className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-[15px] outline-none focus:border-brand-600"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deactivated">Deactivated</option>
        </select>
        <button
          type="submit"
          className={buttonClass("secondary", "md", "sm:w-auto w-full")}
        >
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No clinics found"
            description="Try a different search or create a new clinic."
            action={
              <Link href="/super-admin/clinics/new" className={buttonClass("primary", "md")}>
                <PlusIcon size={18} />
                New clinic
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {rows.map((c) => (
            <Link key={c.id} href={`/super-admin/clinics/${c.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardBody>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-slate-900">
                        {c.name}
                      </p>
                      <p className="mt-0.5 text-[12px] text-slate-500">
                        {c.phone || "No phone"}
                        {c.address ? ` · ${c.address}` : ""}
                      </p>
                    </div>
                    <Badge variant={STATUS_BADGE[c.status] ?? "neutral"}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </Badge>
                  </div>
                  <dl className="mt-3 flex gap-4 text-[12px] text-slate-500">
                    <div>
                      Doctor{" "}
                      <dd className="inline font-semibold text-slate-700">
                        {toDigits(c.doctorCount)}
                      </dd>
                    </div>
                    <div>
                      Staff{" "}
                      <dd className="inline font-semibold text-slate-700">
                        {toDigits(c.attendantCount)}
                      </dd>
                    </div>
                    <div>
                      Admin{" "}
                      <dd className="inline font-semibold text-slate-700">
                        {c.adminUsername ?? "—"}
                      </dd>
                    </div>
                  </dl>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
