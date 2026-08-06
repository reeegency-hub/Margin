"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  OnboardingItemStatus,
  OnboardingPersistState,
  OnboardingSectionConfig,
  OnboardingSectionView,
  OnboardingTaskView,
} from "./types";

function readStorage(key: string): OnboardingPersistState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingPersistState;
    if (!Array.isArray(parsed.completedIds)) return null;
    return {
      completedIds: parsed.completedIds.map(String),
      collapsed: Boolean(parsed.collapsed),
      dismissed: Boolean(parsed.dismissed),
    };
  } catch {
    return null;
  }
}

function writeStorage(key: string, state: OnboardingPersistState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

function resolveStatuses(
  sections: OnboardingSectionConfig[],
  completed: Set<string>,
  lockMode: "none" | "section" = "section"
): OnboardingSectionView[] {
  return sections.map((section) => {
    const tasks: OnboardingTaskView[] = section.tasks.map((t, index) => {
      if (completed.has(t.id)) {
        return { ...t, status: "done" as const };
      }
      if (lockMode === "none") {
        return { ...t, status: "todo" as const };
      }
      if (index === 0) {
        return { ...t, status: "todo" as const };
      }
      const prev = section.tasks[index - 1]!;
      return {
        ...t,
        status: (completed.has(prev.id) ? "todo" : "locked") as OnboardingItemStatus,
      };
    });
    const doneCount = tasks.filter((t) => t.status === "done").length;
    const totalCount = tasks.length;
    return {
      id: section.id,
      title: section.title,
      tasks,
      doneCount,
      totalCount,
      progress: totalCount === 0 ? 1 : doneCount / totalCount,
    };
  });
}

export type UseOnboardingOptions = {
  /** Clé localStorage (ex. margin:onboarding:{restaurantId}) */
  storageKey: string;
  sections: OnboardingSectionConfig[];
  /** IDs déjà faits côté serveur (fusionnés avec le local) */
  initialCompletedIds?: string[];
  /** Démarre replié */
  defaultCollapsed?: boolean;
  /** none = toutes les étapes ouvertes (meilleure conversion guide) */
  lockMode?: "none" | "section";
};

export type UseOnboardingResult = {
  sections: OnboardingSectionView[];
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  toggleCollapsed: () => void;
  dismissed: boolean;
  dismiss: () => void;
  restore: () => void;
  activeTaskId: string | null;
  activeTask: OnboardingTaskView | null;
  openTask: (id: string) => void;
  closeTask: () => void;
  markDone: (id: string) => void;
  markTodo: (id: string) => void;
  nextTask: OnboardingTaskView | null;
  totalDone: number;
  totalTasks: number;
  allDone: boolean;
};

/**
 * État du guide de démarrage — config en props, progression en localStorage
 * (même pattern que CookieBanner). Fusionne optional initialCompletedIds serveur.
 */
export function useOnboarding({
  storageKey,
  sections,
  initialCompletedIds = [],
  defaultCollapsed = true,
  lockMode = "section",
}: UseOnboardingOptions): UseOnboardingResult {
  const [hydrated, setHydrated] = useState(false);
  const [completedIds, setCompletedIds] = useState<string[]>(() => [
    ...new Set(initialCompletedIds),
  ]);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [dismissed, setDismissed] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStorage(storageKey);
    const merged = new Set(initialCompletedIds);
    if (stored) {
      stored.completedIds.forEach((id) => merged.add(id));
      setCollapsed(stored.collapsed);
      setDismissed(Boolean(stored.dismissed));
    }
    setCompletedIds([...merged]);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per key
  }, [storageKey]);

  const serverDoneKey = initialCompletedIds.slice().sort().join(",");

  // Fusionne les étapes déjà faites côté serveur (sans écraser le local).
  useEffect(() => {
    if (!hydrated || !serverDoneKey) return;
    const ids = serverDoneKey.split(",").filter(Boolean);
    setCompletedIds((prev) => {
      const merged = new Set(prev);
      let changed = false;
      for (const id of ids) {
        if (!merged.has(id)) {
          merged.add(id);
          changed = true;
        }
      }
      return changed ? [...merged] : prev;
    });
  }, [hydrated, serverDoneKey]);

  useEffect(() => {
    if (!hydrated) return;
    writeStorage(storageKey, {
      completedIds,
      collapsed,
      dismissed,
    });
  }, [storageKey, completedIds, collapsed, dismissed, hydrated]);

  const completedSet = useMemo(() => new Set(completedIds), [completedIds]);

  const sectionViews = useMemo(
    () => resolveStatuses(sections, completedSet, lockMode),
    [sections, completedSet, lockMode]
  );

  const allTasks = useMemo(
    () => sectionViews.flatMap((s) => s.tasks),
    [sectionViews]
  );

  const nextTask = useMemo(
    () => allTasks.find((t) => t.status === "todo") ?? null,
    [allTasks]
  );

  const activeTask = useMemo(
    () => allTasks.find((t) => t.id === activeTaskId) ?? null,
    [allTasks, activeTaskId]
  );

  const totalDone = allTasks.filter((t) => t.status === "done").length;
  const totalTasks = allTasks.length;

  const markDone = useCallback((id: string) => {
    setCompletedIds((prev) =>
      prev.includes(id) ? prev : [...prev, id]
    );
  }, []);

  const markTodo = useCallback((id: string) => {
    setCompletedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const openTask = useCallback(
    (id: string) => {
      const task = allTasks.find((t) => t.id === id);
      if (!task || task.status === "locked") return;
      setActiveTaskId(id);
      setCollapsed(false);
    },
    [allTasks]
  );

  const closeTask = useCallback(() => setActiveTaskId(null), []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => !c);
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    setActiveTaskId(null);
  }, []);

  const restore = useCallback(() => {
    setDismissed(false);
  }, []);

  return {
    sections: sectionViews,
    collapsed,
    setCollapsed,
    toggleCollapsed,
    dismissed,
    dismiss,
    restore,
    activeTaskId,
    activeTask,
    openTask,
    closeTask,
    markDone,
    markTodo,
    nextTask,
    totalDone,
    totalTasks,
    allDone: totalTasks > 0 && totalDone === totalTasks,
  };
}
