"use client";

import Link from "next/link";

export type AssistantCardModel = {
  badge: string;
  title: string;
  lead?: string;
  steps?: string[];
  cta?: { label: string; href: string };
  secondary?: { label: string; href: string };
};

/** Carte structurée Copilote (même langage visuel que le wizard caisse). */
export function AssistantActionCard({
  badge,
  title,
  lead,
  steps,
  cta,
  secondary,
}: AssistantCardModel) {
  return (
    <div className="pos-wizard-skel">
      <div className="pos-wizard-skel__head">
        <span className="pos-wizard-skel__badge">{badge}</span>
        <h3 className="pos-wizard-skel__title">{title}</h3>
      </div>
      {lead ? <p className="pos-wizard-skel__lead">{lead}</p> : null}
      {steps && steps.length > 0 ? (
        <ol className="pos-wizard-skel__steps">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      ) : null}
      {cta || secondary ? (
        <div className="pos-wizard-skel__actions">
          {cta ? (
            <Link href={cta.href} className="pos-wizard-skel__cta">
              {cta.label}
            </Link>
          ) : null}
          {secondary ? (
            <Link href={secondary.href} className="pos-wizard-skel__secondary">
              {secondary.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
