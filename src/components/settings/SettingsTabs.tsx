"use client";

import { useCallback, useState } from "react";
import { Field, inputClass } from "@/components/ui";
import { FeatureSection } from "@/components/ui/FeatureSection";
import { updateSettings, testWhatsApp } from "@/app/actions";
import { OpenAISettingsForm } from "@/components/settings/OpenAISettingsForm";
import { LlmByokForm } from "@/components/settings/LlmByokForm";
import {
  PlatformApiKeysForm,
  type PlatformConnectionRow,
} from "@/components/settings/PlatformApiKeysForm";
import { AffiliatePanel } from "@/components/settings/AffiliatePanel";
import { ManageBillingButton } from "@/components/settings/ManageBillingButton";
import { WaSendLabel } from "@/components/ui/WhatsAppIcon";
import {
  SettingsTabGuide,
  settingsGuideCopy,
  type SettingsTabId,
} from "@/components/settings/SettingsTabGuide";

const TABS: { id: SettingsTabId; label: string }[] = [
  { id: "simple", label: "Simple" },
  { id: "affiliation", label: "Affiliation" },
  { id: "connexions", label: "Connexions" },
  { id: "avance", label: "Avancé" },
];

export function SettingsTabs({
  whatsappTo,
  webhookUrl,
  openai,
  llm,
  platforms,
  affiliate,
  showBilling = false,
  initialTab,
  restaurantId,
}: {
  whatsappTo: string;
  webhookUrl: string;
  openai: {
    configured: boolean;
    source: "restaurant" | "env" | null;
    maskedKey: string;
    model: string;
  };
  llm: {
    configured: boolean;
    provider: "anthropic" | "openai" | "platform" | null;
    status: "untested" | "valid" | "invalid" | "revoked" | "none" | "legacy";
    fingerprintDisplay: string | null;
    source: "byok" | "legacy" | "platform" | null;
  };
  platforms: PlatformConnectionRow[];
  affiliate: {
    referralCode: string;
    referralUrl: string;
    referralCount: number;
    creditMonths: number;
  };
  showBilling?: boolean;
  initialTab?: SettingsTabId;
  restaurantId?: string;
}) {
  const [tab, setTab] = useState<SettingsTabId>(initialTab || "simple");
  const [forceGuide, setForceGuide] = useState(false);
  const guide = settingsGuideCopy(tab);

  const clearForce = useCallback(() => setForceGuide(false), []);

  function openHelp() {
    setForceGuide(true);
  }

  return (
    <div className="settings-guided">
      <SettingsTabGuide
        tab={tab}
        restaurantId={restaurantId}
        forceOpen={forceGuide}
        onConsumedForce={clearForce}
      />

      <div className="segmented-tabs mb-4" data-tour="settings-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            data-settings-tab={t.id}
            className={`segmented-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="settings-guided__bar">
        <p className="settings-guided__summary">{guide.lead}</p>
        <button
          type="button"
          className="settings-guided__help"
          onClick={openHelp}
        >
          Comprendre cet onglet
        </button>
      </div>

      {tab === "simple" ? (
        <div className="settings-guided__panel">
          <div className="ms-spot__card settings-guided__card">
            <p className="ms-spot__eyebrow">Essentiel</p>
            <h3 className="ms-spot__title">WhatsApp du commerce</h3>
            <p className="ms-spot__lead">
              Alertes stock, listes de courses et pointage arrivent sur ce
              numéro. Format international : +336…
            </p>
            <div className="dash-card dash-card--dark mt-3" id="guide-wa">
              <form
                action={updateSettings}
                className="space-y-4"
                data-guide-form="wa"
              >
                <Field label="Votre numéro">
                  <input
                    id="settings-wa"
                    name="whatsappTo"
                    className={inputClass}
                    defaultValue={whatsappTo}
                    placeholder="+33612345678"
                    data-guide-action="wa-save"
                    data-tour="settings-wa-input"
                  />
                </Field>
                <div className="ms-spot__actions">
                  <button
                    type="submit"
                    className="btn-lime"
                    data-guide-action="wa-save"
                    data-tour="settings-wa-save"
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
              <form action={testWhatsApp} className="mt-3">
                <button
                  type="submit"
                  className="ms-spot__later wa-send-btn"
                >
                  <WaSendLabel kind="test" />
                </button>
              </form>
            </div>
            <p className="ms-spot__hint">
              En enregistrant, vous acceptez de recevoir des messages Margin
              liés au commerce.{" "}
              <a href="/legal/confidentialite">Confidentialité</a>
            </p>
          </div>

          <div className="ms-spot__card settings-guided__card">
            <p className="ms-spot__eyebrow">À quoi ça sert</p>
            <h3 className="ms-spot__title">Ce que WhatsApp déclenche</h3>
            <ul className="ms-spot__list">
              <li>Stock bas → alerte / message</li>
              <li>Liste de courses → envoyée sur WhatsApp</li>
              <li>Pointage équipe → « Julie 18:05 »</li>
            </ul>
          </div>

          {showBilling ? (
            <div className="ms-spot__card settings-guided__card">
              <p className="ms-spot__eyebrow">Abonnement</p>
              <h3 className="ms-spot__title">Facturation</h3>
              <p className="ms-spot__lead">
                Factures, carte bancaire, résiliation — portail Stripe sécurisé.
              </p>
              <div className="ms-spot__actions">
                <ManageBillingButton />
              </div>
            </div>
          ) : null}

          <nav className="settings-legal" aria-label="Informations légales">
            <a href="/legal/mentions">Mentions légales</a>
            <a href="/legal/confidentialite">Confidentialité</a>
            <a href="/legal/cgu">CGU</a>
            <a href="/legal/cgv">CGV</a>
            <a href="/legal/cookies">Cookies</a>
          </nav>
        </div>
      ) : null}

      {tab === "affiliation" ? (
        <div className="settings-guided__panel">
          <div className="ms-spot__card settings-guided__card">
            <p className="ms-spot__eyebrow">Parrainage</p>
            <h3 className="ms-spot__title">Comment ça marche</h3>
            <ul className="ms-spot__list">
              <li>Vous partagez votre lien unique</li>
              <li>Le filleul démarre avec une remise</li>
              <li>Vous gagnez des mois de crédit</li>
            </ul>
            <button
              type="button"
              className="settings-guided__help mt-3"
              onClick={openHelp}
            >
              Voir le guide popup
            </button>
          </div>
          <AffiliatePanel
            referralCode={affiliate.referralCode}
            referralUrl={affiliate.referralUrl}
            referralCount={affiliate.referralCount}
            creditMonths={affiliate.creditMonths}
          />
        </div>
      ) : null}

      {tab === "connexions" ? (
        <div className="settings-guided__panel">
          <div className="ms-spot__card settings-guided__card">
            <p className="ms-spot__eyebrow">Livraison</p>
            <h3 className="ms-spot__title">Clés API Uber / Deliveroo</h3>
            <p className="ms-spot__lead">
              Coffre-fort chiffré. La sync live des commandes n’est pas encore
              active — vous préparez déjà les accès.
            </p>
            <ul className="ms-spot__list">
              <li>Ne collez jamais ces clés dans le Copilote</li>
              <li>Pour Zelty / Cashpad / Square → page Caisse</li>
            </ul>
          </div>
          <FeatureSection
            title="Plateformes"
            subtitle="Enregistrez ou mettez à jour une clé par plateforme."
          />
          <PlatformApiKeysForm connections={platforms} />
        </div>
      ) : null}

      {tab === "avance" ? (
        <div className="settings-guided__panel">
          <div className="ms-spot__card settings-guided__card">
            <p className="ms-spot__eyebrow">Copilote</p>
            <h3 className="ms-spot__title">Bring Your Own Key</h3>
            <p className="ms-spot__lead">
              Votre clé Anthropic ou OpenAI alimente le Copilote (imports
              intelligents, chat). Facturée chez le provider — pas chez Margin.
            </p>
            <ul className="ms-spot__list">
              <li>Validation format à la saisie (zéro coût)</li>
              <li>Chiffrée au repos · révocable en un clic</li>
              <li>Statut : non testée → valide au 1er appel OK</li>
            </ul>
          </div>

          <FeatureSection
            title="Connecter mon IA"
            subtitle="Anthropic ou OpenAI — usage sur votre compte provider."
          />
          <LlmByokForm initial={llm} />

          <FeatureSection
            title="Modèle OpenAI (optionnel)"
            subtitle="Si vous utilisez OpenAI pour catalogues / menus."
          />
          <OpenAISettingsForm
            configured={openai.configured}
            source={openai.source}
            maskedKey={openai.maskedKey}
            model={openai.model}
          />

          <div className="ms-spot__card settings-guided__card">
            <p className="ms-spot__eyebrow">Technique</p>
            <h3 className="ms-spot__title">Webhook WhatsApp</h3>
            <p className="ms-spot__lead">
              Adresse réservée si votre prestataire d’envoi en a besoin. Laisser
              tel quel dans 95 % des cas.
            </p>
            <p className="mt-2 break-all rounded-[12px] bg-[rgba(10,10,10,0.04)] p-3 font-mono text-[11px]">
              {webhookUrl}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
