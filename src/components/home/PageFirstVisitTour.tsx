"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  findPageTour,
  resolveAnchor,
  type PageTourStep,
} from "@/lib/page-tours";
import {
  clearPageTourSeen,
  hasSeenPageTour,
  markPageTourSeen,
} from "@/components/home/page-tour-storage";
import { readGuideFocus } from "@/components/home/guide-focus";

function guideFocusBlocksTour(pathname: string): boolean {
  const stored = readGuideFocus();
  if (!stored) return false;
  return (
    pathname === stored.path || pathname.startsWith(`${stored.path}/`)
  );
}

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
  placement: PageTourStep["placement"] = "bottom",
  bubbleW: number,
  bubbleH: number
): BubblePos {
  const gap = 12;
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
  } else {
    top = spot.top + spot.height + gap;
    left = spot.left;
  }

  // Garde dans le viewport
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
 * Première visite : bulle collée à l’action (sans flou).
 * Forcer : ?tour=1
 */
export function PageFirstVisitTour({
  restaurantId,
  disabled = false,
}: {
  restaurantId?: string;
  disabled?: boolean;
}) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const rid = restaurantId || "shop";
  const forceTour = searchParams.get("tour") === "1";

  const [ready, setReady] = useState(false);
  const [pageKey, setPageKey] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [bubble, setBubble] = useState<BubblePos | null>(null);

  const tour = findPageTour(pathname);
  const step = tour?.steps[stepIndex] ?? null;

  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setReady(true);
      return;
    }
    if (pathname.startsWith("/kiosks") || pathname.startsWith("/admin")) {
      setOpen(false);
      setReady(true);
      return;
    }

    const current = findPageTour(pathname);
    if (!current) {
      setOpen(false);
      setPageKey(null);
      setReady(true);
      return;
    }

    setPageKey(current.pageKey);
    setStepIndex(0);
    setReady(true);

    if (forceTour) {
      clearPageTourSeen(rid, current.pageKey);
    } else if (hasSeenPageTour(rid, current.pageKey)) {
      setOpen(false);
      return;
    }

    if (guideFocusBlocksTour(pathname)) {
      setOpen(false);
      const timer = window.setInterval(() => {
        if (guideFocusBlocksTour(pathname)) return;
        if (forceTour || !hasSeenPageTour(rid, current.pageKey)) {
          setStepIndex(0);
          setOpen(true);
        }
        window.clearInterval(timer);
      }, 500);
      return () => window.clearInterval(timer);
    }

    const t = window.setTimeout(() => setOpen(true), 320);
    return () => window.clearTimeout(t);
  }, [pathname, rid, disabled, forceTour]);

  useLayoutEffect(() => {
    if (!open || !step) {
      setSpot(null);
      setBubble(null);
      return;
    }

    function measure() {
      const el = resolveAnchor(step!.anchor);
      if (!el) {
        // Fallback coin bas-droit si ancre absente
        const fallback: Spot = {
          top: window.innerHeight - 120,
          left: Math.max(16, window.innerWidth - 360),
          width: 40,
          height: 40,
        };
        setSpot(fallback);
        const bw = panelRef.current?.offsetWidth || 320;
        const bh = panelRef.current?.offsetHeight || 180;
        setBubble(computeBubble(fallback, "top", bw, bh));
        return;
      }

      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      const r = el.getBoundingClientRect();
      const s: Spot = {
        top: r.top,
        left: r.left,
        width: Math.max(r.width, 40),
        height: Math.max(r.height, 40),
      };
      setSpot(s);

      // Mesure bulle après paint
      requestAnimationFrame(() => {
        const bw = panelRef.current?.offsetWidth || 320;
        const bh = panelRef.current?.offsetHeight || 180;
        setBubble(computeBubble(s, step!.placement || "bottom", bw, bh));
      });
    }

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step, stepIndex]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>(".page-tour__next")?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex]);

  function stripTourParam() {
    if (!forceTour) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tour");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  function finish() {
    if (pageKey) markPageTourSeen(rid, pageKey);
    setOpen(false);
    stripTourParam();
  }

  function next() {
    if (!tour) return;
    if (stepIndex >= tour.steps.length - 1) {
      finish();
      return;
    }
    setStepIndex((i) => i + 1);
  }

  if (!ready || !open || !tour || !step || disabled) return null;

  const total = tour.steps.length;
  const pct = Math.round(((stepIndex + 1) / total) * 100);
  const isLast = stepIndex >= total - 1;

  return (
    <div className="page-tour-layer" aria-live="polite">
      {spot ? (
        <div
          className="page-tour-spot"
          style={{
            top: spot.top - 6,
            left: spot.left - 6,
            width: spot.width + 12,
            height: spot.height + 12,
          }}
          aria-hidden
        />
      ) : null}

      <div
        ref={panelRef}
        className={`page-tour page-tour--anchor page-tour--${bubble?.placement || "bottom"}`}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        style={
          bubble
            ? { top: bubble.top, left: bubble.left }
            : { top: 24, left: 24 }
        }
      >
        <header className="page-tour__head">
          <div className="page-tour__kicker">
            <span className="page-tour__pill">{tour.label}</span>
          </div>
          <button
            type="button"
            className="page-tour__close"
            aria-label="Fermer"
            onClick={finish}
          >
            ×
          </button>
        </header>

        <div
          className="page-tour__progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Progression de la visite"
        >
          <i style={{ width: `${pct}%` }} />
        </div>

        <div className="page-tour__body">
          <h2 id={titleId} className="page-tour__title">
            {step.title}
          </h2>
          <p className="page-tour__text">{step.body}</p>
        </div>

        <footer className="page-tour__foot">
          {!isLast ? (
            <button
              type="button"
              className="page-tour__skip"
              onClick={finish}
            >
              Passer
            </button>
          ) : (
            <span className="page-tour__spacer" />
          )}
          <button type="button" className="page-tour__next" onClick={next}>
            {isLast ? "C’est compris" : "Suivant"}
            {!isLast ? <span aria-hidden> →</span> : null}
          </button>
        </footer>
      </div>
    </div>
  );
}
