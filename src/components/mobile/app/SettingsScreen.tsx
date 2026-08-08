"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { ManageBillingButton } from "@/components/settings/ManageBillingButton";
import { LlmByokForm } from "@/components/settings/LlmByokForm";
import "@/components/mobile/app/mobile-app.css";

type LlmStatus = {
  configured: boolean;
  provider: "openai" | "anthropic" | "platform" | null;
  status: "untested" | "valid" | "invalid" | "revoked" | "none" | "legacy";
  fingerprintDisplay: string | null;
  source: "byok" | "legacy" | "platform" | null;
};

export function SettingsScreen({
  userName,
  userEmail,
  restaurantName,
  planLabel,
  whatsappTo,
  showBilling,
  llm,
}: {
  userName: string;
  userEmail: string;
  restaurantName: string;
  planLabel: string;
  whatsappTo: string | null;
  showBilling: boolean;
  llm: LlmStatus;
}) {
  return (
    <div className="mapp mapp-settings">
      <h1 className="mapp-settings__title">Réglages</h1>
      <p className="mapp-settings__lead">
        Compte, IA et préférences. Le reste se demande à l’accueil.
      </p>

      <div className="mapp-settings__card">
        <div className="mapp-settings__row">
          <span className="mapp-settings__label">Compte</span>
          <span className="mapp-settings__value">
            {userName || restaurantName}
          </span>
          <span className="mapp-settings__hint">{userEmail}</span>
        </div>
        <div className="mapp-settings__row">
          <span className="mapp-settings__label">Commerce</span>
          <span className="mapp-settings__value">{restaurantName}</span>
          <span className="mapp-settings__hint">{planLabel}</span>
        </div>
        <div className="mapp-settings__row">
          <span className="mapp-settings__label">WhatsApp</span>
          <span className="mapp-settings__value">
            {whatsappTo || "Non renseigné"}
          </span>
        </div>
        <div className="mapp-settings__row">
          <span className="mapp-settings__label">IA Copilote</span>
          <span className="mapp-settings__value">
            {llm.configured
              ? llm.fingerprintDisplay || "Connectée"
              : "Non connectée"}
          </span>
          <span className="mapp-settings__hint">
            {llm.configured
              ? "Clé chiffrée · usage sur votre compte provider"
              : "Requis pour discuter librement avec le Copilote"}
          </span>
        </div>
      </div>

      <div className="mapp-settings__card mapp-settings__card--llm">
        <h2 className="mapp-settings__section-title">Connecter mon IA</h2>
        <p className="mapp-settings__hint">
          Anthropic ou OpenAI — facturée chez le provider, pas chez Margin.
        </p>
        <LlmByokForm initial={llm} />
      </div>

      <div className="mapp-settings__actions">
        <Link
          href="/settings?tab=simple&full=1"
          className="mapp-settings__btn mapp-settings__btn--ghost"
        >
          WhatsApp / facturation (complet)
        </Link>
        <Link
          href="/settings?tab=avance&full=1"
          className="mapp-settings__btn mapp-settings__btn--ghost"
        >
          Réglages avancés
        </Link>
        {showBilling ? (
          <ManageBillingButton
            label="Gérer l’abonnement"
            className="mapp-settings__btn mapp-settings__btn--ghost"
          />
        ) : null}
        <Link href="/" className="mapp-settings__btn mapp-settings__btn--primary">
          Retour au Copilote
        </Link>
        <button
          type="button"
          className="mapp-settings__btn mapp-settings__btn--danger"
          onClick={() => void signOut({ callbackUrl: "/welcome" })}
        >
          Déconnexion
        </button>
      </div>
    </div>
  );
}
