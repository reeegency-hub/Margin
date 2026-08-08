"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  clearGuideFocus,
  pathFromHref,
  readGuideFocus,
  writeGuideFocus,
  type GuideFocus,
} from "@/components/home/guide-focus";
import { GuideActionSpotlight } from "@/components/home/GuideActionSpotlight";
import { updateSettings, testWhatsApp } from "@/app/actions";
import { WaSendLabel } from "@/components/ui/WhatsAppIcon";
import { getGuideSpotCopy } from "@/lib/guide-spotlight-copy";
import type { FirstHourState } from "@/lib/first-hour";
import {
  focusGuideWorkTarget,
  isGuideHandedOff,
  setGuideHandoff,
} from "@/lib/guide-anchors";

const WA_FOCUS_IDS = new Set([
  "shop-settings",
  "home-wa",
  "shop-wa",
]);

/** Tâches liées (même critère de done côté serveur). */
const TASK_ALIASES: Record<string, string[]> = {
  "shop-settings": ["home-wa", "shop-wa"],
  "home-wa": ["shop-settings", "shop-wa"],
  "shop-wa": ["shop-settings", "home-wa"],
  "stock-levels": ["home-products", "stock-products"],
  "home-products": ["stock-levels", "stock-products"],
  "stock-import": ["home-import"],
  "home-import": ["stock-import"],
  "stock-count": ["home-count", "home-weekly-inv", "cost-weekly"],
  "home-count": ["stock-count"],
  "home-weekly-inv": ["cost-weekly", "stock-count"],
  "cost-weekly": ["home-weekly-inv", "stock-count"],
  "team-members": ["home-team"],
  "home-team": ["team-members"],
  "team-planning": ["home-planning"],
  "home-planning": ["team-planning"],
  "team-clock": ["home-clock"],
  "home-clock": ["team-clock"],
  "courses-list": ["home-orders"],
  "home-orders": ["courses-list"],
  "cost-invoice": ["home-invoice"],
  "home-invoice": ["cost-invoice"],
  "cost-food": ["home-foodcost"],
  "home-foodcost": ["cost-food"],
  "shop-pos": ["home-pos"],
  "home-pos": ["shop-pos"],
  "shop-delivery": ["home-delivery"],
  "home-delivery": ["shop-delivery"],
};

function readLocalCompletedIds(restaurantId?: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(
      `margin:guide:${restaurantId || "shop"}`
    );
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { completedIds?: string[] };
    return new Set((parsed.completedIds || []).map(String));
  } catch {
    return new Set();
  }
}

function isFocusTaskComplete(
  taskId: string,
  firstHour: FirstHourState | null | undefined,
  whatsappTo: string,
  restaurantId?: string
): boolean {
  if (WA_FOCUS_IDS.has(taskId) && whatsappTo.trim()) return true;

  const localDone = readLocalCompletedIds(restaurantId);
  const checkIds = [taskId, ...(TASK_ALIASES[taskId] || [])];
  if (checkIds.some((id) => localDone.has(id))) return true;

  if (!firstHour?.bundle) return false;
  for (const guide of Object.values(firstHour.bundle)) {
    for (const item of guide.items) {
      if (checkIds.includes(item.id) && item.done) return true;
    }
  }
  return false;
}

function demoFocus(
  id: string,
  href: string,
  path: string,
  sectionTitle: string,
  hint?: string
) {
  const spot = getGuideSpotCopy(id, { hint, sectionTitle });
  return {
    id,
    label: spot.title,
    hint,
    cta: spot.title,
    href,
    path,
    sectionTitle,
    incentives: spot.steps,
    footHint: spot.footHint,
  };
}

/** Focus de démo — permet de relancer via ?guide=home-wa (ou shop-settings). */
const DEMO_FOCUSES: Record<string, ReturnType<typeof demoFocus>> = {
  "home-wa": demoFocus(
    "home-wa",
    "/settings",
    "/settings",
    "Commerce",
    "Alertes rupture et listes sur le téléphone."
  ),
  "shop-settings": demoFocus(
    "shop-settings",
    "/settings",
    "/settings",
    "Commerce",
    "Numéro du commerce pour les alertes et listes."
  ),
  "cost-invoice": demoFocus(
    "cost-invoice",
    "/costs#facture",
    "/costs",
    "Coûts",
    "CSV, PDF ou photo — jamais de saisie manuelle."
  ),
  "home-invoice": demoFocus(
    "home-invoice",
    "/costs#facture",
    "/costs",
    "Coûts",
    "CSV, PDF ou photo — jamais de saisie manuelle."
  ),
};

/**
 * Coach sur la page cible + bulle collée à l’action (pulse).
 * Relancer : /settings?guide=home-wa  (ou n’importe quel id first-hour)
 * Disparaît dès que la tâche guide est done.
 */
