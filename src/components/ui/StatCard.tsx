"use client";

import type { ReactNode } from "react";
import Link from "next/link";

/** Surfaces cartes : lime (accent) · white · ink (sombre). */
export type TrendTone = "lime" | "white" | "ink";

const toneClass: Record<TrendTone, string> = {
  lime: "trend-card--lime",
  white: "trend-card--white",
  ink: "trend-card--ink",
};

export function SeeMoreButton({ href }: { href?: string }) {
  if (!href) return null;
  return (
    <a href={href} className="see-more-link" aria-label="Voir plus">
      <span className="see-more" aria-hidden>
        ↗
      </span>
    </a>
  );
}

export function CardIcon({ children }: { children: ReactNode }) {
  return <div className="card-icon">{children}</div>;
}

export function StatCard({
  label,
  value,
  delta,
  deltaUp,
  tone = "ink",
  href,
  className = "",
}: {
  label: string;
  value: string;
  delta?: string | null;
  deltaUp?: boolean | null;
  tone?: TrendTone;
  href?: string;
  /** @deprecated icônes retirées pour homogénéiser les cartes */
  icon?: ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <p className="stat-card__label">{label}</p>
      <p className="stat-card__value tabular-nums">{value}</p>
      {delta ? (
        <p
          className={`stat-card__delta ${
            deltaUp === true
              ? "stat-card__delta--up"
              : deltaUp === false
                ? "stat-card__delta--down"
                : ""
          }`}
        >
          {deltaUp === true ? "↑ " : deltaUp === false ? "↓ " : ""}
          {delta}
        </p>
      ) : (
        <p className="stat-card__delta stat-card__delta--spacer" aria-hidden>
          &nbsp;
        </p>
      )}
    </>
  );

  const classes = `stat-card ${toneClass[tone]} ${className}`.trim();

  if (href) {
    return (
      <Link href={href} className={`${classes} stat-card--link`}>
        {body}
      </Link>
    );
  }

  return <article className={classes}>{body}</article>;
}
