"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { ManageBillingButton } from "@/components/settings/ManageBillingButton";
import "@/components/mobile/app/mobile-app.css";

export function SettingsScreen({
  userName,
  userEmail,
  restaurantName,
  planLabel,
  whatsappTo,
  showBilling,
}: {
  userName: string;
  userEmail: string;
  restaurantName: string;
  planLabel: string;
  whatsappTo: string | null;
  showBilling: boolean;
}) {
  return (
    <div className="mapp mapp-settings">
      <h1 className="mapp-settings__title">Réglages</h1>
      <p className="mapp-settings__lead">
        Compte et préférences essentielles. Le reste passe par le copilote.
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
      </div>

      <div className="mapp-settings__actions">
        <Link
          href="/settings?tab=simple&full=1"
          className="mapp-settings__btn mapp-settings__btn--primary"
        >
          Modifier WhatsApp / facturation
        </Link>
        {showBilling ? (
          <ManageBillingButton
            label="Gérer l’abonnement"
            className="mapp-settings__btn mapp-settings__btn--ghost"
          />
        ) : null}
        <Link
          href="/assistant"
          className="mapp-settings__btn mapp-settings__btn--ghost"
        >
          Demander au copilote
        </Link>
        <button
          type="button"
          className="mapp-settings__btn mapp-settings__btn--danger"
          onClick={() => void signOut({ callbackUrl: "/welcome" })}
        >
          Déconnexion
        </button>
      </div>

      <p className="mapp-settings__hint">
        Caisse, catalogue, équipe, connexions delivery : passez par l’onglet
        Copilote.
      </p>
    </div>
  );
}
