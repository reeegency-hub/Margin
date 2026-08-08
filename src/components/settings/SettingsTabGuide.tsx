"use client";

import { useEffect, useId, useLayoutEffect, useState } from "react";
import { MsSpotBubble, MsSpotRing } from "@/components/ui/MsSpotBubble";

export type SettingsTabId =
  | "simple"
  | "affiliation"
  | "connexions"
  | "avance";

const GUIDE: Record<
  SettingsTabId,
  {
    eyebrow: string;
    title: string;
    lead: string;
    list: string[];
    hint: string;
    selector: string;
  }
> = {
  simple: {
    eyebrow: "Réglages · Simple",
    title: "WhatsApp = le fil du commerce",
    lead: "C’est l’onglet du quotidien : numéro pour alertes stock, listes de courses et pointage. La facturation Stripe est ici si votre abonnement est lié.",
    list: [
      "Enregistrez un numéro au format +336…",
      "Testez l’envoi pour vérifier la réception",
      "Factures / carte → portail Stripe (si affiché)",
    ],
    hint: "Sans numéro, Margin ne peut pas vous écrire sur WhatsApp.",
    selector: '[data-settings-tab="simple"]',
  },
  affiliation: {
    eyebrow: "Réglages · Affiliation",
    title: "Parrainez, gagnez des mois",
    lead: "Partagez votre lien : chaque commerce qui s’inscrit via ce lien vous rapporte du crédit d’abonnement.",
    list: [
      "Copiez le lien ou le code",
      "Envoyez-le à un confrère commerçant",
      "Suivez le compteur de filleuls ici",
    ],
    hint: "Le crédit s’accumule sur le compte — visible dans cet onglet.",
    selector: '[data-settings-tab="affiliation"]',
  },
  connexions: {
    eyebrow: "Réglages · Connexions",
    title: "Coffre-fort des clés livraison",
    lead: "Rangez ici les clés API Uber Eats / Deliveroo. Ce n’est pas encore la sync live des commandes — juste le stockage sécurisé pour la suite.",
    list: [
      "Collez la clé fournie par la plateforme",
      "Elle est chiffrée côté serveur",
      "La caisse (Zelty…) se branche dans Commerce → Caisse",
    ],
    hint: "Pour la caisse, ouvrez plutôt la page Caisse — pas cet onglet.",
    selector: '[data-settings-tab="connexions"]',
  },
  avance: {
    eyebrow: "Réglages · Avancé",
    title: "Votre IA (BYOK) + technique",
    lead: "Connectez votre clé Anthropic ou OpenAI pour l’assistant Margin. L’usage est facturé sur votre compte provider — pas sur l’abonnement Margin.",
    list: [
      "Choisissez le provider puis collez la clé",
      "Jamais renvoyée au navigateur après enregistrement",
      "Webhook WhatsApp = adresse technique (optionnel)",
    ],
    hint: "Sans clé IA, les imports CSV restent possibles ; le chat libre est limité.",
    selector: '[data-settings-tab="avance"]',
  },
};

function storageKey(restaurantId: string | undefined, tab: SettingsTabId) {
  return `margin:settings-guide:${restaurantId || "shop"}:${tab}`;
}

/**
 * Popup de compréhension à l’entrée de chaque onglet Réglages.
 */
export function SettingsTabGuide({
  tab,
  restaurantId,
  forceOpen = false,
  onConsumedForce,
}: {
  tab: SettingsTabId;
  restaurantId?: string;
  forceOpen?: boolean;
  onConsumedForce?: () => void;
}) {
  const titleId = useId();
  const copy = GUIDE[tab];
  const [visible, setVisible] = useState(false);
  const [spot, setSpot] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (forceOpen) {
      setVisible(true);
      onConsumedForce?.();
      return;
    }

    try {
      if (localStorage.getItem(storageKey(restaurantId, tab))) {
        setVisible(false);
        return;
      }
    } catch {
      /* ignore */
    }

    const t = window.setTimeout(() => setVisible(true), 350);
    return () => window.clearTimeout(t);
  }, [tab, restaurantId, forceOpen, onConsumedForce]);

  useLayoutEffect(() => {
    if (!visible) return;

    function measure() {
      const el = document.querySelector<HTMLElement>(copy.selector);
      if (!el) {
        setSpot(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setSpot({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      });
      el.classList.add("is-spotlight");
    }

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      document
        .querySelector(copy.selector)
        ?.classList.remove("is-spotlight");
    };
  }, [visible, copy.selector]);

  function dismiss() {
    try {
      localStorage.setItem(storageKey(restaurantId, tab), "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  const bubbleW = Math.min(320, typeof window !== "undefined" ? window.innerWidth - 24 : 320);
  let bubbleTop = 120;
  let bubbleLeft = 16;

  if (spot) {
    bubbleLeft = spot.left + spot.width / 2 - bubbleW / 2;
    bubbleLeft = Math.max(
      12,
      Math.min(bubbleLeft, window.innerWidth - bubbleW - 12)
    );
    bubbleTop = Math.min(
      spot.top + spot.height + 14,
      window.innerHeight - 300
    );
    if (bubbleTop < 72) bubbleTop = spot.top + spot.height + 14;
  }

  return (
    <div
      className="ms-spot"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="ms-spot__scrim"
        aria-label="Fermer le guide"
        onClick={dismiss}
      />
      {spot ? <MsSpotRing {...spot} /> : null}
      <MsSpotBubble
        titleId={titleId}
        eyebrow={copy.eyebrow}
        title={copy.title}
        lead={copy.lead}
        list={copy.list}
        hint={copy.hint}
        style={{ top: bubbleTop, left: bubbleLeft, width: bubbleW }}
        actions={
          <button type="button" className="btn-lime" onClick={dismiss}>
            C’est compris
          </button>
        }
      />
    </div>
  );
}

export function settingsGuideCopy(tab: SettingsTabId) {
  return GUIDE[tab];
}
