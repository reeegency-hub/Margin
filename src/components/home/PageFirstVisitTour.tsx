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
import { MsSpotBubble, MsSpotRing } from "@/components/ui/MsSpotBubble";

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
  const gap = 14;
  const pad = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = spot.top + spot.height + gap;
  let left = spot.left + spot.width / 2 - bubbleW / 2;
  let place = placement;

  if (placement === "top") {
    top = spot.top - bubbleH - gap;
  } else if (placement === "right") {
    top = spot.top;
    left = spot.left + spot.width + gap;
  } else if (placement === "left") {
    top = spot.top;
    left = spot.left - bubbleW - gap;
  }

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
 * Première visite : bulle collée à l’action (style ms-spot).
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
    panelRef.current
      ?.querySelector<HTMLElement>(".btn-lime, .ms-spot__later")
      ?.focus();
  }, [open, stepIndex]);

  function finish() {
    if (pageKey) markPageTourSeen(rid, pageKey);
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tour");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
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
  const isLast = stepIndex >= total - 1;
  const bubbleW = Math.min(
    320,
    typeof window !== "undefined" ? window.innerWidth - 24 : 320
  );

  return (
    <div className="ms-spot ms-spot--layer" aria-live="polite">
      {spot ? <MsSpotRing {...spot} /> : null}
      <MsSpotBubble
        panelRef={panelRef}
        titleId={titleId}
        eyebrow={`${tour.label} · ${stepIndex + 1}/${total}`}
        title={step.title}
        lead={step.body}
        style={
          bubble
            ? { top: bubble.top, left: bubble.left, width: bubbleW }
            : { top: 24, left: 24, width: bubbleW }
        }
        actions={
          <>
            <button type="button" className="btn-lime" onClick={next}>
              {isLast ? "C’est compris" : "Suivant"}
            </button>
            {!isLast ? (
              <button type="button" className="ms-spot__later" onClick={finish}>
                Passer
              </button>
            ) : null}
          </>
        }
        hint={!isLast ? `Étape ${stepIndex + 1} sur ${total}` : undefined}
      />
    </div>
  );
}
