"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./cookie-banner.css";

const COOKIE_KEY = "margin_cookie_consent";

type Consent = "accepted" | "essential";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOKIE_KEY);
      if (!stored) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function save(value: Consent) {
    try {
      localStorage.setItem(COOKIE_KEY, value);
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="cookie-banner"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-desc"
    >
      <div className="cookie-banner__copy">
        <p id="cookie-banner-title" className="cookie-banner__title">
          Cookies
        </p>
        <p id="cookie-banner-desc">
          Cookies essentiels pour la connexion et la sécurité. Les cookies
          optionnels (mesure d’audience) uniquement si vous acceptez.{" "}
          <Link href="/legal/cookies">En savoir plus</Link>
        </p>
      </div>
      <div className="cookie-banner__actions">
        <button
          type="button"
          className="cookie-banner__btn cookie-banner__btn--ghost"
          onClick={() => save("essential")}
        >
          Refuser
        </button>
        <button
          type="button"
          className="cookie-banner__btn cookie-banner__btn--solid"
          onClick={() => save("accepted")}
        >
          Accepter
        </button>
      </div>
    </div>
  );
}
