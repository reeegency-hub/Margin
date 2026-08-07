"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Field, inputClass } from "@/components/ui";
import {
  acceptPosPendingProductsAction,
  createPosConnectionAction,
  deletePosConnectionAction,
  ignorePosPendingProductsAction,
  regeneratePosSecretAction,
  simulatePosTestSaleAction,
  startInventoryForIngredientsAction,
  updatePosApiKeyAction,
} from "@/app/actions";
import { POS_VENDOR_LABELS, type PosVendor } from "@/lib/pos/types";
import { POS_PICKER_VENDORS, getPosTuto } from "@/lib/pos/tutos";
import { POS_API_CAPABILITY, vendorSupportsApiPull } from "@/lib/pos/pull";

type Connection = {
  id: string;
  name: string;
  vendor: string;
  status: string;
  webhookUrl: string;
  webhookSecret: string | null;
  lastOrderAt: string | null;
  hasApiKey: boolean;
  merchantExternalId: string | null;
  apiBaseUrl: string | null;
};

export type PendingProduct = {
  id: string;
  name: string;
  externalSku: string | null;
  lastUnitPrice: number | null;
  timesSeen: number;
  totalQtySold: number;
  vendorHint: string | null;
};

function euro(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

function statusLabel(status: string, lastOrderAt: string | null) {
  if (lastOrderAt) return `Connectée · dernière vente ${lastOrderAt}`;
  if (status === "CONNECTED") return "Connectée";
  if (status === "PENDING") return "En attente de première vente";
  return status;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="pos-copy">
      <p className="pos-copy__label">{label}</p>
      <div className="pos-copy__row">
        <code className="pos-copy__value">{value}</code>
        <button
          type="button"
          className="btn-ghost pos-copy__btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              /* ignore */
            }
          }}
        >
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
    </div>
  );
}

