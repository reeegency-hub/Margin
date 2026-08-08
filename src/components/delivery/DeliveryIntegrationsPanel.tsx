"use client";

import { Field, inputClass } from "@/components/ui";
import {
  saveDeliveryCredentialsAction,
  testDeliveryConnectionAction,
  createDriverAction,
  toggleDriverAction,
  deleteDriverAction,
} from "@/app/actions";
import { platformStatusLabel } from "@/lib/channel-labels";

type Connection = {
  platform: string;
  label: string;
  status: string;
  storeId: string | null;
  hasKey: boolean;
};

type Driver = {
  id: string;
  name: string;
  phone: string | null;
  isActive: boolean;
};

export function DeliveryIntegrationsPanel({
  connections,
  drivers,
}: {
  connections: Connection[];
  drivers: Driver[];
}) {
  return (
    <div className="space-y-5">
      {connections.map((c, idx) => (
        <div
          key={c.platform}
          className="rounded-[16px] border border-[var(--border-dark)] bg-[var(--pill-neutral)] p-4"
          data-guide-section={idx === 0 ? "delivery" : undefined}
        >
          <div className="mb-3 flex justify-between">
            <p className="font-semibold text-[var(--text-primary-dark)]">
              {c.label}
            </p>
            <span className="text-[13px] text-[var(--text-secondary-dark)]">
              {platformStatusLabel(c.status)}
            </span>
          </div>
          <form
            action={saveDeliveryCredentialsAction}
            className="space-y-3"
            data-guide-form="delivery"
          >
            <input type="hidden" name="platform" value={c.platform} />
            <Field label="Clé API">
              <input
                id={idx === 0 ? "guide-work-delivery" : undefined}
                name="apiKey"
                className={inputClass}
                data-guide-action="delivery"
                placeholder={
                  c.hasKey
                    ? "•••••••• (laisser vide pour garder)"
                    : "Coller la clé API"
                }
              />
            </Field>
            <Field label="Store ID">
              <input
                name="storeId"
                className={inputClass}
                defaultValue={c.storeId ?? ""}
                placeholder="ID commerce sur la plateforme"
              />
            </Field>
            <button
              type="submit"
              className="btn-lime btn-lime--sm"
              data-guide-action="delivery"
            >
              Enregistrer
            </button>
          </form>
          <form action={testDeliveryConnectionAction} className="mt-3">
            <input type="hidden" name="platform" value={c.platform} />
            <button
              type="submit"
              className="text-[13px] font-medium text-[var(--text-primary-dark)]"
            >
              Tester connexion
            </button>
          </form>
        </div>
      ))}

      <div className="rounded-[16px] border border-[var(--border-dark)] bg-[var(--pill-neutral)] p-4">
        <p className="mb-3 font-semibold text-[var(--text-primary-dark)]">
          Mes livreurs
        </p>
        {drivers.map((d) => (
          <div
            key={d.id}
            className="mb-2 flex items-center justify-between rounded-[12px] bg-[var(--bg-card-dark)] px-3 py-2"
          >
            <div>
              <p className="text-[14px] font-medium">{d.name}</p>
              <p className="text-[12px] text-[var(--text-secondary-dark)]">
                {d.phone ?? "—"} · {d.isActive ? "Actif" : "Inactif"}
              </p>
            </div>
            <div className="flex gap-3">
              <form action={toggleDriverAction}>
                <input type="hidden" name="driverId" value={d.id} />
                <input
                  type="hidden"
                  name="isActive"
                  value={d.isActive ? "0" : "1"}
                />
                <button
                  type="submit"
                  className="text-[12px] text-[var(--accent-lime)]"
                >
                  {d.isActive ? "Pause" : "Activer"}
                </button>
              </form>
              <form action={deleteDriverAction}>
                <input type="hidden" name="driverId" value={d.id} />
                <button
                  type="submit"
                  className="text-[12px] text-[var(--text-secondary-dark)]"
                >
                  ×
                </button>
              </form>
            </div>
          </div>
        ))}
        <form action={createDriverAction} className="mt-4 space-y-3">
          <Field label="Nom">
            <input name="name" className={inputClass} required />
          </Field>
          <Field label="WhatsApp / téléphone">
            <input name="phone" className={inputClass} placeholder="+336…" />
          </Field>
          <button type="submit" className="btn-lime btn-lime--sm">
            Ajouter un livreur
          </button>
        </form>
      </div>
    </div>
  );
}