export function GuideFocusBanner({
  whatsappTo = "",
  firstHour = null,
  restaurantId,
}: {
  whatsappTo?: string;
  firstHour?: FirstHourState | null;
  restaurantId?: string;
}) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const [focus, setFocus] = useState<GuideFocus | null>(null);
  const [spotHidden, setSpotHidden] = useState(false);

  function dismissAll() {
    clearGuideFocus();
    setFocus(null);
    const params = new URLSearchParams(searchParams.toString());
    if (params.has("guide")) {
      params.delete("guide");
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname);
    }
  }

  function focusFromFirstHour(guideId: string): GuideFocus | null {
    if (!firstHour?.bundle) return null;
    for (const guide of Object.values(firstHour.bundle)) {
      const item = guide.items.find((i) => i.id === guideId);
      if (!item) continue;
      const spot = getGuideSpotCopy(item.id, {
        label: item.label,
        hint: item.hint,
        cta: item.cta,
        sectionTitle: guide.title,
      });
      return {
        id: item.id,
        label: spot.title,
        hint: item.hint,
        cta: item.cta || spot.title,
        href: item.href,
        path: pathFromHref(item.href),
        sectionTitle: guide.title,
        incentives: spot.steps,
        footHint: spot.footHint,
      };
    }
    return null;
  }

  useEffect(() => {
    const guideId = searchParams.get("guide");
    let stored = readGuideFocus();

    // ?guide=<id> : démo connue, puis tâche first-hour, sinon focus session
    if (guideId) {
      const fromDemo = DEMO_FOCUSES[guideId];
      const fromHour = focusFromFirstHour(guideId);
      const seeded = fromDemo || fromHour;
      if (seeded && (!stored || stored.id !== seeded.id)) {
        writeGuideFocus(seeded);
        stored = seeded;
      }
    }

    if (!stored) {
      setFocus(null);
      return;
    }

    if (
      isFocusTaskComplete(
        stored.id,
        firstHour,
        whatsappTo,
        restaurantId
      ) ||
      (WA_FOCUS_IDS.has(stored.id) && searchParams.get("saved") === "1")
    ) {
      clearGuideFocus();
      setFocus(null);
      if (guideId || searchParams.get("saved") === "1") {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("guide");
        const q = params.toString();
        if (guideId) {
          router.replace(q ? `${pathname}?${q}` : pathname);
        }
      }
      return;
    }

    // Réaligner titre / steps sur la copy canonique (évite un focus périmé en session)
    const spot = getGuideSpotCopy(stored.id, {
      label: stored.label,
      hint: stored.hint,
      cta: stored.cta,
      sectionTitle: stored.sectionTitle,
    });
    const aligned: GuideFocus = {
      ...stored,
      label: spot.title,
      incentives: spot.steps,
      footHint: spot.footHint,
    };
    if (
      aligned.label !== stored.label ||
      aligned.footHint !== stored.footHint ||
      aligned.incentives.join("\n") !== (stored.incentives || []).join("\n")
    ) {
      writeGuideFocus(aligned);
    }

    const onTarget =
      pathname === aligned.path ||
      pathname.startsWith(`${aligned.path}/`) ||
      (guideId != null && guideId === aligned.id);
    setFocus(onTarget ? aligned : null);

    const hash =
      typeof window !== "undefined" ? window.location.hash || "" : "";
    if (onTarget && hash.startsWith("#guide-work")) {
      setGuideHandoff(aligned.id);
    }

    const handedOff = isGuideHandedOff(aligned.id);
    setSpotHidden(handedOff);
    if (onTarget && handedOff) {
      window.setTimeout(() => {
        focusGuideWorkTarget(aligned.id);
      }, 200);
    }
  }, [
    pathname,
    searchParams,
    firstHour,
    whatsappTo,
    restaurantId,
    router,
  ]);

  if (!focus) return null;

  const showWhatsAppForm =
    WA_FOCUS_IDS.has(focus.id) && pathname.startsWith("/settings");

  return (
    <>
      <aside className="ms-spot__card guide-coach guide-coach--compact" aria-label="Coach du guide">
        <div className="guide-coach__main">
          <p className="ms-spot__eyebrow">
            {focus.sectionTitle
              ? `Étape · ${focus.sectionTitle}`
              : "Étape en cours"}
          </p>
          <h2 className="ms-spot__title">{focus.label}</h2>
          {focus.hint ? (
            <p className="ms-spot__lead">
              <strong>Pourquoi :</strong> {focus.hint}
            </p>
          ) : null}

          {showWhatsAppForm ? (
            <div className="guide-coach__action">
              <form
                action={updateSettings}
                className="guide-coach__form"
                onSubmit={(e) => {
                  const fd = new FormData(e.currentTarget);
                  const wa = String(fd.get("whatsappTo") || "").trim();
                  if (wa) {
                    window.setTimeout(() => dismissAll(), 400);
                  }
                }}
              >
                <label className="guide-coach__label" htmlFor="guide-wa">
                  Votre numéro WhatsApp
                </label>
                <input
                  id="guide-wa"
                  name="whatsappTo"
                  className="guide-coach__input"
                  defaultValue={whatsappTo}
                  placeholder="+33612345678"
                  autoComplete="tel"
                  inputMode="tel"
                />
                <div className="ms-spot__actions">
                  <button
                    type="submit"
                    className="btn-lime"
                    data-guide-action="wa-save"
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
              <form action={testWhatsApp}>
                <button type="submit" className="ms-spot__later">
                  <WaSendLabel kind="test" />
                </button>
              </form>
              <p className="ms-spot__hint">
                En enregistrant, vous acceptez de recevoir des messages Margin
                liés au commerce.{" "}
                <a href="/legal/confidentialite">Confidentialité</a>
              </p>
            </div>
          ) : null}

          <p className="ms-spot__hint">
            Suivez la bulle près du bouton.{" "}
            <Link href="/">Retour au parcours</Link>
          </p>
        </div>
        <button
          type="button"
          className="ms-spot__close"
          aria-label="Masquer le coach"
          onClick={dismissAll}
        >
          ×
        </button>
      </aside>

      {!spotHidden ? (
        <GuideActionSpotlight
          taskId={focus.id}
          title={focus.label}
          steps={focus.incentives}
          hint={focus.hint}
          footHint={focus.footHint}
          onDismiss={dismissAll}
          
        />
      ) : null}
    </>
  );
}