export function PosConnectionPanel({
  connections,
  pendingProducts,
  countIngredientIds,
  baseUrl,
}: {
  connections: Connection[];
  baseUrl: string;
  pendingProducts: PendingProduct[];
  countIngredientIds?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedVendor = (searchParams.get("pos") as PosVendor | null) || null;

  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(pendingProducts.map((p) => [p.id, true]))
  );

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([id]) => id),
    [selected]
  );

  const tuto = getPosTuto(selectedVendor);
  const vendor = selectedVendor || "custom";
  const forVendor = connections.filter(
    (c) => !selectedVendor || c.vendor === selectedVendor
  );

  const live = connections.find((c) => c.lastOrderAt) || connections[0];
  const hasPending = pendingProducts.length > 0;

  const stepIndex = !selectedVendor
    ? 0
    : forVendor.length === 0
      ? 1
      : live?.lastOrderAt
        ? 3
        : 2;

  function pickVendor(v: PosVendor) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("pos", v);
    for (const k of [
      "imported",
      "accepted",
      "ignored",
      "connected",
      "secret",
      "name",
      "countIngredients",
      "tested",
      "deleted",
      "error",
    ]) {
      next.delete(k);
    }
    router.replace(`/kiosks?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="pos-setup space-y-4">
      {countIngredientIds ? (
        <div className="dash-card dash-card--dark hub-now">
          <p className="hub-now__eyebrow">Après sync</p>
          <p className="hub-now__title">Catalogue mis à jour</p>
          <p className="hub-now__detail">
            Comptez ces produits pour aligner le stock réel.
          </p>
          <div className="hub-now__actions">
            <form action={startInventoryForIngredientsAction}>
              <input
                type="hidden"
                name="ingredientIds"
                value={countIngredientIds}
              />
              <input
                type="hidden"
                name="note"
                value="Vérification après sync caisse"
              />
              <button type="submit" className="btn-lime">
                Compter ces produits
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {hasPending ? (
        <section className="dash-card dash-card--light space-y-3">
          <p className="hub-section-title">
            Produits découverts ({pendingProducts.length})
          </p>
          <p className="hub-section-lead">
            Validez pour les ajouter au catalogue, puis comptez si besoin.
          </p>
          <ul className="space-y-2">
            {pendingProducts.map((p) => (
              <li key={p.id} className="pos-pending">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={Boolean(selected[p.id])}
                  onChange={(e) =>
                    setSelected((s) => ({ ...s, [p.id]: e.target.checked }))
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[var(--text-primary-dark)]">
                    {p.name}
                  </p>
                  <p className="text-[12px] text-[var(--text-secondary-dark)]">
                    {p.vendorHint ? `${p.vendorHint} · ` : ""}
                    {p.externalSku ? `SKU ${p.externalSku} · ` : ""}
                    {euro(p.lastUnitPrice)} · vu {p.timesSeen}×
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <form action={acceptPosPendingProductsAction}>
              {selectedIds.map((id) => (
                <input key={id} type="hidden" name="pendingId" value={id} />
              ))}
              <button
                type="submit"
                className="btn-lime"
                disabled={!selectedIds.length}
              >
                Ajouter au catalogue ({selectedIds.length})
              </button>
            </form>
            <form action={ignorePosPendingProductsAction}>
              {selectedIds.map((id) => (
                <input key={id} type="hidden" name="pendingId" value={id} />
              ))}
              <button
                type="submit"
                className="btn-ghost"
                disabled={!selectedIds.length}
              >
                Ignorer
              </button>
            </form>
          </div>
        </section>
      ) : null}

      {hasPending ? (
        <details className="pos-setup-fold">
          <summary className="pos-setup-fold__summary">
            Brancher / gérer la caisse
          </summary>
          <div className="pos-setup-fold__body space-y-4">
            <PosSetupBody
              selectedVendor={selectedVendor}
              connections={connections}
              forVendor={forVendor}
              vendor={vendor}
              tuto={tuto}
              stepIndex={stepIndex}
              baseUrl={baseUrl}
              pickVendor={pickVendor}
            />
          </div>
        </details>
      ) : (
        <div className="space-y-4">
          <PosSetupBody
            selectedVendor={selectedVendor}
            connections={connections}
            forVendor={forVendor}
            vendor={vendor}
            tuto={tuto}
            stepIndex={stepIndex}
            baseUrl={baseUrl}
            pickVendor={pickVendor}
          />
        </div>
      )}
    </div>
  );
}

function PosSetupBody({
  selectedVendor,
  connections,
  forVendor,
  vendor,
  tuto,
  stepIndex,
  baseUrl,
  pickVendor,
}: {
  selectedVendor: PosVendor | null;
  connections: Connection[];
  forVendor: Connection[];
  vendor: PosVendor;
  tuto: ReturnType<typeof getPosTuto>;
  stepIndex: number;
  baseUrl: string;
  pickVendor: (v: PosVendor) => void;
}) {
  return (
    <>
      <ol className="pos-steps" aria-label="Étapes de connexion">
        {["Logiciel", "Lien caisse", "Brancher / tester", "Produits"].map(
          (label, i) => (
            <li
              key={label}
              className={`pos-steps__item${
                i === stepIndex ? " is-active" : ""
              }${i < stepIndex ? " is-done" : ""}`}
            >
              <span>{i + 1}</span>
              {label}
            </li>
          )
        )}
      </ol>

      <section className="dash-card dash-card--light pos-pick">
        <header className="pos-pick__head">
          <p className="hub-section-title">Votre logiciel de caisse</p>
          <p className="hub-section-lead">
            {selectedVendor
              ? `${POS_VENDOR_LABELS[selectedVendor]} sélectionné — suite juste en dessous.`
              : "Choisissez celui installé en magasin. Un clic suffit."}
          </p>
        </header>
        <ul className="pos-pick__list" data-guide-action="pos">
          {POS_PICKER_VENDORS.map((v) => {
            const active = selectedVendor === v;
            const count = connections.filter((c) => c.vendor === v).length;
            const linked = count > 0;
            return (
              <li key={v}>
                <button
                  type="button"
                  onClick={() => pickVendor(v)}
                  className={`pos-pick__row${active ? " is-on" : ""}${
                    linked ? " is-linked" : ""
                  }`}
                  data-guide-action="pos"
                  aria-pressed={active}
                >
                  <span className="pos-pick__name">
                    {POS_VENDOR_LABELS[v]}
                  </span>
                  <span className="pos-pick__meta">
                    {linked
                      ? count > 1
                        ? `${count} liens`
                        : "Lié"
                      : active
                        ? "Sélectionné"
                        : "Choisir"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {selectedVendor ? (
        <>
          <details
            className="dash-card dash-card--light pos-guide-details"
            open={forVendor.length === 0}
          >
            <summary className="hub-section-title">Guide {tuto.title}</summary>
            <p className="hub-section-lead mt-2">{tuto.body}</p>
            <ol className="pos-guide__list">
              {tuto.tips.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </details>

          <section className="dash-card dash-card--light space-y-3">
            <p className="hub-section-title">Créer / gérer le lien</p>
            <p className="hub-section-lead">
              Margin génère une adresse sécurisée pour{" "}
              {POS_VENDOR_LABELS[vendor]}. En Franchise, on branche pour vous.
            </p>

            {forVendor.map((c) => (
              <div key={c.id} className="pos-link">
                <div className="pos-link__head">
                  <div>
                    <p className="font-medium text-[var(--text-primary-dark)]">
                      {c.name}
                    </p>
                    <p className="text-[12px] text-[var(--text-secondary-dark)]">
                      {statusLabel(c.status, c.lastOrderAt)}
                    </p>
                  </div>
                  <span
                    className={`pos-badge${c.lastOrderAt ? " is-on" : ""}`}
                  >
                    {c.lastOrderAt ? "À jour" : "En attente"}
                  </span>
                </div>

                <CopyField
                  label="Adresse à coller dans votre caisse"
                  value={c.webhookUrl}
                />
                <details className="pos-tech-details mt-2">
                  <summary>Adresse v1 & code secret</summary>
                  <div className="mt-2 space-y-2">
                    <CopyField
                      label="Adresse v1 (SKU strict + HMAC)"
                      value={`${baseUrl}/api/v1/webhooks/pos/${c.vendor === "tiller" ? "sumup" : c.vendor}?connectionId=${c.id}`}
                    />
                    {c.webhookSecret ? (
                      <>
                        <CopyField
                          label="Code secret (x-webhook-secret)"
                          value={c.webhookSecret}
                        />
                        <p className="text-[12px] opacity-70">
                          HMAC optionnel : header{" "}
                          <code>x-pos-signature: sha256=…</code>
                        </p>
                      </>
                    ) : null}
                  </div>
                </details>

                <div className="pos-link__actions">
                  {process.env.NODE_ENV !== "production" ? (
                    <form action={simulatePosTestSaleAction}>
                      <input type="hidden" name="connectionId" value={c.id} />
                      <button type="submit" className="btn-lime">
                        Tester une vente
                      </button>
                    </form>
                  ) : null}
                  <form action={regeneratePosSecretAction}>
                    <input type="hidden" name="connectionId" value={c.id} />
                    <button type="submit" className="btn-ghost">
                      Régénérer le code secret
                    </button>
                  </form>
                </div>

                {vendorSupportsApiPull(vendor) ? (
                  <details className="mt-2">
                    <summary className="text-[13px] cursor-pointer opacity-80">
                      API {POS_VENDOR_LABELS[vendor] ?? vendor} (pull nuit)
                      {c.hasApiKey ? " · clé enregistrée" : ""}
                    </summary>
                    <form
                      action={updatePosApiKeyAction}
                      className="mt-2 space-y-2"
                    >
                      <input type="hidden" name="connectionId" value={c.id} />
                      <Field
                        label={
                          POS_API_CAPABILITY[vendor as PosVendor]?.apiKeyLabel ||
                          "Clé API"
                        }
                      >
                        <input
                          name="apiKey"
                          type="password"
                          className={inputClass}
                          placeholder={
                            c.hasApiKey
                              ? "•••••••• (nouveau token pour remplacer)"
                              : "Coller la clé / token API"
                          }
                          autoComplete="off"
                        />
                      </Field>
                      {POS_API_CAPABILITY[vendor as PosVendor]
                        ?.merchantIdLabel ? (
                        <Field
                          label={
                            POS_API_CAPABILITY[vendor as PosVendor]!
                              .merchantIdLabel!
                          }
                        >
                          <input
                            name="merchantExternalId"
                            className={inputClass}
                            defaultValue={c.merchantExternalId ?? ""}
                            placeholder="Ex. location_id / account_id"
                            autoComplete="off"
                          />
                        </Field>
                      ) : null}
                      {(vendor === "custom" || vendor === "other") && (
                        <Field label="URL de base API">
                          <input
                            name="apiBaseUrl"
                            className={inputClass}
                            defaultValue={c.apiBaseUrl ?? ""}
                            placeholder="https://api.exemple.com/v1"
                            autoComplete="off"
                          />
                        </Field>
                      )}
                      <button type="submit" className="btn-ghost">
                        Enregistrer l’API
                      </button>
                    </form>
                  </details>
                ) : null}

                <details className="pos-danger mt-2">
                  <summary>Supprimer ce lien</summary>
                  <form
                    action={deletePosConnectionAction}
                    className="mt-2 space-y-2"
                  >
                    <input type="hidden" name="connectionId" value={c.id} />
                    <Field label={`Tapez « ${c.name} » pour confirmer`}>
                      <input
                        name="confirm"
                        className={inputClass}
                        autoComplete="off"
                        required
                      />
                    </Field>
                    <button type="submit" className="btn-ghost">
                      Supprimer définitivement
                    </button>
                  </form>
                </details>
              </div>
            ))}

            <form
              action={createPosConnectionAction}
              className="pos-create space-y-3"
              data-guide-form="pos"
            >
              <input type="hidden" name="vendor" value={vendor} />
              <p className="text-[13px] font-medium text-[var(--text-primary-dark)]">
                {forVendor.length
                  ? "Ajouter une autre caisse"
                  : "Nouvelle connexion"}
              </p>
              <Field label="Nom de la caisse">
                <input
                  name="name"
                  className={inputClass}
                  placeholder={`Caisse ${POS_VENDOR_LABELS[vendor]}`}
                  defaultValue={`Caisse ${POS_VENDOR_LABELS[vendor]}`}
                  required
                  data-guide-action="pos"
                />
              </Field>
              {vendor === "custom" ? (
                <Field label="Nom du logiciel (si autre)">
                  <input
                    name="vendorNote"
                    className={inputClass}
                    placeholder="Ex. Cegid, JDC, PixelPoint…"
                  />
                </Field>
              ) : null}
              {vendorSupportsApiPull(vendor) ? (
                <>
                  <Field
                    label={
                      POS_API_CAPABILITY[vendor]?.apiKeyLabel ||
                      "Clé API (optionnel — pull nuit)"
                    }
                  >
                    <input
                      name="apiKey"
                      type="password"
                      className={inputClass}
                      placeholder="Token / clé API partenaire"
                      autoComplete="off"
                    />
                  </Field>
                  {POS_API_CAPABILITY[vendor]?.merchantIdLabel ? (
                    <Field label={POS_API_CAPABILITY[vendor]!.merchantIdLabel!}>
                      <input
                        name="merchantExternalId"
                        className={inputClass}
                        placeholder="Requis pour le pull nuit"
                        autoComplete="off"
                      />
                    </Field>
                  ) : null}
                  {(vendor === "custom" || vendor === "other") && (
                    <Field label="URL de base API">
                      <input
                        name="apiBaseUrl"
                        className={inputClass}
                        placeholder="https://api.exemple.com/v1"
                        autoComplete="off"
                      />
                    </Field>
                  )}
                </>
              ) : null}
              <button type="submit" className="btn-lime">
                {forVendor.length
                  ? "Créer un autre lien"
                  : "Créer la connexion"}
              </button>
            </form>
          </section>

          <section className="dash-card dash-card--light space-y-2">
            <p className="hub-section-title">Brancher & vérifier</p>
            <p className="hub-section-lead">
              Collez l’adresse dans la caisse. Utilisez{" "}
              <strong>Tester une vente</strong> (local) pour vérifier sans
              toucher à la vraie caisse.
            </p>
          </section>
        </>
      ) : (
        <div className="dash-card dash-card--light hub-empty">
          <p>
            Choisissez votre logiciel ci-dessus pour afficher le guide et créer
            le lien caisse.
          </p>
        </div>
      )}
    </>
  );
}
