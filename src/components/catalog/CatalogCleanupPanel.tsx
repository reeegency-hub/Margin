"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  mergeCatalogIngredientsAction,
  fixCatalogUnitAction,
  fixCatalogThresholdAction,
  ignoreCatalogIssueAction,
  seedCatalogThresholdsAction,
  syncCatalogIssuesAction,
} from "@/app/actions";

export type CleanupIssue = {
  id: string;
  kind: string;
  title: string;
  detail: string | null;
  ingredientId: string | null;
  ingredientIdB: string | null;
  dishId: string | null;
};

const KIND_LABEL: Record<string, string> = {
  duplicate_ingredient: "Doublon",
  duplicate_dish: "Doublon fiche",
  bad_unit: "Unité",
  missing_unit: "Unité",
  missing_threshold: "Seuil manquant",
  zero_price: "Prix",
  negative_price: "Prix",
};

function kindLabel(kind: string) {
  return KIND_LABEL[kind] || kind.replace(/_/g, " ");
}

export function CatalogCleanupPanel({
  issues,
  openCount,
}: {
  issues: CleanupIssue[];
  openCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>, okMsg: string) {
    setMsg(null);
    start(async () => {
      await fn();
      setMsg(okMsg);
      router.refresh();
    });
  }

  const hasIssues = openCount > 0 || issues.length > 0;

  return (
    <div className="stock-quality">
      <header className="stock-quality__hero">
        <p className="stock-quality__eyebrow">Stock</p>
        <h2 className="stock-quality__title">
          Qualité catalogue
          <span>
            {hasIssues
              ? `${openCount || issues.length} anomalie${
                  (openCount || issues.length) > 1 ? "s" : ""
                } à traiter`
              : "Rien à corriger pour le moment"}
          </span>
        </h2>
      </header>

      <div className="stock-quality__action">
        <div className="stock-quality__action-copy">
          <p className="stock-quality__kicker">À faire maintenant</p>
          <p className="stock-quality__action-title">
            {hasIssues
              ? "Corrigez les anomalies"
              : "Rescanner le catalogue"}
          </p>
          <p className="stock-quality__action-body">
            {hasIssues
              ? "Fusionnez les doublons, corrigez les unités ou appliquez les seuils."
              : "Les seuils s’affinent après 2–3 semaines de ventes. Rescannez après un import."}
          </p>
        </div>
        <div className="stock-quality__action-ctas">
          <button
            type="button"
            className="stock-quality__cta"
            disabled={pending}
            onClick={() =>
              run(() => syncCatalogIssuesAction(), "Analyse rafraîchie.")
            }
          >
            {pending ? "…" : "Rescanner"}
          </button>
          <button
            type="button"
            className="stock-quality__cta stock-quality__cta--ghost"
            disabled={pending}
            onClick={() =>
              run(
                () => seedCatalogThresholdsAction(),
                "Seuils appliqués aux références sans seuil."
              )
            }
          >
            Seuils manquants
          </button>
        </div>
      </div>

      {msg ? <p className="flash">{msg}</p> : null}

      {issues.length === 0 ? (
        <p className="stock-quality__empty">
          Catalogue propre. Revenez après un import ou si les alertes semblent
          fausses.
        </p>
      ) : (
        <ul className="stock-quality__list">
          {issues.map((issue) => (
            <li key={issue.id} className="stock-quality__row">
              <div className="stock-quality__row-copy">
                <p className="stock-quality__kind">{kindLabel(issue.kind)}</p>
                <p className="stock-quality__row-title">{issue.title}</p>
                {issue.detail ? (
                  <p className="stock-quality__row-detail">{issue.detail}</p>
                ) : null}
              </div>
              <div className="stock-quality__row-actions">
                {issue.kind === "duplicate_ingredient" &&
                issue.ingredientId &&
                issue.ingredientIdB ? (
                  <button
                    type="button"
                    className="btn-lime"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () =>
                          mergeCatalogIngredientsAction(
                            issue.ingredientId!,
                            issue.ingredientIdB!
                          ),
                        "Références fusionnées."
                      )
                    }
                  >
                    Fusionner
                  </button>
                ) : null}
                {(issue.kind === "bad_unit" || issue.kind === "missing_unit") &&
                issue.ingredientId ? (
                  <button
                    type="button"
                    className="btn-lime"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => fixCatalogUnitAction(issue.ingredientId!),
                        "Unité corrigée."
                      )
                    }
                  >
                    Corriger
                  </button>
                ) : null}
                {issue.kind === "missing_threshold" && issue.ingredientId ? (
                  <button
                    type="button"
                    className="btn-lime"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => fixCatalogThresholdAction(issue.ingredientId!),
                        "Seuil appliqué."
                      )
                    }
                  >
                    Appliquer seuil
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => ignoreCatalogIssueAction(issue.id),
                      "Anomalie ignorée."
                    )
                  }
                >
                  Ignorer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
