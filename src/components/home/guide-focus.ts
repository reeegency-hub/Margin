"use client";

/**
 * Focus guide : après un CTA du guide, on pose une consigne sur la page cible.
 * sessionStorage — même pattern que le cookie banner / onboarding local.
 */

import { clearGuideHandoff } from "@/lib/guide-anchors";

export type GuideFocus = {
  id: string;
  label: string;
  hint?: string;
  cta: string;
  href: string;
  /** pathname sans query/hash pour matcher la page */
  path: string;
  sectionTitle?: string;
  incentives: string[];
  /** Pied de la bulle spotlight */
  footHint?: string;
};

const STORAGE_KEY = "margin:guide:focus";

export function pathFromHref(href: string): string {
  try {
    const u = new URL(href, "https://margin.local");
    return u.pathname || "/";
  } catch {
    return href.split("?")[0]?.split("#")[0] || "/";
  }
}

export function writeGuideFocus(focus: GuideFocus) {
  if (typeof window === "undefined") return;
  try {
    clearGuideHandoff();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(focus));
  } catch {
    /* private mode */
  }
}

export function readGuideFocus(): GuideFocus | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuideFocus;
    if (!parsed?.id || !parsed?.path) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearGuideFocus() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    clearGuideHandoff();
    window.dispatchEvent(new Event("margin:guide-focus-clear"));
  } catch {
    /* ignore */
  }
}

export function hrefWithGuide(href: string, taskId: string): string {
  try {
    const u = new URL(href, "https://margin.local");
    u.searchParams.set("guide", taskId);
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    const join = href.includes("?") ? "&" : "?";
    return `${href}${join}guide=${encodeURIComponent(taskId)}`;
  }
}
