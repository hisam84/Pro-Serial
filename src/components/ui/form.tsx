import { cn } from "@/lib/utils";

/* ── Field wrapper: label + control + error text ───────────────────── */

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-[15px] font-medium text-slate-800"
      >
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-[13px] text-slate-500">{hint}</p>
      )}
      {error && (
        <p role="alert" className="text-[13px] font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/* ── Inputs ────────────────────────────────────────────────────────── */

const controlClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 text-[15px] text-slate-900 " +
  "placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 " +
  "disabled:bg-slate-100 disabled:text-slate-500 outline-none transition-colors";

export function Input({
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      className={cn(
        controlClass,
        "h-11",
        error && "border-red-500 focus:border-red-500 focus:ring-red-500/25",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  error,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      className={cn(
        controlClass,
        "min-h-[88px] py-2.5",
        error && "border-red-500 focus:border-red-500 focus:ring-red-500/25",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  error,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select
      className={cn(
        controlClass,
        "h-11 appearance-none bg-no-repeat pr-10",
        error && "border-red-500 focus:border-red-500 focus:ring-red-500/25",
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 0.7rem center",
      }}
      {...props}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  className,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 text-[15px] text-slate-800 select-none",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="mt-1 size-5 shrink-0 rounded border-slate-300 text-brand-700 focus:ring-brand-600"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
