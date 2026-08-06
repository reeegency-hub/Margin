"use client";

import { useMemo, useState } from "react";
import { FeatureSection } from "@/components/ui/FeatureSection";
import { AFFILIATE, LAUNCH_OFFER } from "@/lib/affiliate";

export function AffiliatePanel({
  referralCode,
  referralUrl,
  referralCount,
  creditMonths,
}: {
  referralCode: string;
  referralUrl: string;
  referralCount: number;
  creditMonths: number;
}) {
  const [copied, setCopied] = useState(false);
  const message = useMemo(
    () =>
      `Je gère mon stock avec Margin Shop (caisse → stock + alertes WhatsApp). ` +
      `Avec mon lien tu as −${AFFILIATE.discountPercentReferee} % le 1er mois : ${referralUrl}`,
    [referralUrl]
  );

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <FeatureSection
        title="Parrainez un commerce"
        subtitle="Partagez votre lien — vous gagnez, ils démarrent moins cher."
      />
      <div className="dash-card dash-card--dark space-y-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide opacity-60">
            Votre code
          </p>
          <p className="mt-1 font-mono text-[20px] font-bold tracking-wide">
            {referralCode}
          </p>
        </div>

        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide opacity-60">
            Lien à partager
          </p>
          <p className="mt-1 break-all rounded-[12px] bg-[var(--bg-app)] p-3 font-mono text-[12px]">
            {referralUrl}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-lime btn-lime--sm"
              onClick={() => void copy(referralUrl)}
            >
              {copied ? "Copié" : "Copier le lien"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => void copy(message)}
            >
              Copier le message
            </button>
            <a
              className="btn-ghost"
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer"
            >
              Envoyer sur WhatsApp
            </a>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[12px] bg-[var(--bg-app)] p-3">
            <p className="text-[12px] opacity-60">Filleuls inscrits</p>
            <p className="text-[22px] font-bold">{referralCount}</p>
          </div>
          <div className="rounded-[12px] bg-[var(--bg-app)] p-3">
            <p className="text-[12px] opacity-60">Mois de crédit gagnés</p>
            <p className="text-[22px] font-bold">{creditMonths}</p>
          </div>
        </div>
      </div>

      <FeatureSection
        next
        title="Comment ça marche"
        subtitle="Offre claire pour vous et pour le commerce que vous invitez."
      />
      <div className="dash-card dash-card--light space-y-3 text-[15px]">
        <ul className="space-y-2">
          <li>
            <strong>Vous</strong> : +{AFFILIATE.rewardMonthsReferrer} mois
            offert{AFFILIATE.rewardMonthsReferrer > 1 ? "s" : ""} sur votre abo
            pour chaque filleul qui paie son 1<sup>er</sup> mois.
          </li>
          <li>
            <strong>Eux</strong> : −{AFFILIATE.discountPercentReferee} % sur le
            1<sup>er</sup> mois (Commerce ou Franchise).
          </li>
          <li>
            Ideal pour : confrères du quartier, franchiseux, installateurs
            caisse, comptables TPE.
          </li>
        </ul>
        <p className="text-[13px] text-[var(--text-secondary-light)]">
          Accroche terrain : « {LAUNCH_OFFER.hook} ». Les crédits s’accumulent
          ici. L’application automatique sur la facture Stripe arrive ensuite
          (Ops / portail facturation).
        </p>
      </div>
    </>
  );
}
