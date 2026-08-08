"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MarginLogoMark } from "@/components/brand/MarginLogo";
import { MarginAssistant } from "@/components/assistant/MarginAssistant";
import "@/components/mobile/app/mobile-app.css";

function greetingLabel(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

/**
 * Accueil mobile = copilote Margin (identité lime / encre).
 * Pas de dashboard KPI.
 */
export function HomeScreen({
  userName,
  restaurantName,
}: {
  userName: string;
  restaurantName: string;
}) {
  const displayName = (userName.trim() || restaurantName).split(" ")[0];
  const hello = useMemo(() => greetingLabel(), []);

  return (
    <div className="mapp mapp-home">
      <div className="mapp-home__glow" aria-hidden />
      <header className="mapp-home__header">
        <div className="mapp-home__brand">
          <MarginLogoMark className="mapp-home__mark" title="Margin" />
          <div>
            <p className="mapp-home__hello">
              {hello}
              {displayName ? `, ${displayName}` : ""}
            </p>
            <h1 className="mapp-home__title">Comment je peux aider ?</h1>
          </div>
        </div>
        <Link
          href="/settings"
          className="mapp-home__account"
          aria-label="Réglages"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden
          >
            <circle cx="12" cy="9" r="3.2" />
            <path d="M5 19c1.6-3.2 4-4.8 7-4.8s5.4 1.6 7 4.8" />
          </svg>
        </Link>
      </header>

      <p className="mapp-home__lead">
        Stock, courses, WhatsApp, caisse — demandez simplement.
      </p>

      <div className="mapp-home__chat">
        <MarginAssistant
          expanded
          onExpandedChange={() => {}}
          layout="page"
        />
      </div>
    </div>
  );
}
