"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProposedDish } from "@/lib/menu-ai";
import { Field, inputClass } from "@/components/ui";
import { FeatureSection } from "@/components/ui/FeatureSection";
import {
  analyzeMenuAction,
  uploadMenuFileAction,
  confirmMenuRecipesAction,
  validateMenuDraftAction,
} from "@/app/actions";
import { CatalogValidationSummary } from "@/components/catalog/CatalogValidationSummary";
import type { CatalogValidationReport } from "@/lib/catalog/validate";

const SAMPLE = `Crèmerie
Lait demi-écrémé 1L 1,20€
Œufs x6 2,50€

Épicerie
Pain 1,00€
Farine 1kg 1,80€
Café moulu 250g 3,50€

Entretien
Lessive 1,5L 6,90€`;

type Step = "overview" | "review" | "done";

export function MenuAiWorkflow({
  dishCount,
  existingIngredientNames,
  autoOpen = false,
  openaiConfigured = false,
}: {
  ingredientCount: number;
  dishCount: number;
  existingIngredientNames: string[];
  autoOpen?: boolean;
  openaiConfigured?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("overview");
  const [modalOpen, setModalOpen] = useState(false);
  const [menuText, setMenuText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dishes, setDishes] = useState<ProposedDish[]>([]);
  const [validation, setValidation] = useState<CatalogValidationReport | null>(
    null
  );
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [engine, setEngine] = useState<"openai" | "local" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [openaiWarning, setOpenaiWarning] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!autoOpen || dishCount !== 0) return;
    // Import carte = desktop only
    if (
      typeof window !== "undefined" &&
      (window.matchMedia("(max-width: 767px)").matches ||
        document.querySelector(".app-shell--force-mobile"))
    ) {
      return;
    }
    setModalOpen(true);
  }, [autoOpen, dishCount]);

  const selected = dishes[selectedIdx] ?? dishes[0];

  const closeModal = useCallback(() => {
    if (pending) return;
    setModalOpen(false);
    setError(null);
  }, [pending]);

  const runAnalyzeText = useCallback((text: string) => {
    setError(null);
    setOpenaiWarning(null);
    startTransition(async () => {
      const res = await analyzeMenuAction(text);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDishes(res.dishes);
      setValidation(res.validation);
      setEngine(res.engine);
      setOpenaiWarning(res.openaiError ?? null);
      setSelectedIdx(0);
      setModalOpen(false);
      setStep("review");
    });
  }, []);

  const onAnalyzePaste = useCallback(() => {
    if (!menuText.trim()) {
      setError("Collez d’abord le texte de votre catalogue.");
      return;
    }
    runAnalyzeText(menuText);
  }, [menuText, runAnalyzeText]);

  const ingestFile = useCallback((file: File) => {
    setError(null);
    setOpenaiWarning(null);
    setFileName(file.name);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadMenuFileAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMenuText(res.extractedText);
      setDishes(res.dishes);
      setValidation(res.validation);
      setEngine(res.engine);
      setOpenaiWarning(res.openaiError ?? null);
      setSelectedIdx(0);
      setModalOpen(false);
      setStep("review");
    });
  }, []);

  const onFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) ingestFile(file);
    },
    [ingestFile]
  );

  const reAnalyzeCorrected = useCallback(() => {
    if (!menuText.trim()) {
      setError("Le texte source est vide.");
      return;
    }
    runAnalyzeText(menuText);
  }, [menuText, runAnalyzeText]);

  const updateDish = useCallback((index: number, patch: Partial<ProposedDish>) => {
    setDishes((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...patch } : d))
    );
  }, []);

  const updateIngredient = useCallback(
    (
      dishIndex: number,
      ingIndex: number,
      patch: Partial<ProposedDish["ingredients"][0]>
    ) => {
      setDishes((prev) =>
        prev.map((d, i) => {
          if (i !== dishIndex) return d;
          return {
            ...d,
            ingredients: d.ingredients.map((ing, j) =>
              j === ingIndex ? { ...ing, ...patch } : ing
            ),
          };
        })
      );
    },
    []
  );

  const removeDish = useCallback((index: number) => {
    setDishes((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setSelectedIdx((cur) => Math.min(cur, Math.max(0, next.length - 1)));
      return next;
    });
  }, []);

  const addIngredient = useCallback((dishIndex: number) => {
    setDishes((prev) =>
      prev.map((d, i) =>
        i === dishIndex
          ? {
              ...d,
              ingredients: [
                ...d.ingredients,
                { name: "", quantity: 50, unit: "g" as const, confidence: 0.5 },
              ],
            }
          : d
      )
    );
  }, []);

  const confirmAll = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const report = await validateMenuDraftAction(dishes);
      setValidation(report);
      if (report.summary.total > 0) {
        const ok = window.confirm(
          `${report.headline}\n\nValider l’import quand même ? Vous pourrez corriger dans Qualité catalogue.`
        );
        if (!ok) return;
      }
      const res = await confirmMenuRecipesAction(dishes);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(
        `${res.createdDishes} produit(s) et ${res.createdIngredients} nouvelle(s) référence(s) ajoutés.` +
          (res.openIssues
            ? ` ${res.openIssues} point(s) à revoir dans Qualité catalogue.`
            : "")
      );
      setDishes([]);
      setValidation(null);
      setStep("done");
      router.refresh();
    });
  }, [dishes, router]);

  const resetFlow = useCallback(() => {
    setStep("overview");
    setMenuText("");
    setFileName(null);
    setDishes([]);
    setEngine(null);
    setMessage(null);
    setError(null);
    setModalOpen(true);
  }, []);

  return (
    <div>
      {!openaiConfigured ? (
        <div className="dash-card dash-card--light mb-4">
          <p className="text-[14px]">
            L’analyse photo n’est pas activée. Vous pouvez coller le texte du
            menu, ou{" "}
            <a href="/settings" className="underline">
              activer l’analyse
            </a>{" "}
            dans Réglages → Avancé.
          </p>
        </div>
      ) : null}

      {openaiWarning ? (
        <div className="dash-card dash-card--light mb-4">
          <p className="text-[14px]">{openaiWarning} · fallback moteur local.</p>
        </div>
      ) : null}

      {step === "overview" || step === "done" ? (
        <div className="phone-hide catalog-import">
          <header className="catalog-import__hero">
            <p className="catalog-import__eyebrow">Catalogue</p>
            <h3 className="catalog-import__title">
              Importez votre liste de prix
              <span>Texte, PDF ou photo — l’IA propose, vous validez.</span>
            </h3>
            <p className="catalog-import__lead">
              {step === "done" && message
                ? message
                : "Ajoutez tout le catalogue en une fois. Corrigez les propositions avant d’enregistrer."}
            </p>
          </header>

          <div className="catalog-import__action">
            <div className="catalog-import__action-copy">
              <p className="catalog-import__kicker">À faire maintenant</p>
              <p className="catalog-import__action-title">
                {step === "done"
                  ? "Importer un autre catalogue"
                  : "Coller ou joindre votre liste"}
              </p>
              <p className="catalog-import__action-body">
                Zelty, Cashpad, Excel… collez le texte ou déposez un fichier.
              </p>
            </div>
            <button
              type="button"
              className="catalog-import__file"
              onClick={() => {
                setError(null);
                setModalOpen(true);
              }}
            >
              {step === "done" ? "Nouvel import" : "Ouvrir l’import"}
            </button>
          </div>
          {step === "done" ? (
            <div className="catalog-import__preview-actions">
              <a href="/ingredients?tab=qualite" className="btn-ghost">
                Ouvrir Qualité catalogue
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === "review" ? (
        <>
          {validation ? <CatalogValidationSummary report={validation} /> : null}
          <FeatureSection next title="Texte source" subtitle="Corrigez avant d’analyser si besoin." />
          <div className="dash-card dash-card--dark">
            <p className="mb-3 text-[13px] text-[var(--text-secondary-dark)]">
              Corrigez le texte brut si l’IA s’est trompée, puis relancez
              l’analyse. Ou éditez directement chaque produit ci-dessous.
              {fileName ? ` · Fichier : ${fileName}` : null}
            </p>
            <textarea
              className={`${inputClass} min-h-[140px] font-[var(--font-mono)] text-[13px]`}
              value={menuText}
              onChange={(e) => setMenuText(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-lime btn-lime--sm"
                disabled={pending}
                onClick={reAnalyzeCorrected}
              >
                {pending ? "Analyse…" : "Relancer l’analyse"}
              </button>
              <button
                type="button"
                className="btn-ghost btn-ghost--sm"
                onClick={() => setModalOpen(true)}
              >
                Recommencer (popup)
              </button>
            </div>
            {error ? <p className="flash flash-warn mt-3">{error}</p> : null}
          </div>

          <FeatureSection
            title={`Propositions à corriger (${dishes.length})`}
            subtitle="Vérifiez prix et références avant d’enregistrer le catalogue."
          />
          <div className="master-detail">
            <div className="master-detail__list">
              <div className="master-detail__list-head">
                <span className="font-semibold text-[var(--text-primary-light)]">
                  Produits détectés
                </span>
                <span className="pill pill--active">{dishes.length}</span>
              </div>
              <ul className="master-detail__rows">
                {dishes.map((dish, i) => (
                  <li key={`${dish.name}-${i}`}>
                    <button
                      type="button"
                      className={`master-detail__row ${
                        i === selectedIdx ? "master-detail__row--selected" : ""
                      }`}
                      onClick={() => setSelectedIdx(i)}
                    >
                      <span className="master-detail__row-title">
                        {dish.name || "Sans nom"}
                      </span>
                      <span className="master-detail__row-meta">
                        {dish.salePrice.toFixed(2)} € · {dish.ingredients.length}{" "}
                        ing.
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="master-detail__detail dash-card dash-card--dark">
              {selected ? (
                <>
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <p className="dash-detail-label" style={{ marginTop: 0 }}>
                      Correction du produit
                    </p>
                    <button
                      type="button"
                      className="btn-ghost btn-ghost--sm"
                      onClick={() => removeDish(selectedIdx)}
                    >
                      Retirer
                    </button>
                  </div>
                  <div className="space-y-3">
                    <Field label="Nom du produit">
                      <input
                        className={inputClass}
                        value={selected.name}
                        onChange={(e) =>
                          updateDish(selectedIdx, { name: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Prix de vente (€)">
                      <input
                        className={inputClass}
                        type="number"
                        step="0.01"
                        value={selected.salePrice}
                        onChange={(e) =>
                          updateDish(selectedIdx, {
                            salePrice: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </Field>
                  </div>
                  <p className="mb-2 mt-5 text-[13px] font-semibold">
                    Composition
                  </p>
                  <div className="space-y-2">
                    {selected.ingredients.map((ing, ii) => (
                      <div
                        key={ii}
                        className="grid gap-2 sm:grid-cols-[1fr_88px_80px]"
                      >
                        <input
                          className={inputClass}
                          placeholder="Référence stock"
                          value={ing.name}
                          list="menu-ai-existing-ingredients"
                          onChange={(e) =>
                            updateIngredient(selectedIdx, ii, {
                              name: e.target.value,
                            })
                          }
                        />
                        <input
                          className={inputClass}
                          type="number"
                          step="any"
                          value={ing.quantity}
                          onChange={(e) =>
                            updateIngredient(selectedIdx, ii, {
                              quantity: Number(e.target.value) || 0,
                            })
                          }
                        />
                        <select
                          className={inputClass}
                          value={ing.unit}
                          onChange={(e) =>
                            updateIngredient(selectedIdx, ii, {
                              unit: e.target.value as "g" | "ml" | "pcs",
                            })
                          }
                        >
                          <option value="g">g</option>
                          <option value="ml">ml</option>
                          <option value="pcs">pcs</option>
                        </select>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn-ghost btn-ghost--sm mt-3"
                    onClick={() => addIngredient(selectedIdx)}
                  >
                    + Référence
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <datalist id="menu-ai-existing-ingredients">
            {existingIngredientNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>

          <div className="dash-card dash-card--dark flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-lime"
              disabled={pending || !dishes.length}
              onClick={confirmAll}
            >
              {pending
                ? "Enregistrement…"
                : `Valider et créer ${dishes.length} fiche(s) en base`}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={resetFlow}
              disabled={pending}
            >
              Annuler
            </button>
            {error ? (
              <p className="w-full text-[13px] text-[var(--text-secondary-dark)]">
                {error}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {modalOpen ? (
        <div
          className="menu-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="menu-modal menu-modal--import">
            <header className="menu-modal__head">
              <div className="menu-modal__kicker">
                <span className="menu-modal__pill">Catalogue</span>
              </div>
              <button
                type="button"
                className="menu-modal__close"
                onClick={closeModal}
                aria-label="Fermer"
              >
                ×
              </button>
            </header>

            <div className="menu-modal__scroll">
              <h2 id="menu-modal-title" className="menu-modal__title">
                Importez votre liste de prix
              </h2>
              <p className="menu-modal__hint">
                Collez le texte, ou joignez un PDF / une photo. L’IA extrait les
                produits — vous corrigez ensuite.
              </p>

              <div
                className={`menu-modal__drop${dragOver ? " is-over" : ""}`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  if (e.currentTarget === e.target) setDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) ingestFile(file);
                }}
              >
                <p className="menu-modal__drop-kicker">À faire maintenant</p>
                <p className="menu-modal__drop-title">
                  {pending ? "Analyse en cours…" : "Déposez votre fichier"}
                </p>
                <p className="menu-modal__drop-body">
                  PDF, photo (JPG/PNG) ou TXT — une liste suffit.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,image/*,.txt,text/plain"
                  className="sr-only"
                  onChange={onFile}
                />
                <button
                  type="button"
                  className="menu-modal__drop-cta"
                  disabled={pending}
                  onClick={() => fileRef.current?.click()}
                >
                  Choisir un fichier
                </button>
                {fileName ? (
                  <p className="menu-modal__file">{fileName}</p>
                ) : null}
              </div>

              <div className="menu-modal__or" aria-hidden>
                <span>ou collez le texte</span>
              </div>

              <label className="menu-modal__paste-label" htmlFor="menu-paste">
                Liste de prix
              </label>
              <textarea
                id="menu-paste"
                className={`${inputClass} menu-modal__textarea`}
                placeholder={`Ex.\nLait 1L 1,20€\nPain 1,00€\nŒufs x6 2,50€`}
                value={menuText}
                onChange={(e) => setMenuText(e.target.value)}
                autoFocus
              />

              {error ? <p className="flash flash-warn mt-3">{error}</p> : null}
            </div>

            <footer className="menu-modal__foot">
              <button
                type="button"
                className="menu-modal__ghost"
                onClick={() => setMenuText(SAMPLE)}
                disabled={pending}
              >
                Exemple
              </button>
              <button
                type="button"
                className="menu-modal__continue"
                onClick={onAnalyzePaste}
                disabled={pending || !menuText.trim()}
              >
                {pending ? "Analyse…" : "Analyser avec l’IA"}
                {!pending ? <span aria-hidden> →</span> : null}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
