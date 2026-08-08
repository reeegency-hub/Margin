"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PLANS,
  SETUP_FEE_EUR,
  type BillingPeriod,
  type PlanId,
  planLimitsLabel,
  planPeriodSuffix,
  planPrice,
} from "@/lib/plans";

function PlanDescription({
  text,
  featured,
}: {
  text: string;
  featured?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`pricing-card__more${featured ? " is-featured" : ""}`}>
      {open ? <p className="pricing-card__tag">{text}</p> : null}
      <button
        type="button"
        className="pricing-card__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Voir moins" : "Voir plus"}
      </button>
    </div>
  );
}

export function PricingPlans({
  selectedPlan,
  onSelect,
  ctaHref = "/login",
  showSetupNote = true,
  title,
  lead,
}: {
  selectedPlan?: PlanId | null;
  onSelect?: (plan: PlanId, period: BillingPeriod) => void;
  ctaHref?: string;
  showSetupNote?: boolean;
  title?: string;
  lead?: string;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  return (
    <div className="pricing">
      <div className="pricing__intro">
        {title ? <h2 className="pricing__title">{title}</h2> : null}
        {lead ? <p className="pricing__lead">{lead}</p> : null}
        <div className="pricing__toggle" role="group" aria-label="Période">
          <button
            type="button"
            className={period === "monthly" ? "is-active" : ""}
            onClick={() => setPeriod("monthly")}
          >
            Mensuel
          </button>
          <button
            type="button"
            className={period === "yearly" ? "is-active" : ""}
            onClick={() => setPeriod("yearly")}
          >
            Annuel
          </button>
          {period === "yearly" ? (
            <span className="pricing__save">−20 % / an</span>
          ) : null}
        </div>
      </div>

      <div className="pricing__grid pricing__grid--two">
        {PLANS.map((plan) => {
          const featured = Boolean(plan.featured);
          const selected = selectedPlan === plan.id;
          const price = planPrice(plan, period);
          const suffix = planPeriodSuffix(period);

          return (
            <article
              key={plan.id}
              className={`pricing-card${featured ? " is-featured" : ""}${
                selected ? " is-selected" : ""
              }`}
            >
              <div className="pricing-card__top">
                <h3>{plan.name}</h3>
                <p className="pricing-card__for">{plan.bestFor}</p>
                <p className="pricing-card__tier">{planLimitsLabel(plan)}</p>
                <PlanDescription text={plan.description} featured={featured} />
                <p className="pricing-card__price">
                  <sup>€</sup>
                  <strong>{price}</strong>
                  <span>{suffix} HT</span>
                  {period === "yearly" ? (
                    <em className="pricing-card__save">−20 %</em>
                  ) : null}
                </p>
                {onSelect ? (
                  <button
                    type="button"
                    className={`pricing-card__cta${featured ? " is-lime" : ""}`}
                    onClick={() => onSelect(plan.id, period)}
                  >
                    {selected ? "Sélectionné" : plan.cta}
                  </button>
                ) : (
                  <Link
                    href={`/signup?plan=${plan.id}&billing=${period}`}
                    className={`pricing-card__cta${featured ? " is-lime" : ""}`}
                  >
                    {plan.cta}
                  </Link>
                )}
              </div>
              <ul className="pricing-card__features">
                {plan.features.map((f) => (
                  <li
                    key={f.label}
                    className={
                      f.struck
                        ? "is-struck"
                        : f.highlight
                          ? "is-highlight"
                          : undefined
                    }
                  >
                    <span aria-hidden>{f.struck ? "✗" : "✓"}</span>
                    {f.label}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>

      {showSetupNote ? (
        <p className="pricing__note">
          <strong>Branchement caisse</strong> — non inclus sur Commerce (à faire
          de votre côté). Sur Franchise, Margin s’en occupe pour chaque
          commerce&nbsp;: environ {SETUP_FEE_EUR}&nbsp;€ économisés par site.
        </p>
      ) : null}
    </div>
  );
}
