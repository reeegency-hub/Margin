"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inputClass } from "@/components/ui";
import {
  analyzeMenuAction,
  confirmMenuRecipesAction,
  createIngredientsBulkAction,
  uploadMenuFileAction,
} from "@/app/actions";
import type { ProposedDish } from "@/lib/menu-ai";
import {
  applyUnitDefaults,
  preferredDisplayUnit,
  toDisplayQty,
  toStorageQty,
  type DisplayUnit,
  type StorageUnit,
} from "@/lib/units";

type Row = {
  key: string;
  name: string;
  unit: StorageUnit;
  displayUnit: DisplayUnit;
  stockTheoretical: string;
  criticalThreshold: string;
  reorderQty: string;
};

function emptyRow(): Row {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    unit: "pcs",
    displayUnit: "pcs",
    stockTheoretical: "0",
    criticalThreshold: "0",
    reorderQty: "0",
  };
}

function rowFromName(name: string): Omit<Row, "key"> {
  const defaults = applyUnitDefaults(name);
  const display = preferredDisplayUnit(defaults.unit, name);
  return {
    name,
    unit: defaults.unit,
    displayUnit: display,
    stockTheoretical: "0",
    criticalThreshold: String(
      toDisplayQty(defaults.criticalThreshold, display)
    ),
    reorderQty: String(toDisplayQty(defaults.reorderQty, display)),
  };
}

type FuzzyItem = {
  productIdx: number;
  ingIdx: number;
  product: string;
  stockUnit: string;
  quantity: number;
  unit: "g" | "ml" | "pcs";
  reason: string;
};

function isFuzzyIng(ing: { quantity: number; confidence: number; name: string }) {
  return !(ing.quantity > 0) || ing.confidence < 0.5;
}

function fuzzyReason(ing: { quantity: number; confidence: number; name: string }) {
  const n = ing.name.toLowerCase();
  if (/portion|au choix|choix/.test(n)) return "portion / au choix";
  if (!(ing.quantity > 0)) return "quantité manquante";
  return "quantité imprécise";
}

/** Suggestion réaliste pour une ligne floue (formules, au choix…). */
function suggestFuzzyQty(
  ingredientName: string,
  unit: "g" | "ml" | "pcs"
): { quantity: number; unit: "g" | "ml" | "pcs" } {
  const n = ingredientName.toLowerCase();
  if (/boisson|canette|bouteille|eau|meco|soda/.test(n)) {
    return { quantity: 1, unit: "pcs" };
  }
  if (/dessert|macaron|mochi|fondant/.test(n)) {
    return { quantity: 1, unit: "pcs" };
  }
  if (/rouleau|maki|california|pop|temaki/.test(n)) {
    return { quantity: 1, unit: "pcs" };
  }
  if (/nouille|riz|pokebowl|bowl/.test(n) || /portion|au choix/.test(n)) {
    return { quantity: 1, unit: "pcs" };
  }
  if (unit === "pcs") return { quantity: 1, unit: "pcs" };
  if (unit === "ml") return { quantity: 200, unit: "ml" };
  return { quantity: 100, unit: "g" };
}

