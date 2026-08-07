"use client";

import Link from "next/link";
import { POS_VENDOR_LABELS, type PosVendor } from "@/lib/pos/types";

const PROVIDERS: PosVendor[] = [
  "zelty",
  "cashpad",
  "square",
  "tiller",
  "lightspeed",
  "laddition",
  "custom",
];

/**
 * Squelette wizard POS — hors chat.
 * Les secrets / OAuth ne transitent jamais par le LLM.
 */
export function PosWizardSkeleton({
  provider = "other",
  onClose,
}: {
  provider?: string;
  onClose?: () => void;
}) {
  const known = PROVIDERS.includes(provider as PosVendor)
    ? (provider as PosVendor)
    : null;
  const label = known
    ? POS_VENDOR_LABELS[known] || known
    : "Votre caisse";

  return (
    <div className="pos-wizard-skel">
      <p className="pos-wizard-skel__eyebrow">Caisse — hors chat</p>
      <h3 className="pos-wizard-skel__title">Brancher {label}</h3>
      <p className="pos-wizard-skel__lead">
        Les clés API et secrets se saisissent uniquement ici (ou sur la page
        Caisse). Ne les collez jamais dans l’assistant.
      </p>
      <ol className="pos-wizard-skel__steps">
        <li>Ouvrez la page Caisse</li>
        <li>Choisissez {label}</li>
        <li>Créez le lien webhook (secret généré côté Margin)</li>
        <li>Collez l’URL dans votre logiciel · testez une vente</li>
      </ol>
      <div className="pos-wizard-skel__actions">
        <Link
          href={known ? `/kiosks?pos=${known}` : "/kiosks"}
          className="btn-lime"
          onClick={onClose}
        >
          Ouvrir le wizard caisse
        </Link>
        {onClose ? (
          <button type="button" className="btn-ghost" onClick={onClose}>
            Fermer
          </button>
        ) : null}
      </div>
    </div>
  );
}
