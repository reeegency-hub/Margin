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
import { MsSpotBubble, MsSpotRing } from "@/components/ui/MsSpotBubble";

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
 * Bulle collée à l’action du guide — même UI que l’intro Assistant.
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
      <div className="ms-spot ms-spot--layer" aria-live="polite">
        <MsSpotBubble
          panelRef={panelRef}
          className="ms-spot__bubble--searching"
          titleId={titleId}
          eyebrow="Guide"
          title={title}
          lead="Recherche de l’étape… faites défiler si besoin."
          style={{
            top: 88,
            left: 16,
            width: Math.min(
              300,
              typeof window !== "undefined" ? window.innerWidth - 32 : 300
            ),
          }}
        />
      </div>
    );
  }

  return (
    <div className="ms-spot ms-spot--layer" aria-live="polite">
      <MsSpotRing {...spot} pad={10} />
      <MsSpotBubble
        panelRef={panelRef}
        titleId={titleId}
        eyebrow="À faire ici"
        title={title}
        list={lines}
        hint={footer}
        style={{ top: bubble.top, left: bubble.left, width: Math.min(320, window.innerWidth - 24) }}
        actions={
          onDismiss ? (
            <button type="button" className="ms-spot__later" onClick={onDismiss}>
              Masquer l’aide
            </button>
          ) : null
        }
      />
    </div>
  );
}