export function IngredientAddPanel({
  mode = "hero",
}: {
  /** hero = page vide (import dominant) · compact = catalogue déjà rempli */
  mode?: "hero" | "compact";
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [paste, setPaste] = useState("");
  const [dishes, setDishes] = useState<ProposedDish[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const [fixDraft, setFixDraft] = useState<
    Record<string, { quantity: string; unit: "g" | "ml" | "pcs" }>
  >({});

  const missingQty = useMemo((): FuzzyItem[] => {
    if (!dishes) return [];
    const out: FuzzyItem[] = [];
    dishes.forEach((d, productIdx) => {
      d.ingredients.forEach((i, ingIdx) => {
        if (!isFuzzyIng(i)) return;
        out.push({
          productIdx,
          ingIdx,
          product: d.name,
          stockUnit: i.name,
          quantity: i.quantity,
          unit: i.unit,
          reason: fuzzyReason(i),
        });
      });
    });
    return out;
  }, [dishes]);

  const fuzzyByDish = useMemo(() => {
    const map = new Map<string, FuzzyItem[]>();
    for (const m of missingQty) {
      const list = map.get(m.product) ?? [];
      list.push(m);
      map.set(m.product, list);
    }
    return [...map.entries()];
  }, [missingQty]);

  const fuzzyKey = (m: FuzzyItem) => `${m.productIdx}:${m.ingIdx}`;

  const openFixModal = useCallback(
    (items: FuzzyItem[] = missingQty) => {
      const draft: Record<string, { quantity: string; unit: "g" | "ml" | "pcs" }> =
        {};
      for (const m of items) {
        const sug = suggestFuzzyQty(m.stockUnit, m.unit);
        draft[fuzzyKey(m)] = {
          quantity: String(m.quantity > 0 ? m.quantity : sug.quantity),
          unit: m.quantity > 0 ? m.unit : sug.unit,
        };
      }
      setFixDraft(draft);
      setFixOpen(true);
      setError(null);
    },
    [missingQty]
  );

  const stats = useMemo(() => {
    if (!dishes) return null;
    const names = new Set<string>();
    let lines = 0;
    for (const d of dishes) {
      for (const i of d.ingredients) {
        names.add(i.name.trim().toLowerCase());
        lines += 1;
      }
    }
    return {
      dishes: dishes.length,
      ingredients: names.size,
      lines,
    };
  }, [dishes]);

  const updateRow = useCallback((key: string, patch: Partial<Row>) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  }, []);

  const onNameChange = useCallback((key: string, name: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        if (!name.trim()) return { ...r, name };
        const defaults = applyUnitDefaults(name);
        const display = preferredDisplayUnit(defaults.unit, name);
        const untouchedSeuil =
          r.criticalThreshold === "0" || r.criticalThreshold === "";
        const untouchedStock =
          r.stockTheoretical === "0" || r.stockTheoretical === "";
        return {
          ...r,
          name,
          unit: defaults.unit,
          displayUnit: display,
          criticalThreshold: untouchedSeuil
            ? String(toDisplayQty(defaults.criticalThreshold, display))
            : r.criticalThreshold,
          reorderQty: String(toDisplayQty(defaults.reorderQty, display)),
          stockTheoretical: untouchedStock ? "0" : r.stockTheoretical,
        };
      })
    );
  }, []);

  const applyDishesResult = useCallback((next: ProposedDish[]) => {
    setDishes(next);
    setMessage(
      `${next.length} produit(s) détecté(s) — vérifiez puis enregistrez pour créer le catalogue + le stock.`
    );
    const fuzzy: FuzzyItem[] = [];
    next.forEach((d, productIdx) => {
      d.ingredients.forEach((i, ingIdx) => {
        if (!isFuzzyIng(i)) return;
        fuzzy.push({
          productIdx,
          ingIdx,
          product: d.name,
          stockUnit: i.name,
          quantity: i.quantity,
          unit: i.unit,
          reason: fuzzyReason(i),
        });
      });
    });
    if (fuzzy.length) {
      const draft: Record<string, { quantity: string; unit: "g" | "ml" | "pcs" }> =
        {};
      for (const m of fuzzy) {
        const sug = suggestFuzzyQty(m.stockUnit, m.unit);
        draft[`${m.productIdx}:${m.ingIdx}`] = {
          quantity: String(m.quantity > 0 ? m.quantity : sug.quantity),
          unit: m.quantity > 0 ? m.unit : sug.unit,
        };
      }
      setFixDraft(draft);
      setFixOpen(true);
    }
  }, []);

  const runPaste = () => {
    setError(null);
    setMessage(null);
    const text = paste.trim();
    if (text.length < 2) {
      setError("Collez au moins un nom de produit.");
      return;
    }
    startTransition(async () => {
      const res = await analyzeMenuAction(text);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      applyDishesResult(res.dishes);
    });
  };

  const onDropFile = useCallback(
    (file: File) => {
      setError(null);
      setMessage(null);
      const lower = file.name.toLowerCase();
      const isText =
        lower.endsWith(".txt") ||
        lower.endsWith(".md") ||
        lower.endsWith(".csv") ||
        file.type.startsWith("text/");

      if (isText) {
        startTransition(async () => {
          const text = await file.text();
          setPaste(text);
          const res = await analyzeMenuAction(text);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          applyDishesResult(res.dishes);
        });
        return;
      }

      const fd = new FormData();
      fd.set("file", file);
      startTransition(async () => {
        const res = await uploadMenuFileAction(fd);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if (res.extractedText) setPaste(res.extractedText);
        applyDishesResult(res.dishes);
      });
    },
    [applyDishesResult]
  );

  const updateDishIng = (
    productIdx: number,
    ingIdx: number,
    patch: { quantity?: number; unit?: "g" | "ml" | "pcs" }
  ) => {
    setDishes((prev) => {
      if (!prev) return prev;
      return prev.map((d, di) => {
        if (di !== productIdx) return d;
        return {
          ...d,
          ingredients: d.ingredients.map((ing, ii) => {
            if (ii !== ingIdx) return ing;
            const quantity =
              patch.quantity !== undefined ? patch.quantity : ing.quantity;
            const unit = patch.unit ?? ing.unit;
            return {
              ...ing,
              quantity,
              unit,
              confidence: quantity > 0 ? 0.95 : 0.3,
            };
          }),
        };
      });
    });
  };

  const applyFixDraft = (andConfirm: boolean) => {
    if (!dishes) return;
    let next = dishes;
    for (const m of missingQty) {
      const key = fuzzyKey(m);
      const draft = fixDraft[key];
      if (!draft) continue;
      const qty = Number(draft.quantity);
      if (!(qty > 0)) continue;
      next = next.map((d, di) => {
        if (di !== m.productIdx) return d;
        return {
          ...d,
          ingredients: d.ingredients.map((ing, ii) =>
            ii === m.ingIdx
              ? {
                  ...ing,
                  quantity: qty,
                  unit: draft.unit,
                  confidence: 0.95,
                }
              : ing
          ),
        };
      });
    }
    setDishes(next);
    setFixOpen(false);

    const still = next.some((d) => d.ingredients.some(isFuzzyIng));
    if (still) {
      setError("Il reste des quantités à préciser.");
      return;
    }
    if (andConfirm) {
      setError(null);
      startTransition(async () => {
        const res = await confirmMenuRecipesAction(next);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setMessage(
          `${res.createdDishes} fiche(s) produit + ${res.createdIngredients} référence(s) créées. Ajustez ensuite les stocks / seuils.`
        );
        setDishes(null);
        setPaste("");
        router.refresh();
      });
    } else {
      setMessage("Quantités corrigées — vous pouvez créer les fiches produit.");
    }
  };

  const applyAutoSuggestions = () => {
    setFixDraft((prev) => {
      const next = { ...prev };
      for (const m of missingQty) {
        const sug = suggestFuzzyQty(m.stockUnit, m.unit);
        next[fuzzyKey(m)] = {
          quantity: String(sug.quantity),
          unit: sug.unit,
        };
      }
      return next;
    });
  };

  const confirmRecipes = () => {
    if (!dishes?.length) return;
    if (missingQty.length > 0) {
      const dishNames = [...new Set(missingQty.map((m) => m.product))];
      setError(
        `${missingQty.length} quantité(s) floue(s) dans ${dishNames.length} produit(s) : ${dishNames
          .slice(0, 4)
          .join(", ")}${dishNames.length > 4 ? "…" : ""}. Corrigez-les dans la fenêtre.`
      );
      openFixModal(missingQty);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await confirmMenuRecipesAction(dishes);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(
        `${res.createdDishes} fiche(s) produit + ${res.createdIngredients} référence(s) créées. Ajustez ensuite les stocks / seuils.`
      );
      setDishes(null);
      setPaste("");
      router.refresh();
    });
  };

  const saveManual = () => {
    setError(null);
    setMessage(null);
    const items = rows
      .map((r) => {
        const name = r.name.trim();
        if (!name) return null;
        const stock = toStorageQty(
          Number(r.stockTheoretical) || 0,
          r.displayUnit
        );
        const seuil = toStorageQty(
          Number(r.criticalThreshold) || 0,
          r.displayUnit
        );
        const reorder = toStorageQty(Number(r.reorderQty) || 0, r.displayUnit);
        return {
          name,
          unit: r.unit,
          stockTheoretical: stock,
          criticalThreshold: seuil,
          reorderQty: reorder > 0 ? reorder : Math.max(seuil * 2, 1),
        };
      })
      .filter(Boolean) as {
      name: string;
      unit: StorageUnit;
      stockTheoretical: number;
      criticalThreshold: number;
      reorderQty: number;
    }[];

    if (!items.length) {
      setError("Ajoutez au moins un nom de produit.");
      return;
    }

    startTransition(async () => {
      const res = await createIngredientsBulkAction(items);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(
        `${res.created} produit(s) ajouté(s)${
          res.skipped ? ` · ${res.skipped} déjà existant(s)` : ""
        }.`
      );
      setRows([emptyRow()]);
      router.refresh();
    });
  };

  return (
    <div className={`catalog-import catalog-import--${mode}`}>
      {mode === "hero" ? (
        <header className="catalog-import__hero">
          <p className="catalog-import__eyebrow">Stock</p>
          <h3 className="catalog-import__title">
            Remplissez le catalogue
            <span>Un fichier ou une photo suffit — vous validez ensuite.</span>
          </h3>
        </header>
      ) : (
        <header className="catalog-import__hero catalog-import__hero--compact">
          <p className="catalog-import__eyebrow">Ajouter</p>
          <h3 className="catalog-import__title">
            Importer d’autres produits
          </h3>
        </header>
      )}

      <div
        className={`catalog-import__action${dragOver ? " is-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onDropFile(file);
        }}
      >
        <div className="catalog-import__action-copy">
          <p className="catalog-import__kicker">À faire maintenant</p>
          <p className="catalog-import__action-title">
            {pending ? "Analyse en cours…" : "Déposez fichier ou photo"}
          </p>
          <p className="catalog-import__action-body">
            PDF, JPG, PNG ou texte — l’IA propose, vous corrigez.
          </p>
        </div>
        <label className="catalog-import__file">
          Choisir un fichier
          <input
            type="file"
            accept=".csv,.tsv,.txt,.pdf,.md,image/*,text/*,text/csv,text/plain,application/pdf"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onDropFile(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <div className="catalog-import__secondaries">
        <div className="cat-add">
          <p className="cat-add__title">Coller une liste</p>
          <textarea
            className={`${inputClass} cat-add__paste`}
            rows={4}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={"Lait 12\nPain 8\nŒufs x6 2,50€"}
            aria-label="Coller une liste de produits"
          />
          <button
            type="button"
            className="btn-lime"
            disabled={pending || !paste.trim()}
            onClick={runPaste}
          >
            {pending ? "Analyse…" : "Analyser"}
          </button>
        </div>

        <div className="cat-add">
          <p className="cat-add__title">Un produit</p>
          {rows.map((row) => (
            <div key={row.key} className="cat-add__row">
              <input
                className={inputClass}
                value={row.name}
                placeholder="Nom — ex. Lait"
                aria-label="Nom du produit"
                onChange={(e) => onNameChange(row.key, e.target.value)}
              />
              <input
                type="number"
                step="any"
                className={inputClass}
                value={row.stockTheoretical}
                placeholder="Qté"
                aria-label="Quantité en stock"
                onChange={(e) =>
                  updateRow(row.key, { stockTheoretical: e.target.value })
                }
              />
              <div className="cat-add__units" role="group" aria-label="Unité">
                {(["pcs", "g", "ml"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    className={row.displayUnit === u ? "is-on" : ""}
                    onClick={() =>
                      updateRow(row.key, {
                        displayUnit: u,
                        unit: u,
                      })
                    }
                  >
                    {u === "pcs" ? "pièces" : u}
                  </button>
                ))}
              </div>
              {rows.length > 1 ? (
                <button
                  type="button"
                  className="cat-add__remove"
                  onClick={() =>
                    setRows((prev) => prev.filter((r) => r.key !== row.key))
                  }
                >
                  Retirer
                </button>
              ) : null}
            </div>
          ))}
          <div className="catalog-import__preview-actions">
            <button
              type="button"
              className="pill-btn pill-btn--ghost"
              onClick={() => setRows((prev) => [...prev, emptyRow()])}
            >
              + Autre
            </button>
            <button
              type="button"
              className="btn-lime"
              disabled={pending}
              onClick={saveManual}
            >
              {pending ? "…" : "Ajouter au stock"}
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="flash flash-warn">{error}</p> : null}
      {message ? <p className="flash">{message}</p> : null}

      {dishes && stats ? (
        <div className="catalog-import__preview">
          <p className="catalog-import__eyebrow">Aperçu</p>
          <p className="catalog-import__preview-title">Prêt à importer</p>
          <p className="catalog-import__lead">
            {stats.dishes} produits · {stats.ingredients} références uniques ·{" "}
            {stats.lines} lignes catalogue
            {missingQty.length
              ? ` · ${missingQty.length} quantité(s) à préciser`
              : ""}
          </p>

          {missingQty.length > 0 ? (
            <div className="flash flash-warn mt-3 space-y-2">
              <p className="m-0">
                <strong>
                  {missingQty.length} quantité(s) floue(s)
                </strong>{" "}
                dans {fuzzyByDish.length} produit(s) :
              </p>
              <ul className="m-0 pl-4 text-[13px]">
                {fuzzyByDish.slice(0, 8).map(([dish, items]) => (
                  <li key={dish}>
                    <strong>{dish}</strong> —{" "}
                    {items
                      .map((i) => `${i.stockUnit} (${i.reason})`)
                      .join(", ")}
                  </li>
                ))}
                {fuzzyByDish.length > 8 ? (
                  <li>… et {fuzzyByDish.length - 8} autre(s) produit(s)</li>
                ) : null}
              </ul>
              <button
                type="button"
                className="btn-lime btn-lime--sm"
                onClick={() => openFixModal()}
              >
                Corriger maintenant
              </button>
            </div>
          ) : null}

          <div className="recipe-import-list">
            {dishes.slice(0, 40).map((d, di) => (
              <details key={`${d.name}-${di}`} className="recipe-import-dish">
                <summary>
                  <strong>{d.name}</strong>
                  <span>
                    {d.salePrice.toFixed(2).replace(".", ",")} € ·{" "}
                    {d.ingredients.length} ing.
                    {d.ingredients.some(isFuzzyIng) ? " · ⚠ flou" : ""}
                  </span>
                </summary>
                <ul>
                  {d.ingredients.map((ing, ii) => (
                    <li key={`${ing.name}-${ii}`}>
                      <span>
                        {ing.name}
                        {isFuzzyIng(ing) ? (
                          <em className="opacity-70"> · {fuzzyReason(ing)}</em>
                        ) : null}
                      </span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className={inputClass}
                        style={{ maxWidth: 90 }}
                        value={ing.quantity || ""}
                        onChange={(e) =>
                          updateDishIng(di, ii, {
                            quantity: Number(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="opacity-70">{ing.unit}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            {dishes.length > 40 ? (
              <p className="text-[13px] opacity-70">
                + {dishes.length - 40} autres produits dans l’import…
              </p>
            ) : null}
          </div>

          <div className="catalog-import__preview-actions">
            <button
              type="button"
              className="btn-lime"
              disabled={pending}
              onClick={confirmRecipes}
            >
              {pending
                ? "Création…"
                : `Créer ${stats.dishes} produits + stock`}
            </button>
            {missingQty.length > 0 ? (
              <button
                type="button"
                className="pill-btn pill-btn--ghost"
                onClick={() => openFixModal()}
              >
                Corriger les flous
              </button>
            ) : null}
            <button
              type="button"
              className="pill-btn pill-btn--ghost"
              onClick={() => setDishes(null)}
            >
              Annuler l’aperçu
            </button>
          </div>
        </div>
      ) : null}

      {fixOpen && missingQty.length > 0 ? (
        <div
          className="menu-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fuzzy-fix-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFixOpen(false);
          }}
        >
          <div className="menu-modal dish-modal">
            <div className="menu-modal__head">
              <h2 id="fuzzy-fix-title">
                Corriger {missingQty.length} quantité(s) floue(s)
              </h2>
              <button
                type="button"
                className="menu-modal__close"
                onClick={() => setFixOpen(false)}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            <p className="menu-modal__hint">
              Ces lignes étaient « portion / au choix » ou sans grammage.
              Ajustez, ou appliquez les suggestions auto (1 portion = 1 unité
              produit).
            </p>

            <div className="fuzzy-fix-list">
              {fuzzyByDish.map(([dish, items]) => (
                <section key={dish} className="fuzzy-fix-dish">
                  <h3>{dish}</h3>
                  <ul>
                    {items.map((m) => {
                      const key = fuzzyKey(m);
                      const draft = fixDraft[key] || {
                        quantity: String(m.quantity || ""),
                        unit: m.unit,
                      };
                      return (
                        <li key={key}>
                          <div className="fuzzy-fix-row">
                            <div>
                              <strong>{m.stockUnit}</strong>
                              <span className="fuzzy-fix-reason">
                                {m.reason}
                              </span>
                            </div>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              className={inputClass}
                              value={draft.quantity}
                              onChange={(e) =>
                                setFixDraft((prev) => ({
                                  ...prev,
                                  [key]: {
                                    ...draft,
                                    quantity: e.target.value,
                                  },
                                }))
                              }
                            />
                            <select
                              className={inputClass}
                              value={draft.unit}
                              onChange={(e) =>
                                setFixDraft((prev) => ({
                                  ...prev,
                                  [key]: {
                                    ...draft,
                                    unit: e.target.value as "g" | "ml" | "pcs",
                                  },
                                }))
                              }
                            >
                              <option value="g">g</option>
                              <option value="ml">ml</option>
                              <option value="pcs">unités</option>
                            </select>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>

            <div className="menu-modal__actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={applyAutoSuggestions}
              >
                Suggestions auto
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => applyFixDraft(false)}
              >
                Enregistrer les corrections
              </button>
              <button
                type="button"
                className="btn-lime"
                disabled={pending}
                onClick={() => applyFixDraft(true)}
              >
                {pending ? "Création…" : "Corriger et créer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
