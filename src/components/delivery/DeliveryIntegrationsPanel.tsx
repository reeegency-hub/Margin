"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui";
import {
  saveDeliveryCredentialsAction,
  testDeliveryConnectionAction,
  createDriverAction,
  toggleDriverAction,
  deleteDriverAction,
} from "@/app/actions";
import "./delivery-integrations.css";

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

function statusShort(c: Connection): string {
  if (c.status === "CONNECTED" || c.status === "WEBHOOK_LIVE") return "OK";
  if (c.hasKey || c.status === "KEY_STORED") return "Clé ok";
  return "Pas branché";
}

export function DeliveryIntegrationsPanel({
  connections,
  drivers,
}: {
  connections: Connection[];
  drivers: Driver[];
}) {
  const already =
    connections.find(
      (c) => c.hasKey || c.status === "CONNECTED" || c.status === "KEY_STORED"
    )?.platform ?? null;
  const [open, setOpen] = useState<string | null>(already);

  return (
    <div className="deliv">
      <p className="deliv__lead">
        Optionnel. Ignorez si vous ne livrez pas.
      </p>

      {connections.map((c) => {
        const isOpen = open === c.platform;
        return (
          <div key={c.platform} className="deliv__block">
            <button
              type="button"
              className="deliv__toggle"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : c.platform)}
              data-guide-section={c.platform === "uber_eats" ? "delivery" : undefined}
            >
              <span>{c.label}</span>
              <em>{statusShort(c)}</em>
            </button>
            {isOpen ? (
              <form
                action={saveDeliveryCredentialsAction}
                className="deliv__form"
                data-guide-form="delivery"
              >
                <input type="hidden" name="platform" value={c.platform} />
                <p className="deliv__hint">
                  Pas encore de sync live. Si vous avez une clé partenaire,
                  collez-la — sinon laissez vide.
                </p>
                <Field label="Clé API (si vous en avez une)">
                  <input
                    id={
                      c.platform === "uber_eats"
                        ? "guide-work-delivery"
                        : undefined
                    }
                    name="apiKey"
                    className={inputClass}
                    data-guide-action="delivery"
                    placeholder={
                      c.hasKey ? "•••••••• (inchangée si vide)" : "Optionnel"
                    }
                  />
                </Field>
                <Field label="N° de magasin (optionnel)">
                  <input
                    name="storeId"
                    className={inputClass}
                    defaultValue={c.storeId ?? ""}
                    placeholder="ID sur la plateforme"
                  />
                </Field>
                <div className="deliv__actions">
                  <button
                    type="submit"
                    className="btn-lime btn-lime--sm"
                    data-guide-action="delivery"
                  >
                    Enregistrer
                  </button>
                  <button
                    type="submit"
                    formAction={testDeliveryConnectionAction}
                    className="deliv__ghost"
                  >
                    Tester
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        );
      })}

      <div className="deliv__drivers">
        <p className="deliv__drivers-title">Vos livreurs</p>
        {drivers.length === 0 ? (
          <p className="deliv__hint">Aucun pour l’instant.</p>
        ) : null}
        {drivers.map((d) => (
          <div key={d.id} className="deliv__driver">
            <div>
              <p>{d.name}</p>
              <span>
                {d.phone ?? "—"} · {d.isActive ? "Actif" : "Pause"}
              </span>
            </div>
            <div className="deliv__driver-acts">
              <form action={toggleDriverAction}>
                <input type="hidden" name="driverId" value={d.id} />
                <input
                  type="hidden"
                  name="isActive"
                  value={d.isActive ? "0" : "1"}
                />
                <button type="submit">
                  {d.isActive ? "Pause" : "Activer"}
                </button>
              </form>
              <form action={deleteDriverAction}>
                <input type="hidden" name="driverId" value={d.id} />
                <button type="submit" aria-label="Supprimer">
                  ×
                </button>
              </form>
            </div>
          </div>
        ))}
        <form action={createDriverAction} className="deliv__add">
          <input
            name="name"
            className={inputClass}
            required
            placeholder="Nom"
            aria-label="Nom du livreur"
          />
          <input
            name="phone"
            className={inputClass}
            placeholder="06…"
            aria-label="Téléphone"
          />
          <button type="submit" className="btn-lime btn-lime--sm">
            Ajouter
          </button>
        </form>
      </div>
    </div>
  );
}
