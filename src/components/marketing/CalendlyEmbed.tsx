"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { calendlyEmbedUrl } from "@/lib/calendly";

declare global {
  interface Window {
    Calendly?: {
      initInlineWidget: (opts: {
        url: string;
        parentElement: HTMLElement;
      }) => void;
    };
  }
}

const SCRIPT_SRC = "https://assets.calendly.com/assets/external/widget.js";

function loadCalendlyScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`
    );
    if (existing) {
      if (window.Calendly) resolve();
      else existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Calendly script failed"));
    document.body.appendChild(s);
  });
}

export function CalendlyEmbed({
  url,
  title = "Réserver un créneau",
}: {
  url: string;
  title?: string;
}) {
  const reactId = useId();
  const domId = `calendly-${reactId.replace(/:/g, "")}`;
  const shellRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldLoad(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px 0px", threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    const parent = document.getElementById(domId);
    if (!parent) return;

    parent.innerHTML = "";
    void loadCalendlyScript()
      .then(() => {
        if (cancelled || !window.Calendly) return;
        window.Calendly.initInlineWidget({
          url: calendlyEmbedUrl(url),
          parentElement: parent,
        });
      })
      .catch(() => {
        if (cancelled) return;
        parent.innerHTML = `<p style="padding:24px;text-align:center"><a href="${url}" target="_blank" rel="noreferrer">Ouvrir Calendly</a></p>`;
      });

    return () => {
      cancelled = true;
    };
  }, [url, domId, shouldLoad]);

  return (
    <div ref={shellRef} className="land-calendly__shell">
      {shouldLoad ? (
        <div
          id={domId}
          className="calendly-inline-widget land-calendly__frame"
          data-url={calendlyEmbedUrl(url)}
          title={title}
          style={{ minWidth: 320, height: 700 }}
        />
      ) : (
        <div className="land-calendly__placeholder" aria-hidden>
          <p>Chargement du calendrier…</p>
        </div>
      )}
    </div>
  );
}

export function CalendlyCtaLink({
  url,
  className,
  children,
}: {
  url: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={url}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}
