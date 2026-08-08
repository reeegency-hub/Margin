"use client";

import { Field, inputClass } from "@/components/ui";
import {
  saveDeliveryCredentialsAction,
  testDeliveryConnectionAction,
} from "@/app/actions";

export type PlatformConnectionRow = {
  platform: string;
  label: string;
  status: string;
  storeId: string | null;
  hasKey: boolean;
  webhookSecret: string | null;
  webhookUrl: string;
};

function statusLabel(status: string) {
  if (status === "WEBHOOK_LIVE" || status === "CONNECTED") {
    return "En réception (webhook)";
  }
  if (status === "KEY_STORED") return "Clé enregistrée (pas de sync live)";
  if (status === "PENDING") return "Sélectionné — clé manquante";
  return "Non connecté";
}

export function PlatformApiKeysForm({
  connections,
}: {
  connections: PlatformConnectionRow[];
}) {
  return (
    <div className="space-y-4">
      <p className="text-[14px] text-[var(--text-secondary-dark)]">
        Coffre-fort de clés + webhook générique pour le pilote. La synchro
        officielle Uber/Deliveroo (OAuth partenaire) n’est pas encore branchée —
        soyez honnête avec le client.
      </p>
      {connections.map((c) => (
        <div key={c.platform} className="dash-card dash-card--dark space-y-3">
          <div className="flex justify-between items-center gap-2">
            <p className="font-semibold">{c.label}</p>
            <span className="text-[12px] font-semibold text-[var(--text-muted)]">
              {statusLabel(c.status)}
            </span>
          </div>
          <form action={saveDeliveryCredentialsAction} className="space-y-3" data-guide-form="delivery">
            <input type="hidden" name="platform" value={c.platform} />
            <input type="hidden" name="returnTo" value="/settings" />
            <Field label="Clé API (coffre-fort — optionnel pour le pilote)">
              <input
                name="apiKey"
                className={inputClass}
                type="password"
                autoComplete="off"
                data-guide-action="delivery"
                placeholder={
                  c.hasKey
                    ? "•••••••• (laisser vide pour garder)"
                    : "Coller la clé si disponible"
                }
              />
            </Field>
            <Field label="Store ID / ID commerce">
              <input
                name="storeId"
                className={inputClass}
                defaultValue={c.storeId ?? ""}
                placeholder="ID sur la plateforme"
              />
            </Field>
            <button type="submit" className="pill-btn pill-btn--primary">
              Enregistrer
            </button>
          </form>
          {c.webhookSecret ? (
            <div className="rounded-[12px] bg-[var(--bg-app)] p-3 text-[12px]">
              <p className="font-medium">Webhook pilote (Zapier / curl)</p>
              <p className="mt-1 break-all font-mono text-[11px]">
                POST {c.webhookUrl}
              </p>
              <p className="mt-1 break-all font-mono text-[11px]">
                x-webhook-secret: {c.webhookSecret}
              </p>
            </div>
          ) : (
            <p className="text-[12px] text-[var(--text-muted)]">
              Enregistrez une fois pour générer le secret webhook.
            </p>
          )}
          <form action={testDeliveryConnectionAction}>
            <input type="hidden" name="platform" value={c.platform} />
            <input type="hidden" name="returnTo" value="/settings" />
            <button type="submit" className="pill-btn pill-btn--ghost">
              Vérifier la clé (pas un appel Uber/Deliveroo)
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}
