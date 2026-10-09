import Link from "next/link";
import { ChevronLeftIcon } from "./icons";

export function LinkBack({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-0.5 text-[13px] font-medium text-slate-500 hover:text-brand-700"
    >
      <ChevronLeftIcon size={16} />
      {children}
    </Link>
  );
}
