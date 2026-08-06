import type { ReactNode } from "react";

export function Card({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
  tone?: "default" | "warn" | "danger" | "ok";
}) {
  return (
    <section className="card">
      {title ? <h2 className="card-title">{title}</h2> : null}
      {children}
    </section>
  );
}

export function ActionBlock({
  constat,
  cause,
  impact,
  action,
}: {
  constat: string;
  cause?: string | null;
  impact?: string | null;
  action: string;
}) {
  return (
    <div className="space-y-1.5 text-[13.5px] leading-relaxed">
      <p className="font-semibold text-[var(--ink)]">{constat}</p>
      {cause ? <p className="text-[12.5px] text-[var(--soy)]">{cause}</p> : null}
      {impact ? <p className="text-[12.5px] text-[var(--soy)]">{impact}</p> : null}
      <p className="t-action mt-1 text-[12px] font-medium">{action}</p>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-1">
      <p className="section-label" style={{ marginTop: 0 }}>
        {title}
      </p>
      {subtitle ? (
        <p className="mb-4 text-[13px] text-[var(--soy)]">{subtitle}</p>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export const inputClass = "field-input";

export const inputClassDark = "field-input field-input--dark";

export const btnPrimary =
  "pill-btn pill-btn--primary mt-0 inline-flex items-center justify-center";

export const btnSecondary =
  "pill-btn pill-btn--ghost pill-btn--sm inline-flex items-center justify-center";

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="section-label">{children}</div>;
}
