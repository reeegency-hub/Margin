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
  const liveVendor = live
    ? POS_VENDOR_LABELS[live.vendor as PosVendor] ?? live.vendor
    : null;

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
    <div className="pos-setup space-y-6">
      <div className="pos-ticket">
        <header className="pos-ticket__head">
          <span
            className={`pos-ticket__dot${live?.lastOrderAt ? " is-on" : ""}`}
          />
          <span>
            {live
              ? `Caisse · ${liveVendor}`
              : "Caisse · pas encore branchée"}
          </span>
          <em>{live?.lastOrderAt ? "sync" : "attente"}</em>
        </header>
        <div className="pos-ticket__body">
          <p className="pos-ticket__id">
            {live?.lastOrderAt
              ? `Dernière vente · ${live.lastOrderAt}`
              : "Choisissez votre logiciel, créez le lien, branchez"}
          </p>
          {pendingProducts.length > 0 ? (
            <ul className="pos-ticket__lines">
              {pendingProducts.slice(0, 4).map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <span>{euro(p.lastUnitPrice)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="pos-ticket__lines pos-ticket__lines--muted">
              <li>
                <span>Les ventes arriveront ici</span>
                <span>→ stock</span>
              </li>
            </ul>
          )}
          <footer className="pos-ticket__foot">
            <span>
              {pendingProducts.length
                ? `${pendingProducts.length} à valider`
                : live?.lastOrderAt
                  ? "Connectée"
                  : "À brancher"}
            </span>
            <span>{live?.name || "—"}</span>
          </footer>
        </div>
        <p className="pos-ticket__pulse">
          {live?.lastOrderAt
            ? "→ stock mis à jour automatiquement"
            : "→ branchez pour synchroniser le magasin"}
        </p>
      </div>

      <ol className="pos-steps" aria-label="Étapes de connexion">
        {[
          "Logiciel",
          "Lien caisse",
          "Brancher / tester",
          "Produits",
        ].map((label, i) => (
          <li
            key={label}
            className={`pos-steps__item${i === stepIndex ? " is-active" : ""}${
              i < stepIndex ? " is-done" : ""
            }`}
          >
            <span>{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <section className="space-y-3">
        <h3 className="text-[15px] font-semibold text-[var(--text-primary-dark)]">
          1. Votre logiciel de caisse
        </h3>
        <p className="text-[13px] text-[var(--text-secondary-dark)]">
          Sélectionnez celui installé en magasin. C’est le point de départ pour
          synchroniser les ventes → stock.
        </p>
        <div className="pos-vendor-grid" data-guide-action="pos">
          {POS_PICKER_VENDORS.map((v) => {
            const active = selectedVendor === v;
            const count = connections.filter((c) => c.vendor === v).length;
            return (
              <button
                key={v}
                type="button"
                onClick={() => pickVendor(v)}
                className={`pos-vendor${active ? " is-on" : ""}`}
                data-guide-action="pos"
              >
                <strong>{POS_VENDOR_LABELS[v]}</strong>
                <span>
                  {count
                    ? `${count} lien${count > 1 ? "s" : ""}`
                    : "Pas encore lié"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {selectedVendor ? (
        <>
          <section className="pos-guide space-y-3">
            <h3 className="text-[15px] font-semibold text-[var(--text-primary-dark)]">
              Guide {tuto.title}
            </h3>
            <p className="text-[14px] text-[var(--text-secondary-dark)]">
              {tuto.body}
            </p>
            <ol className="pos-guide__list">
              {tuto.tips.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </section>

          <section className="space-y-3">
            <h3 className="text-[15px] font-semibold text-[var(--text-primary-dark)]">
              2. Créer / gérer le lien
            </h3>
            <p className="text-[13px] text-[var(--text-secondary-dark)]">
              Margin génère une adresse sécurisée pour{" "}
              {POS_VENDOR_LABELS[vendor]}. En Franchise, on branche pour vous.
              En Commerce, vous (ou votre intégrateur) collez l’adresse dans la
              caisse.
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
                <CopyField
                  label="Adresse v1 (SKU strict + HMAC)"
                  value={`${baseUrl}/api/v1/webhooks/pos/${c.vendor === "tiller" ? "sumup" : c.vendor}?connectionId=${c.id}`}
                />
                {c.webhookSecret ? (
                  <details className="pos-tech-details mt-2">
                    <summary>Code secret (à ne pas partager)</summary>
                    <div className="mt-2 space-y-2">
                      <CopyField
                        label="Code secret (x-webhook-secret)"
                        value={c.webhookSecret}
                      />
                      <p className="text-[12px] opacity-70">
                        HMAC optionnel : header{" "}
                        <code>x-pos-signature: sha256=…</code> (HMAC-SHA256 du
                        body avec ce secret).
                      </p>
                    </div>
                  </details>
                ) : null}

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
                  <form action={deletePosConnectionAction} className="mt-2 space-y-2">
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

          <section className="pos-guide space-y-2">
            <h3 className="text-[15px] font-semibold text-[var(--text-primary-dark)]">
              3. Brancher & vérifier
            </h3>
            <ul className="pos-guide__tips">
              {tuto.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="text-[13px] text-[var(--text-secondary-dark)]">
              Utilisez <strong>Tester une vente</strong> pour vérifier sans
              toucher à la vraie caisse. Ensuite, une vente réelle confirme que
              le stock suit.
            </p>
          </section>
        </>
      ) : (
        <div className="pos-guide">
          <p className="text-[14px] text-[var(--text-secondary-dark)]">
            Choisissez votre logiciel ci-dessus pour afficher le guide et créer
            le lien caisse de votre magasin.
          </p>
        </div>
      )}

      {countIngredientIds ? (
        <div className="pos-guide">
          <p className="font-semibold text-[var(--text-primary-dark)]">
            Catalogue mis à jour — comptez maintenant
          </p>
          <form action={startInventoryForIngredientsAction} className="mt-3">
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
      ) : null}

      <section className="space-y-3 border-t border-[var(--border-dark)] pt-4">
        <h3 className="text-[15px] font-semibold text-[var(--text-primary-dark)]">
          4. Produits découverts ({pendingProducts.length})
        </h3>
        <p className="text-[13px] text-[var(--text-secondary-dark)]">
          Après branchement, les articles inconnus apparaissent ici. Vous
          validez → catalogue → vérification stock.
        </p>
        {pendingProducts.length === 0 ? (
          <p className="text-[13px] text-[var(--text-secondary-dark)]">
            Aucun produit en attente — simulez une vente ou vendez en caisse.
          </p>
        ) : (
          <>
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
          </>
        )}
      </section>
    </div>
  );
}
