"use client";

import { useEffect, useId, useLayoutEffect, useState } from "react";
import { MsSpotBubble, MsSpotRing } from "@/components/ui/MsSpotBubble";

const STORAGE_KEY = (restaurantId?: string) =>
  `margin:assistant-intro:${restaurantId || "shop"}`;

type Spot = { top: number; left: number; width: number; height: number };

/**
 * Popover ciblant le panneau Assistant docké à droite.
 */
export function AssistantTopbarSpotlight({
  restaurantId,
  onOpenAssistant,
  enabled = true,
}: {
  restaurantId?: string;
  onOpenAssistant: () => void;
  enabled?: boolean;
}) {
  const titleId = useId();
  const [visible, setVisible] = useState(false);
  const [spot, setSpot] = useState<Spot | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    try {
      if (localStorage.getItem(STORAGE_KEY(restaurantId))) return;
    } catch {
      /* ignore */
    }
    let attempts = 0;
    const tryShow = () => {
      const pane = document.querySelector(".margin-asst-pane");
      if (pane) {
        setVisible(true);
        return;
      }
      attempts += 1;
      if (attempts < 20) window.setTimeout(tryShow, 150);
    };
    const t = window.setTimeout(tryShow, 500);
    return () => window.clearTimeout(t);
  }, [enabled, restaurantId]);

  useLayoutEffect(() => {
    if (!visible) return;

    function measure() {
      const pane = document.querySelector<HTMLElement>(".margin-asst-pane");
      if (!pane) {
        setSpot(null);
        return;
      }
      const r = pane.getBoundingClientRect();
      const highlightW = Math.min(72, r.width);
      setSpot({
        top: Math.max(12, r.top + 12),
        left: r.left + 8,
        width: highlightW,
        height: Math.min(120, Math.max(64, r.height * 0.18)),
      });
      pane.classList.add("is-spotlight");
    }

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      document
        .querySelector(".margin-asst-pane")
        ?.classList.remove("is-spotlight");
    };
  }, [visible]);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY(restaurantId), "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  function openNow() {
    dismiss();
    onOpenAssistant();
  }

  if (!visible || !spot) return null;

  const bubbleW = Math.min(320, window.innerWidth - 24);
  let bubbleLeft = spot.left - bubbleW - 14;
  if (bubbleLeft < 12) {
    bubbleLeft = Math.max(
      12,
      Math.min(spot.left + spot.width + 14, window.innerWidth - bubbleW - 12)
    );
  }
  const bubbleTop = Math.min(
    Math.max(12, spot.top),
    window.innerHeight - 280
  );

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
        aria-label="Fermer l’introduction"
        onClick={dismiss}
      />
      <MsSpotRing {...spot} />
      <MsSpotBubble
        titleId={titleId}
        eyebrow="Copilote Margin"
        title="Votre copilote reste à droite"
        lead="Il fait partie du produit au même titre que Stock ou Courses : configurez, importez, pilotez — avec aperçu avant toute écriture. Fermez-le quand vous voulez."
        list={[
          "Importer inventaire (CSV · PDF)",
          "Équipe & planning",
          "WhatsApp, caisse, où cliquer",
        ]}
        style={{ top: bubbleTop, left: bubbleLeft, width: bubbleW }}
        actions={
          <>
            <button type="button" className="btn-lime" onClick={openNow}>
              Compris
            </button>
            <button type="button" className="ms-spot__later" onClick={dismiss}>
              Plus tard
            </button>
          </>
        }
        hint="Réduire ou rouvrir · ⌘J"
      />
    </div>
  );
}
