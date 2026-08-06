# Qualité catalogue — import & seuils

Réduit les tickets support liés à de mauvaises données d’entrée (Excel →
Margin), et améliore la pertinence des alertes dès l’onboarding.

## 1. Validation à l’import

Après analyse menu/PDF/CSV-texte, `validateProposedCatalog` détecte :

- doublons produits / références (nom normalisé)
- unités manquantes ou incohérentes (`g` | `ml` | `pcs`)
- prix à 0 ou aberrants (&gt; 500 € ou négatif)

**Non bloquant** : résumé affiché + confirmation si anomalies avant
`confirmMenuRecipesAction`.

Fichiers : `src/lib/catalog/validate.ts`, bandeau
`CatalogValidationSummary`.

## 2. Assistant de nettoyage

Onglet **Stock → Qualité** (`/ingredients?tab=qualite`) :

| Anomalie | Action rapide |
|---|---|
| Doublon stock | Fusionner (garde la plus ancienne, bascule recettes / mouvements) |
| Unité invalide | Corriger l’unité suggérée |
| Seuil manquant + ventes | Appliquer seuil par défaut |
| Toutes | Ignorer |

Issues persistées : modèle `CatalogIssue` (`OPEN` / `RESOLVED` / `IGNORED`).

## 3. Seuils de réassort intelligents

| Source | Quand |
|---|---|
| `unit_default` | À l’import (catégorie frais / épicerie / liquide / pièce) |
| `velocity` | Après ≥ 14 j d’historique ventes — seuil ≈ 2 j de conso, réappro ≈ 7 j |
| `manual` | Dès qu’un commerçant édite le seuil |

Cron `/api/cron/stock-alerts` (heure UTC 5, ou `?thresholds=1`) :
`refreshVelocityThresholds` + `syncCatalogIssues`.

Alerte `missing_threshold` si ventes récentes sans seuil.

## 4. Santé catalogue (Ops)

`getCatalogHealth(restaurantId)` → score 0–100, grade A–D, risque.

Visible sur `/admin` (colonne Catalogue + compteur magasins à risque).

Indicateurs : % sans seuil, doublons ouverts, prix à 0, prix stale 90 j.

## Fichiers

- `src/lib/catalog/{normalize,validate,issues,thresholds,health}.ts`
- `src/components/catalog/*`
- `prisma` : `CatalogIssue`, `Ingredient.category`, `Ingredient.thresholdSource`
