"use client";

import { AssistantActionCard } from "@/components/assistant/AssistantActionCard";
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
 * Carte wizard POS — hors chat.
 * Les secrets / OAuth ne transitent jamais par le LLM.
 */
export function PosWizardSkeleton({
  provider = "other",
}: {
  provider?: string;
  onClose?: () => void;
}) {
  const known = PROVIDERS.includes(provider as PosVendor)
    ? (provider as PosVendor)
    : null;
  const label = known
    ? POS_VENDOR_LABELS[known] || known
    : "votre caisse";
  const href = known ? `/kiosks?pos=${known}` : "/kiosks";

  return (
    <AssistantActionCard
      badge="Hors chat"
      title={`Brancher ${label}`}
      lead="Clés API et secrets : uniquement dans le wizard caisse — jamais ici."
      steps={[
        "Ouvrir la page Caisse",
        `Choisir ${label}`,
        "Créer le lien webhook",
        "Coller l’URL · tester une vente",
      ]}
      cta={{ label: "Ouvrir le wizard caisse", href }}
    />
  );
}
