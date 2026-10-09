import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { homePathFor } from "@/components/shell/nav";

export default async function RootPage() {
  const db = await getDb();
  const user = await getSessionUser(db);
  if (!user) redirect("/login");
  redirect(homePathFor(user));
}
