export function SiteFooter() {
  return (
    <footer className="border-t border-slate-100 bg-white/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 text-[12px] text-slate-400 sm:px-6">
        <span>Serial Pro</span>
        <span>
          Technical Support:{" "}
          <a
            href="https://hisam-omega.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-500 underline-offset-4 transition-colors hover:text-brand-700 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            Hisam Uddin
          </a>
        </span>
      </div>
    </footer>
  );
}
