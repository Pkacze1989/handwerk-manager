import Link from "next/link";

export const fieldClass =
  "mt-1 w-full rounded-xl border border-line bg-sand px-3 py-2 text-sm text-ink outline-none focus:border-spruce focus:ring-2 focus:ring-spruce/20";
export const labelClass = "block text-xs font-semibold uppercase tracking-[0.14em] text-muted";
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-spruce px-4 py-2 text-sm font-semibold text-white transition hover:bg-spruce-deep disabled:opacity-50";
export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-sand";
export const btnDanger =
  "inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold text-bad hover:bg-red-50";

export function PageHeader({
  eyebrow,
  title,
  text,
  actions,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-copper">{eyebrow}</p> : null}
        <h1 className="mt-1 font-serif text-3xl tracking-tight text-ink sm:text-4xl">{title}</h1>
        {text ? <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-line bg-white p-5 shadow-card ${className}`}>{children}</section>;
}

export function Flash({ hinweis, fehler }: { hinweis?: string; fehler?: string }) {
  if (!hinweis && !fehler) return null;
  return (
    <p className={`mb-6 rounded-2xl px-4 py-3 text-sm ${fehler ? "bg-red-50 text-bad" : "bg-spruce-soft text-spruce"}`}>
      {fehler || hinweis}
    </p>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "copper" }) {
  const tones = {
    neutral: "bg-sand text-muted",
    good: "bg-spruce-soft text-spruce",
    warn: "bg-amber-50 text-warn",
    bad: "bg-red-50 text-bad",
    copper: "bg-copper-soft text-copper",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  placeholder,
  as,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
  placeholder?: string;
  as?: "textarea";
  children?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children ? (
        children
      ) : as === "textarea" ? (
        <textarea className={fieldClass} name={name} defaultValue={defaultValue ?? ""} required={required} rows={4} placeholder={placeholder} />
      ) : (
        <input className={fieldClass} name={name} type={type} defaultValue={defaultValue ?? ""} required={required} placeholder={placeholder} />
      )}
    </label>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{children}</p>;
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-spruce underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
