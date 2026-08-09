"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStockOrderAction } from "@/app/actions";
import { buildWaMeLink, shoppingListWaMessage } from "@/lib/wa-link";
import {
  displayUnitLabel,
  preferredDisplayUnit,
  toDisplayQty,
} from "@/lib/units";

export type StockIngredient = {
  id: string;
  name: string;
  unit: string;
  stockTheoretical: number;
  criticalThreshold: number;
  reorderQty: number;
  stockLabel: string;
  thresholdLabel: string;
  reorderLabel: string;
  critical: boolean;
};

type StockStatut = "critique" | "surveiller" | "ok";

const FILTERS = [
  { key: "tous" as const, label: "Tous" },
  { key: "critique" as const, label: "Critiques" },
  { key: "ok" as const, label: "Ok" },
];

function statutOf(ing: StockIngredient): StockStatut {
  if (ing.criticalThreshold <= 0) return "ok";
  if (ing.stockTheoretical <= ing.criticalThreshold) return "critique";
  if (ing.stockTheoretical <= ing.criticalThreshold * 1.5) return "surveiller";
  return "ok";
}

export function StockSheetPanel({
  ingredients,
  restaurantName,
  whatsappTo,
}: {
  ingredients: StockIngredient[];
  restaurantName: string;
  whatsappTo: string | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"tous" | "critique" | "ok">("tous");
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const alertes = useMemo(
    () => ingredients.filter((i) => statutOf(i) === "critique"),
    [ingredients]
  );

  const filtered = useMemo(() => {
    let list = ingredients;
    if (filter === "critique") {
      list = ingredients.filter((i) => statutOf(i) === "critique");
    } else if (filter === "ok") {
      list = ingredients.filter((i) => statutOf(i) !== "critique");
    }
    // Critiques d’abord, puis le reste
    return [...list].sort((a, b) => {
      const sa =
        statutOf(a) === "critique"
          ? 0
          : statutOf(a) === "surveiller"
            ? 1
            : 2;
      const sb =
        statutOf(b) === "critique"
          ? 0
          : statutOf(b) === "surveiller"
            ? 1
            : 2;
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name, "fr");
    });
  }, [ingredients, filter]);

  const PREVIEW = 5;
  const visible = expanded ? filtered : filtered.slice(0, PREVIEW);
  const canToggle = filtered.length > PREVIEW;

  function prepareCriticalList(alsoWhatsApp: boolean) {
    if (!alertes.length) return;
    const items = alertes.map((ing) => {
      const display = preferredDisplayUnit(ing.unit, ing.name);
      const qty = toDisplayQty(
        Math.max(ing.reorderQty || 0, ing.criticalThreshold * 2 || 1),
        display
      );
      return {
        stockUnitId: ing.id,
        name: ing.name,
        quantity: Math.max(ing.reorderQty || 0, ing.criticalThreshold * 2 || 1),
        quantityLabel: `${qty} ${displayUnitLabel(display)}`,
      };
    });

    const href = buildWaMeLink(
      whatsappTo,
      shoppingListWaMessage(
        restaurantName,
        items.map((i) => ({ name: i.name, quantityLabel: i.quantityLabel }))
      )
    );

    startTransition(async () => {
      for (const item of items) {
        const fd = new FormData();
        fd.set("stockUnitId", item.stockUnitId);
        fd.set("quantity", String(item.quantity));
        await createStockOrderAction(fd);
      }
      setMessage(
        alsoWhatsApp
          ? "Liste enregistrée dans Courses."
          : "Liste préparée dans Courses."
      );
      router.refresh();
      if (alsoWhatsApp) {
        if (href) {
          window.open(href, "_blank", "noopener,noreferrer");
        } else {
          setError(
            "Pas de numéro WhatsApp — liste dans Courses. Ajoutez-le dans Réglages."
          );
        }
      }
    });
  }

  return (
    <div className="stock-live">
      {message ? <p className="flash mt-1 mb-3">{message}</p> : null}
      {error ? <p className="flash flash-warn mt-1 mb-3">{error}</p> : null}

      <div className="dash-card dash-card--dark stock-live__panel">
        <header className="stock-live__head">
          <div>
            <span className="stock-live__title">Stock commerce</span>
            <em className="stock-live__badge">
              {alertes.length
                ? `${alertes.length} à racheter`
                : `${ingredients.length} produits`}
            </em>
          </div>
          <div className="stock-live__filters">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  className={`stock-live__filter${
                    active ? " is-on" : ""
                  }`}
                  onClick={() => {
                    setFilter(f.key);
                    setExpanded(false);
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </header>

        {alertes.length > 0 ? (
          <div className="stock-live__action">
            <p>
              {alertes.length} à racheter ·{" "}
              {alertes
                .slice(0, 3)
                .map((p) => p.name)
                .join(", ")}
              {alertes.length > 3 ? "…" : ""}
            </p>
            <div className="stock-live__action-btns">
              <button
                type="button"
                className="stock-live__prepare"
                disabled={pending}
                onClick={() => prepareCriticalList(false)}
              >
                {pending ? "…" : "Préparer la liste"}
              </button>
              <button
                type="button"
                className="stock-live__wa"
                disabled={pending}
                onClick={() => prepareCriticalList(true)}
              >
                {pending ? "Envoi…" : "Envoyer la liste"}
              </button>
            </div>
          </div>
        ) : null}
        <div className="stock-live__rows">
          {visible.map((ing) => (
            <IngredientRow key={ing.id} stockUnit={ing} />
          ))}
          {filtered.length === 0 ? (
            <p className="stock-live__empty">Aucun produit ici.</p>
          ) : null}
        </div>

        {canToggle ? (
          <button
            type="button"
            className="stock-live__more"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded
              ? "Voir moins"
              : `Voir plus (${filtered.length - PREVIEW})`}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function IngredientRow({ stockUnit }: { stockUnit: StockIngredient }) {
  const ingredient = stockUnit;
  const statut = statutOf(ingredient);
  const seuil =
    ingredient.criticalThreshold > 0 ? ingredient.criticalThreshold : 0;

  return (
    <div
      className={`stock-live__row stock-live__row--${statut}`}
      data-statut={statut}
    >
      <div className="stock-live__info">
        <span className="stock-live__name">{ingredient.name}</span>
        <small className="stock-live__hint">
          {statut === "critique"
            ? "à racheter"
            : statut === "surveiller"
              ? "à surveiller"
              : seuil > 0
                ? `seuil ${ingredient.thresholdLabel}`
                : "ok"}
        </small>
      </div>
      <div className="stock-live__delta" aria-label="Stock actuel">
        {seuil > 0 ? <s>{ingredient.thresholdLabel}</s> : null}
        <b>{ingredient.stockLabel}</b>
      </div>
    </div>
  );
}
