import type { ReactNode } from "react";
import Link from "next/link";
import { PageTitleSync } from "@/components/PageTitle";

export type BrandTone =
  | "navy"
  | "terracotta"
  | "forest"
  | "linen"
  | "dark"
  | "dark-card"
  | "light"
  | "lime";

const toneClass: Record<BrandTone, string> = {
  navy: "brand-card--navy",
  terracotta: "brand-card--terracotta",
  forest: "brand-card--forest",
  linen: "brand-card--linen",
  dark: "brand-card--navy",
  "dark-card": "brand-card--dark-card",
  light: "brand-card--light",
  lime: "brand-card--lime",
};

export function BrandCard({
  tone,
  title,
  proof,
  children,
  className = "",
}: {
  tone: BrandTone;
  title: string;
  proof?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`brand-card ${toneClass[tone]} ${className}`}>
      <h2 className="brand-card__title">{title}</h2>
      {proof ? <p className="brand-card__proof">{proof}</p> : null}
      {children}
    </section>
  );
}

export function MockInset({ children }: { children: ReactNode }) {
  return <div className="mock-inset">{children}</div>;
}

export function BrandCta({
  children,
  href,
  type = "button",
  formAction,
  ghost = false,
}: {
  children: ReactNode;
  href?: string;
  type?: "button" | "submit";
  formAction?: (formData: FormData) => void | Promise<void>;
  ghost?: boolean;
}) {
  const cls = ghost ? "btn-ghost" : "btn-lime";
  if (href) {
    return (
      <Link href={href} className={`${cls} mt-[18px]`}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={`${cls} mt-[18px]`} formAction={formAction}>
      {children}
    </button>
  );
}

/** One question title + one-line guide (header visible sur toutes les pages). */
export function BrandPage({
  question,
  guide,
  children,
  /** @deprecated use question */
  title,
  /** @deprecated unused — avoid eyebrow doublon */
  eyebrow,
}: {
  question?: string;
  guide?: string;
  children: ReactNode;
  title?: string;
  eyebrow?: string;
}) {
  void eyebrow;
  const heading = question || title;
  return (
    <div className="dashboard-view">
      <PageTitleSync title={heading} guide={guide} />
      {heading ? (
        <header className="module-page-header">
          <h1 className="module-page-title">{heading}</h1>
          {guide ? <p className="module-page-lead">{guide}</p> : null}
        </header>
      ) : null}
      <div className="module-stack">{children}</div>
    </div>
  );
}
