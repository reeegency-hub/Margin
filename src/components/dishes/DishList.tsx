"use client";

import { useMemo, useState } from "react";
import { euro } from "@/lib/dashboard";
import { deleteDish } from "@/app/actions";

export type DishRecipeLine = {
  name: string;
  qtyLabel: string;
};

export type DishListItem = {
  id: string;
  name: string;
  description: string | null;
  allergens: string | null;
  imageUrl: string | null;
  salePrice: number;
  /** @deprecated prefer recipeLines */
  ingredientsLabel?: string;
  recipeLines: DishRecipeLine[];
  externalSku?: string | null;
};

const PREVIEW = 8;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function stockHint(dish: DishListItem): string {
  const lines = dish.recipeLines;
  if (!lines.length) return "Pas de lien stock";
  if (lines.length === 1) {
    const sameName =
      lines[0].name.trim().toLowerCase() === dish.name.trim().toLowerCase();
    return sameName
      ? `Stock · ${lines[0].qtyLabel} / vente`
      : `${lines[0].name} · ${lines[0].qtyLabel}`;
  }
  return `${lines.length} refs stock`;
}

export function DishList({
  dishes,
  from = "stock",
}: {
  dishes: DishListItem[];
  from?: "stock" | "dishes";
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dishes;
    return dishes.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.externalSku && d.externalSku.toLowerCase().includes(q)) ||
        d.recipeLines.some((l) => l.name.toLowerCase().includes(q))
    );
  }, [dishes, query]);

  const visible = expanded ? filtered : filtered.slice(0, PREVIEW);
  const canToggle = filtered.length > PREVIEW;

  if (dishes.length === 0) {
    return (
      <div className="catalog-empty">
        <p className="catalog-empty__title">Aucun produit dans le catalogue</p>
        <p className="catalog-empty__body">
          Créez une fiche (nom + prix) pour lier la vente au stock. Ou importez
          depuis l’onboarding / la caisse.
        </p>
      </div>
    );
  }

  return (
    <div className="catalog-list">
      <div className="catalog-list__toolbar">
        <input
          type="search"
          className="catalog-list__search"
          placeholder="Rechercher un produit…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setExpanded(true);
          }}
          aria-label="Rechercher un produit"
        />
        <span className="catalog-list__count">
          {filtered.length === dishes.length
            ? `${dishes.length} produit${dishes.length > 1 ? "s" : ""}`
            : `${filtered.length} / ${dishes.length}`}
        </span>
      </div>

      <div className="catalog-list__head phone-hide" aria-hidden>
        <span>Produit</span>
        <span>Stock consommé</span>
        <span>Prix</span>
        <span />
      </div>

      <ul className="catalog-list__rows">
        {visible.map((dish) => (
          <li key={dish.id} className="catalog-row">
            <div className="catalog-row__product">
              <div className="catalog-row__media">
                {dish.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={dish.imageUrl} alt="" />
                ) : (
                  <span className="catalog-row__initials" aria-hidden>
                    {initials(dish.name)}
                  </span>
                )}
              </div>
              <div className="catalog-row__meta">
                <p className="catalog-row__name">{dish.name}</p>
                {dish.description ? (
                  <p className="catalog-row__desc">{dish.description}</p>
                ) : null}
                {dish.externalSku ? (
                  <p className="catalog-row__sku">SKU {dish.externalSku}</p>
                ) : null}
                {dish.allergens ? (
                  <p className="catalog-row__allergens">
                    Allergènes : {dish.allergens}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="catalog-row__stock">
              <span className="catalog-row__stock-main">{stockHint(dish)}</span>
              {dish.recipeLines.length > 1 ? (
                <ul className="catalog-row__recipe">
                  {dish.recipeLines.slice(0, 3).map((l) => (
                    <li key={`${dish.id}-${l.name}`}>
                      {l.name} · {l.qtyLabel}
                    </li>
                  ))}
                  {dish.recipeLines.length > 3 ? (
                    <li>+{dish.recipeLines.length - 3} autres</li>
                  ) : null}
                </ul>
              ) : null}
            </div>

            <div className="catalog-row__price tabular-nums">
              {euro(dish.salePrice)}
            </div>

            <div className="catalog-row__actions">
              {confirmId === dish.id ? (
                <form action={deleteDish} className="catalog-row__confirm">
                  <input type="hidden" name="id" value={dish.id} />
                  <input type="hidden" name="from" value={from} />
                  <button type="submit" className="btn-lime btn-ghost--sm">
                    Confirmer
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-ghost--sm"
                    onClick={() => setConfirmId(null)}
                  >
                    Annuler
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="btn-ghost btn-ghost--sm"
                  onClick={() => setConfirmId(dish.id)}
                >
                  Retirer
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!filtered.length ? (
        <p className="catalog-list__none">Aucun résultat pour « {query} ».</p>
      ) : null}

      {canToggle ? (
        <button
          type="button"
          className="list-expand-btn"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded
            ? "Voir moins"
            : `Voir plus (${filtered.length - PREVIEW} autres)`}
        </button>
      ) : null}
    </div>
  );
}
