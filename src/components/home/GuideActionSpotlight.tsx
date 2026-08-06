"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  focusGuideWorkTarget,
  guideActionFromElement,
  resolveGuideTaskElement,
  setGuideHandoff,
} from "@/lib/guide-anchors";

type Spot = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type BubblePos = {
  top: number;
  left: number;
  placement: "bottom" | "top" | "right" | "left";
};

function computeBubble(
  spot: Spot,
  placement: "bottom" | "top" | "right" | "left" = "bottom",
  bubbleW: number,
  bubbleH: number
): BubblePos {
  const gap = 16;
  const pad = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = spot.top + spot.height + gap;
  let left = spot.left;
  let place = placement;

  if (placement === "top") {
    top = spot.top - bubbleH - gap;
    left = spot.left;
  } else if (placement === "right") {
    top = spot.top;
    left = spot.left + spot.width + gap;
  } else if (placement === "left") {
    top = spot.top;
    left = spot.left - bubbleW - gap;
  }

  // Recentre horizontalement sur la cible
  left = spot.left + spot.width / 2 - bubbleW / 2;

  if (top + bubbleH > vh - pad) {
    top = Math.max(pad, spot.top - bubbleH - gap);
    place = "top";
  }
  if (top < pad) top = pad;
  if (left + bubbleW > vw - pad) left = Math.max(pad, vw - bubbleW - pad);
  if (left < pad) left = pad;

  return { top, left, placement: place };
}

/**
 * Bulle collée à l’action du guide + pulse sur le contrôle cible.
 */
export function GuideActionSpotlight({
  taskId,
  title,
  steps,
  hint,
  footHint,
  onDismiss,
}: {
  taskId: string;
  title: string;
  steps: string[];
  hint?: string;
  footHint?: string;
  onDismiss?: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const pulsedRef = useRef<HTMLElement | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [bubble, setBubble] = useState<BubblePos | null>(null);
  const [found, setFound] = useState(false);

  const lines =
    steps.length > 0
      ? steps
      : hint
        ? [hint]
        : ["Faites l’action indiquée sur la zone mise en avant."];
  const footer =
    footHint || "Zone mise en avant — suivez les étapes puis validez.";

  useLayoutEffect(() => {
    let cancelled = false;
    let tries = 0;
    let scrolledOnce = false;

    function clearPulse() {
      if (pulsedRef.current) {
        pulsedRef.current.classList.remove("is-guide-pulse");
        pulsedRef.current = null;
      }
    }

    function measure() {
      if (cancelled) return;
      const { el, placement } = resolveGuideTaskElement(taskId);
      if (!el) {
        setFound(false);
        setSpot(null);
        setBubble(null);
        clearPulse();
        return;
      }

      setFound(true);
      if (pulsedRef.current !== el) {
        clearPulse();
        el.classList.add("is-guide-pulse");
        pulsedRef.current = el;
      }

      if (!scrolledOnce) {
        scrolledOnce = true;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }

      const r = el.getBoundingClientRect();
      const s: Spot = {
        top: r.top,
        left: r.left,
        width: Math.max(r.width, 44),
        height: Math.max(r.height, 40),
      };
      setSpot(s);

      requestAnimationFrame(() => {
        if (cancelled) return;
        const bw = panelRef.current?.offsetWidth || 300;
        const bh = panelRef.current?.offsetHeight || 160;
        setBubble(computeBubble(s, placement || "bottom", bw, bh));
      });
    }

    measure();
    const retry = window.setInterval(() => {
      tries += 1;
      measure();
      if (tries > 40) window.clearInterval(retry);
    }, 180);

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    return () => {
      cancelled = true;
      window.clearInterval(retry);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      clearPulse();
    };
  }, [taskId]);

  useEffect(() => {
    function handoffFrom(el: Element) {
      const action = guideActionFromElement(el) || taskId;
      setGuideHandoff(taskId);
      onDismiss?.();
      window.setTimeout(() => {
        if (!focusGuideWorkTarget(action)) {
          focusGuideWorkTarget(taskId);
        }
      }, 120);
    }

    function onClick(e: MouseEvent) {
      const t = e.target as Element | null;
      if (!t) return;

      const pulsed = pulsedRef.current;
      if (pulsed && (pulsed === t || pulsed.contains(t))) {
        handoffFrom(pulsed);
        return;
      }

      const cta = t.closest<HTMLElement>(
        "a.day-focus__cta[data-guide-action], a.day-focus__row[data-guide-action]"
      );
      if (!cta) return;
      handoffFrom(cta);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [taskId, onDismiss]);

  if (!found || !spot || !bubble) {
    return (
      <div className="guide-spot-layer" aria-live="polite">
        <div
          ref={panelRef}
          className="page-tour page-tour--anchor guide-spot-pop guide-spot-pop--searching"
          role="status"
          aria-labelledby={titleId}
        >
          <p className="guide-spot-searching">
            Recherche de l’étape… faites défiler si besoin.
          </p>
          <h2 id={titleId} className="page-tour__title">
            {title}
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="guide-spot-layer" aria-live="polite">
      <div
        className="page-tour-spot guide-spot-ring"
        style={{
          top: spot.top - 10,
          left: spot.left - 10,
          width: spot.width + 20,
          height: spot.height + 20,
        }}
        aria-hidden
      />

      <div
        ref={panelRef}
        className={`page-tour page-tour--anchor guide-spot-pop page-tour--${bubble.placement} is-anchored`}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        style={{ top: bubble.top, left: bubble.left }}
      >
        <div
          className={`guide-spot-arrow guide-spot-arrow--${bubble.placement}`}
          aria-hidden
        />
        <header className="page-tour__head">
          <div className="page-tour__kicker">
            <span className="page-tour__pill">À faire ici</span>
          </div>
          {onDismiss ? (
            <button
              type="button"
              className="page-tour__close"
              aria-label="Masquer l’aide"
              onClick={onDismiss}
            >
              ×
            </button>
          ) : null}
        </header>

        <div className="page-tour__body">
          <h2 id={titleId} className="page-tour__title">
            {title}
          </h2>
          <ol className="guide-spot-steps">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>

        <footer className="page-tour__foot">
          <p className="guide-spot-hint">{footer}</p>
        </footer>
      </div>
    </div>
  );
}
