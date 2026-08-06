"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { BreadcrumbItem } from "@/components/layout/types";

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
}) {
  const deep = (breadcrumbs?.length ?? 0) > 1;

  return (
    <header className="ds-page-header">
      {deep && breadcrumbs ? (
        <nav className="ds-page-header__crumbs" aria-label="Fil d’Ariane">
          {breadcrumbs.map((c, i) => (
            <span key={`${c.label}-${i}`}>
              {i > 0 ? <span className="ds-page-header__sep">/</span> : null}
              {c.href ? (
                <Link href={c.href}>{c.label}</Link>
              ) : (
                <span aria-current={i === breadcrumbs.length - 1 ? "page" : undefined}>
                  {c.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="ds-page-header__row">
        <div>
          <h1 className="ds-page-header__title">{title}</h1>
          {description ? (
            <p className="ds-page-header__desc">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="ds-page-header__actions">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
