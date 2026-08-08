"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { MarginLogo } from "@/components/brand/MarginLogo";

const LINKS = [
  { href: "#offre", label: "Offre" },
  { href: "#tarifs", label: "Tarifs" },
  { href: "#preuve", label: "WhatsApp" },
  { href: "#equipe", label: "Équipe" },
] as const;

/** Barre top — logo centré + menu. */
export function MobileLandingNav() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function go() {
    setOpen(false);
  }

  return (
    <div className={`mland-hero__top${open ? " is-open" : ""}`}>
      <Link href="/login" className="mland-nav__login">
        Connexion
      </Link>

      <div className="mland-hero__logo">
        <MarginLogo tone="light" href="/welcome" />
      </div>

      <button
        type="button"
        className={`mland-nav__toggle${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        onClick={() => setOpen((v) => !v)}
      >
        <span />
        <span />
        <span />
      </button>

      {open ? (
        <button
          type="button"
          className="mland-nav__backdrop"
          aria-label="Fermer le menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <nav
        id={panelId}
        className={`mland-nav__panel${open ? " is-open" : ""}`}
        aria-label="Navigation"
        aria-hidden={!open}
      >
        <p className="mland-nav__eyebrow">Menu</p>
        <ul className="mland-nav__list">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={go}>
                {l.label}
                <span aria-hidden>→</span>
              </a>
            </li>
          ))}
        </ul>
        <Link
          href="/signup"
          className="mland-btn mland-btn--primary mland-nav__cta"
          onClick={go}
        >
          Profiter de l&apos;offre
        </Link>
      </nav>
    </div>
  );
}
