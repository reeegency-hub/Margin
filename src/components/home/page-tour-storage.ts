"use client";

const STORAGE_PREFIX = "margin:page-tour:seen";

function storageKey(restaurantId: string) {
  return `${STORAGE_PREFIX}:${restaurantId || "shop"}`;
}

function readMap(restaurantId: string): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(restaurantId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(restaurantId: string, map: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(restaurantId), JSON.stringify(map));
  } catch {
    /* private mode */
  }
}

export function hasSeenPageTour(
  restaurantId: string,
  pageKey: string
): boolean {
  return Boolean(readMap(restaurantId)[pageKey]);
}

export function markPageTourSeen(restaurantId: string, pageKey: string) {
  const map = readMap(restaurantId);
  map[pageKey] = true;
  writeMap(restaurantId, map);
}

export function clearPageTourSeen(restaurantId: string, pageKey: string) {
  const map = readMap(restaurantId);
  delete map[pageKey];
  writeMap(restaurantId, map);
}

export function clearAllPageTours(restaurantId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(restaurantId));
  } catch {
    /* ignore */
  }
}
