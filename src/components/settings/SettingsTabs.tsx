"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui";
import { FeatureSection } from "@/components/ui/FeatureSection";
import { updateSettings, testWhatsApp } from "@/app/actions";
import { OpenAISettingsForm } from "@/components/settings/OpenAISettingsForm";
import {
  PlatformApiKeysForm,
  type PlatformConnectionRow,
} from "@/components/settings/PlatformApiKeysForm";
import { AffiliatePanel } from "@/components/settings/AffiliatePanel";
import { WaSendLabel } from "@/components/ui/WhatsAppIcon";

export function SettingsTabs({
  whatsappTo,
  webhookUrl,
  openai,
  platforms,
  affiliate,
}: {
  whatsappTo: string;
  webhookUrl: string;
  openai: {
    configured: boolean;
    source: "restaurant" | "env" | null;
    maskedKey: string;
    model: string;
  };
  platforms: PlatformConnectionRow[];
  affiliate: {
    referralCode: string;
    referralUrl: string;
    referralCount: number;
    creditMonths: number;
  };
}) {
  const [tab, setTab] = useState<
    "simple" | "affiliation" | "connexions" | "avance"
  >("simple");

  return (
    <div>
      <div className="segmented-tabs mb-5">
        <button
          type="button"
          className={`segmented-tab ${tab === "simple" ? "active" : ""}`}
          onClick={() => setTab("simple")}
        >
          Simple
        </button>
        <button
          type="button"
          className={`segmented-tab ${tab === "affiliation" ? "active" : ""}`}
          onClick={() => setTab("affiliation")}
        >
          Affiliation
        </button>
        <button
          type="button"
          className={`segmented-tab ${tab === "connexions" ? "active" : ""}`}
          onClick={() => setTab("connexions")}
        >
          Connexions
        </button>
        <button
          type="button"
          className={`segmented-tab ${tab === "avance" ? "active" : ""}`}
          onClick={() => setTab("avance")}
        >
          Avancé
        </button>
      </div>

      {tab === "simple" ? (
        <>
          <FeatureSection
            title="WhatsApp du magasin"
            subtitle="Alertes stock et listes de courses sur votre téléphone."
          />
          <p className="mb-3 text-[13px] text-[var(--text-secondary-dark)]">
            En enregistrant votre numéro, vous acceptez de recevoir des messages
            Margin liés au magasin (stock, courses, pointage). Voir la{" "}
            <a href="/legal/confidentialite" className="underline font-semibold">
              politique de confidentialité
            </a>
            .
          </p>
          <div className="dash-card dash-card--dark" id="guide-wa">
            <form
              action={updateSettings}
              className="space-y-4"
              data-guide-form="wa"
            >
              <Field label="Votre numéro (ex. +336…)">
                <input
                  id="settings-wa"
                  name="whatsappTo"
                  className={inputClass}
                  defaultValue={whatsappTo}
                  placeholder="+33612345678"
                  data-guide-action="wa-save"
                />
              </Field>
              <button
                type="submit"
                className="pill-btn pill-btn--primary"
                data-guide-action="wa-save"
              >
                Enregistrer
              </button>
            </form>
            <form action={testWhatsApp} className="mt-3">
              <button
                type="submit"
                className="pill-btn pill-btn--ghost wa-send-btn"
              >
                <WaSendLabel kind="test" />
              </button>
            </form>
          </div>

          <FeatureSection
            next
            title="À quoi ça sert"
            subtitle="Ce que WhatsApp déclenche dans Margin."
          />
          <div className="dash-card dash-card--light">
            <ul className="space-y-3 text-[16px]">
              <li>Stock bas → alerte / message</li>
              <li>Liste de courses → envoyée sur WhatsApp</li>
              <li>Pointage équipe → « Julie 18:05 »</li>
            </ul>
          </div>

          <nav className="settings-legal" aria-label="Informations légales">
            <a href="/legal/mentions">Mentions légales</a>
            <a href="/legal/confidentialite">Confidentialité</a>
            <a href="/legal/cgu">CGU</a>
            <a href="/legal/cgv">CGV</a>
            <a href="/legal/cookies">Cookies</a>
          </nav>
        </>
      ) : null}

      {tab === "affiliation" ? (
        <AffiliatePanel
          referralCode={affiliate.referralCode}
          referralUrl={affiliate.referralUrl}
          referralCount={affiliate.referralCount}
          creditMonths={affiliate.creditMonths}
        />
      ) : null}

      {tab === "connexions" ? (
        <>
          <FeatureSection
            title="Livraison · clés API"
            subtitle="Coffre-fort des clés — pas encore la sync live Uber/Deliveroo."
          />
          <PlatformApiKeysForm connections={platforms} />
        </>
      ) : null}

      {tab === "avance" ? (
        <>
          <FeatureSection
            next
            title="Analyse automatique du catalogue"
            subtitle="Clé OpenAI pour lire un catalogue et proposer les fiches produit."
          />
          <p className="mb-3 text-[14px] text-[var(--text-secondary-dark)]">
            Optionnel. Sert à lire une photo ou un PDF de catalogue et proposer
            les fiches produit.
          </p>
          <OpenAISettingsForm
            configured={openai.configured}
            source={openai.source}
            maskedKey={openai.maskedKey}
            model={openai.model}
          />

          <FeatureSection
            title="Technique WhatsApp"
            subtitle="Réglages avancés — réservé si vous branchez l’envoi technique."
          />
          <div className="dash-card dash-card--light">
            <p className="text-[13px] text-[var(--text-muted)]">
              Adresse technique (si votre prestataire en a besoin)
            </p>
            <p className="mt-2 break-all rounded-[16px] bg-white p-3 font-mono text-[11px]">
              {webhookUrl}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
