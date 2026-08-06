"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type PageTitleCtx = {
  title: string | null;
  guide: string | null;
  setTitle: (title: string | null) => void;
  setGuide: (guide: string | null) => void;
};

const PageTitleContext = createContext<PageTitleCtx | null>(null);

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const [guide, setGuide] = useState<string | null>(null);
  const value = useMemo(
    () => ({ title, guide, setTitle, setGuide }),
    [title, guide]
  );
  return (
    <PageTitleContext.Provider value={value}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitleValue() {
  return useContext(PageTitleContext)?.title ?? null;
}

export function usePageGuideValue() {
  return useContext(PageTitleContext)?.guide ?? null;
}

/** Syncs title + guide into the desktop topbar (except Accueil). */
export function PageTitleSync({
  title,
  guide,
}: {
  title?: string | null;
  guide?: string | null;
}) {
  const ctx = useContext(PageTitleContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setTitle(title?.trim() || null);
    ctx.setGuide(guide?.trim() || null);
    return () => {
      ctx.setTitle(null);
      ctx.setGuide(null);
    };
  }, [ctx, title, guide]);
  return null;
}
