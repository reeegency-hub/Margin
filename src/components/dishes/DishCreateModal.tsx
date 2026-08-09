"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field, inputClass } from "@/components/ui";
import { createDish } from "@/app/actions";

const ALLERGENS = [
  "Gluten",
  "Crustacés",
  "Œufs",
  "Poisson",
  "Arachides",
  "Soja",
  "Lait",
  "Fruits à coque",
  "Céleri",
  "Moutarde",
  "Sésame",
  "Sulfites",
  "Lupin",
  "Mollusques",
] as const;

type IngredientOption = { id: string; name: string; unit: string };

type ProductRow = {
  mode: "existing" | "new";
  stockUnitId: string;
  newName: string;
  quantity: string;
  unit: string;
};

const emptyRow = (): ProductRow => ({
  mode: "existing",
  stockUnitId: "",
  newName: "",
  quantity: "",
  unit: "g",
});

export function DishCreateModal({
  ingredients,
  variant = "card",
}: {
  ingredients: IngredientOption[];
  /** card = bloc marketing · button = CTA seul (tête de liste) */
  variant?: "card" | "button";
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [externalSku, setExternalSku] = useState("");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<ProductRow[]>([emptyRow()]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ingredientById = useMemo(
    () => new Map(ingredients.map((i) => [i.id, i])),
    [ingredients]
  );

  const reset = useCallback(() => {
    setName("");
    setSalePrice("");
    setExternalSku("");
    setDescription("");
    setRows([emptyRow()]);
    setAllergens([]);
    setPreview(null);
    setImageFile(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const close = useCallback(() => {
    if (pending) return;
    setOpen(false);
    reset();
  }, [pending, reset]);

  const onImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  }, []);

  const toggleAllergen = useCallback((label: string) => {
    setAllergens((prev) =>
      prev.includes(label) ? prev.filter((a) => a !== label) : [...prev, label]
    );
  }, []);

  const submit = useCallback(() => {
    setError(null);
    if (!name.trim()) {
      setError("Indiquez le nom du produit.");
      return;
    }
    if (!description.trim()) {
      setError("Ajoutez un descriptif du produit.");
      return;
    }
    const valid = rows.some(
      (r) =>
        Number(r.quantity) > 0 &&
        (r.mode === "existing" ? r.stockUnitId : r.newName.trim())
    );
    if (!valid) {
      setError("Ajoutez au moins un produit avec sa quantité.");
      return;
    }

    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("salePrice", salePrice || "0");
    fd.set("externalSku", externalSku.trim());
    fd.set("description", description.trim());
    fd.set("allergens", allergens.join(", "));
    if (imageFile) fd.set("image", imageFile);

    for (const row of rows) {
      fd.append(
        "stockUnitId",
        row.mode === "existing" ? row.stockUnitId : ""
      );
      fd.append("newIngredientName", row.mode === "new" ? row.newName : "");
      fd.append("quantity", row.quantity);
      fd.append(
        "unit",
        row.mode === "existing" && row.stockUnitId
          ? ingredientById.get(row.stockUnitId)?.unit || row.unit
          : row.unit
      );
    }

    startTransition(async () => {
      const res = await createDish(fd);
      if (!res?.ok) {
        setError(res?.error || "Création impossible.");
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    });
  }, [
    allergens,
    description,
    externalSku,
    imageFile,
    ingredientById,
    name,
    reset,
    rows,
    router,
    salePrice,
  ]);

  return (
    <>
      {variant === "button" ? (
        <button type="button" className="btn-lime" onClick={() => setOpen(true)}>
          Nouvelle fiche
        </button>
      ) : (
        <div className="dash-card dash-card--dark flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[15px] font-semibold text-[var(--text-primary-dark)]">
              Nouvelle fiche produit
            </p>
            <p className="mt-1 text-[13px] text-[var(--text-secondary-dark)]">
              Image, descriptif, stock lié, quantité et allergènes — en une seule
              étape.
            </p>
          </div>
          <button type="button" className="btn-lime" onClick={() => setOpen(true)}>
            Créer une fiche
          </button>
        </div>
      )}

      {open ? (
        <div
          className="menu-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dish-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="menu-modal dish-modal">
            <div className="menu-modal__head">
              <h2 id="dish-modal-title">Créer une fiche</h2>
              <button
                type="button"
                className="menu-modal__close"
                onClick={close}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            <p className="menu-modal__hint">
              Remplissez la fiche complète. Les nouveaux produits seront ajoutés
              au stock automatiquement.
            </p>

            <div className="dish-modal__grid">
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={onImage}
                />
                <button
                  type="button"
                  className="menu-attach-btn dish-image-btn"
                  onClick={() => fileRef.current?.click()}
                  disabled={pending}
                >
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="" className="dish-image-preview" />
                  ) : (
                    <>
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        aria-hidden
                      >
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <circle cx="8.5" cy="10" r="1.5" />
                        <path d="M21 15l-5-5L5 19" />
                      </svg>
                      <span>Ajouter une image</span>
                      <small>JPG, PNG ou WEBP · max 5 Mo</small>
                    </>
                  )}
                </button>
                {preview ? (
                  <button
                    type="button"
                    className="mt-2 text-[12px] text-[var(--accent-lime)]"
                    onClick={() => {
                      setPreview(null);
                      setImageFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  >
                    Retirer l’image
                  </button>
                ) : null}
              </div>

              <div className="space-y-3">
                <Field label="Nom du produit">
                  <input
                    className={inputClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex. Lait demi-écrémé 1L"
                    required
                  />
                </Field>
                <Field label="Prix de vente (€)">
                  <input
                    className={inputClass}
                    type="number"
                    step="0.01"
                    min="0"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="14.50"
                  />
                </Field>
                <Field label="SKU caisse (optionnel)">
                  <input
                    className={inputClass}
                    value={externalSku}
                    onChange={(e) => setExternalSku(e.target.value)}
                    placeholder="Ex. LAIT1L / code-barres"
                  />
                </Field>
              </div>
            </div>

            <div className="mt-4">
              <Field label="Descriptif du produit">
                <textarea
                  className={`${inputClass} min-h-[100px]`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez le produit, le conditionnement, la marque…"
                />
              </Field>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-[12px] font-medium text-[var(--text-secondary-dark)]">
                Produits utilisés & quantités
              </p>
              <div className="space-y-3">
                {rows.map((row, idx) => (
                  <div
                    key={idx}
                    className="rounded-[14px] border border-[var(--border-dark)] bg-[var(--pill-neutral)] p-3"
                  >
                    <div className="mb-2 flex gap-2">
                      <button
                        type="button"
                        className={`dish-mode-chip ${
                          row.mode === "existing" ? "dish-mode-chip--on" : ""
                        }`}
                        onClick={() => {
                          const next = [...rows];
                          next[idx] = { ...next[idx], mode: "existing" };
                          setRows(next);
                        }}
                      >
                        Stock
                      </button>
                      <button
                        type="button"
                        className={`dish-mode-chip ${
                          row.mode === "new" ? "dish-mode-chip--on" : ""
                        }`}
                        onClick={() => {
                          const next = [...rows];
                          next[idx] = { ...next[idx], mode: "new" };
                          setRows(next);
                        }}
                      >
                        Nouveau
                      </button>
                      {rows.length > 1 ? (
                        <button
                          type="button"
                          className="ml-auto text-[12px] text-[var(--text-secondary-dark)]"
                          onClick={() =>
                            setRows(rows.filter((_, i) => i !== idx))
                          }
                        >
                          Retirer
                        </button>
                      ) : null}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_90px_80px]">
                      {row.mode === "existing" ? (
                        <select
                          className={inputClass}
                          value={row.stockUnitId}
                          onChange={(e) => {
                            const id = e.target.value;
                            const next = [...rows];
                            next[idx] = {
                              ...next[idx],
                              stockUnitId: id,
                              unit: ingredientById.get(id)?.unit || "g",
                            };
                            setRows(next);
                          }}
                        >
                          <option value="">Choisir un produit…</option>
                          {ingredients.map((ing) => (
                            <option key={ing.id} value={ing.id}>
                              {ing.name} ({ing.unit})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className={inputClass}
                          placeholder="Nom du nouveau produit"
                          value={row.newName}
                          onChange={(e) => {
                            const next = [...rows];
                            next[idx] = {
                              ...next[idx],
                              newName: e.target.value,
                            };
                            setRows(next);
                          }}
                        />
                      )}
                      <input
                        className={inputClass}
                        type="number"
                        step="any"
                        min="0"
                        placeholder="Qté"
                        value={row.quantity}
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx] = {
                            ...next[idx],
                            quantity: e.target.value,
                          };
                          setRows(next);
                        }}
                      />
                      <select
                        className={inputClass}
                        value={
                          row.mode === "existing" && row.stockUnitId
                            ? ingredientById.get(row.stockUnitId)?.unit ||
                              row.unit
                            : row.unit
                        }
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx] = { ...next[idx], unit: e.target.value };
                          setRows(next);
                        }}
                        disabled={row.mode === "existing" && !!row.stockUnitId}
                      >
                        <option value="g">g</option>
                        <option value="ml">ml</option>
                        <option value="pcs">pcs</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn-ghost btn-ghost--sm mt-3"
                onClick={() => setRows([...rows, emptyRow()])}
              >
                + Ajouter un produit
              </button>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-[12px] font-medium text-[var(--text-secondary-dark)]">
                Allergènes
              </p>
              <div className="flex flex-wrap gap-2">
                {ALLERGENS.map((a) => {
                  const on = allergens.includes(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      className={`dish-allergen ${on ? "dish-allergen--on" : ""}`}
                      onClick={() => toggleAllergen(a)}
                    >
                      {a}
                    </button>
                  );
                })}
              </div>
            </div>

            {error ? <p className="flash flash-warn mt-4">{error}</p> : null}

            <div className="menu-modal__actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={close}
                disabled={pending}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn-lime"
                onClick={submit}
                disabled={pending}
              >
                {pending ? "Création…" : "Enregistrer la fiche"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
