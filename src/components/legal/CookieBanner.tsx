"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
    <div className="cookie-banner" role="dialog" aria-label="Cookies">
      <p>
        Margin utilise des cookies essentiels (connexion, sécurité). Aucun
        cookie marketing sans votre accord.{" "}
        <Link href="/legal/cookies">En savoir plus</Link>
      </p>
      <div className="cookie-banner__actions">
        <button
          type="button"
          className="cookie-banner__btn cookie-banner__btn--ghost"
          onClick={() => save("essential")}
        >
          Essentiels seulement
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
