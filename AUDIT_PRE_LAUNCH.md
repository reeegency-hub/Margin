# Audit pré-lancement Margin Shop — 2026-08-04

**Verdict :** pas prêt pour self-serve public ni montée fiable à 60+ clients.  
Pilote Ops-contrôlé possible. Canvas : `marginshop-audit-prelaunch.canvas.tsx`.

### Remédiation en cours (2026-08-06)

| Cause racine | Statut |
|---|---|
| Billing soft (`active` trop tôt) | **Corrigé** — `hasAppAccess` + signup `incomplete`/`active:false` + tests |
| CRON ouvert | **Corrigé** — `assertCronAuthorized` exige `CRON_SECRET` en prod |
| RLS soft / `withTenantRls` | **Avancé** — engines stock/orders/inventory/employee + actions métier via `requireTenantDb` ; cron POS scoped RLS ; reste : channels/delivery/catalog-issues/alertes |
| CI ≠ prod | **Garde** — `npm run check:prod-env` (SQLite/CRON) branché dans `check:quick` |
| Monolithe `actions.ts` | **Partiel** — `actions/catalog.ts` + `actions/pos.ts` extraits |
| UX guide empilée | **Partiel** — dock owner ; DayFocus/tours masqués ; Keke non monté |
| `maxProducts` marketing only | **Corrigé** — `assertCanAddProducts` sur create/bulk/dish/menu import |
| DEAD POS non drainé | **Corrigé** — cron replay soft DEAD (hors `[schema]`) après 6h + test idempotence |

---

## 1. Tableau de synthèse

| Chantier | Statut réel | Écart vs demande | Gravité |
|---|---|---|---|
| Synchro caisse ↔ stock | **Partiel** | Idempotence unique OK ; CANCEL→DEFERRED OK ; **DEAD non retraité** ; recon interne ≠ delta POS (sauf pull) ; **0 test d’idempotence** | Majeur |
| Multi-tenant / RLS | **Absent en runtime** | `rls.sql` présent ; `withTenantRls` **jamais appelé** ; `set_config(..., true)` incompatible Prisma/pooler ; 4 tables récentes sans policy ; `test:tenant` = heuristique AST | **Bloquant** |
| Fiabilité service | **Partiel** | Load test **réel** 136.7 evt/s (artifact JSON) ; DRP exécuté mais **SQLite toy** (0 PosWebhookEvent) ; backups quotidiens / PITR **non activés** | Majeur |
| Stripe | **Partiel** | Journal `evt_` + grâce 7j + `hasAppAccess` + churnType branchés ; **0 test** ; dunning peut cooldowner sans notif | Majeur |
| WhatsApp | **Partiel** | Dédup cycle + batch 15 min + coût/limit + statusCallback dans le code ; templates **opt-in** ; **0 test** multi-rupture | Majeur |
| Qualité catalogue | **Implémenté (soft)** | Dirty validate → 8 anomalies ; seuils `unit_default` à l’import ; UI Qualité ; **maxProducts 200 non enforced** | Mineur → Majeur (plan) |

---

## 2. Bugs & anomalies

### P0 — Bloquant

| Problème | Où | Repro | Impact | Correction |
|---|---|---|---|---|
| RLS non effective | `src/lib/db.ts`, `prisma/rls.sql` | Déployer avec rôle postgres / SQLite : policies inertes | Fuite cross-tenant si filtre oublié | Rôle `margin_app` ; `SET LOCAL` dans `$transaction` ; appeler RLS partout |
| `withTenantRls` cassé même branché | `db.ts:30` `is_local=true` | set_config puis query suivante | Toutes les lignes filtrées à vide ou bypass | `set_config(..., false)` **dans** transaction Prisma |
| `maxProducts=200` marketing only | `plans.ts` vs `actions.ts` confirm/create | Importer 250 plats Commerce | Over-usage non facturé / support | Gate à l’écriture dish+ingredient |

### P1 — Majeur

| Problème | Où | Impact | Correction |
|---|---|---|---|
| DEAD POS non drainé par cron | `processPendingPosWebhookEvents` | Stock définitivement désync jusqu’à redelivery | Replay ops + cron DEAD sélectionné |
| Recon interne ≠ vérité caisse | `pos/recon.ts` | Fausse confiance Ops | Exiger pull ou comparer CA/order IDs |
| Dunning `return true` sans WA | `stripe/dunning.ts` | Client non prévenu, cooldown 20h | Exiger canal ; ne pas cooldowner si non délivré |
| Templates WA non forcés | `whatsapp/config.ts` | Échecs Meta hors 24h | `WHATSAPP_REQUIRE_TEMPLATES=1` + SIDs |
| `CRON_SECRET` optionnel | cron routes | Cron public si env vide | Exiger secret en prod |
| 0 tests zones critiques | package.json | Régressions silencieuses | Suite intégration POS/Stripe/WA/2-tenant |

### P2 — Mineur

| Problème | Où | Correction |
|---|---|---|
| Tables sans RLS | CatalogIssue, WA outbound, Stripe* | Étendre `rls.sql` |
| Race PROCESSING | ingest Stripe/POS | Claim atomique / FOR UPDATE |
| `POS-${Date.now()}` order id | pos ingest | Refuser events sans orderId stable |
| Prix négatif classé « zero » | validate.ts | Branche aberrant dédiée |

---

## 3. Dette technique

| Problème | Coût dans 6 mois |
|---|---|
| `actions.ts` **2275 lignes** | Conflits git permanents ; impossible de tester unitairement sans monter toute la surface |
| Retry POS / Stripe dupliqués | Bugfixé d’un côté oublié de l’autre |
| `notifyPosOpsAlert` pour billing/WA | Bruit Ops, sémantique confuse |
| `test:tenant` AST-only | Fausse assurance sécurité en CI |
| SQLite CI vs Postgres prod | RLS/pooler jamais exercés avant prod |

---

## 4. Risques non couverts (Partie 4)

| Prio | Risque | Reco |
|---|---|---|
| P0 | Backups / PITR | Activer avant self-serve |
| P0 | Limites plan non appliquées | Enforce maxProducts/maxStores |
| P1 | Timezone CH (Zurich) | QA DST + défaut timezone |
| P1 | Soft-delete / RGPD self-serve | Parcours purge + anonymisation |
| P1 | Validation formulaires / XSS | Audit inputs hors webhooks |
| P2 | Ops mauvais tenant | Confirm contextuelle hors delete |
| P2 | Import Excel .xlsx | Parser ou message clair TPE |

**Parcours :** import dirty **détecte** (prouvé : 8 anomalies). Batch WA / Stripe grâce = **code-path only**. Cross-tenant = **non prouvé runtime**. Admin delete = confirm nom OK.

---

## 5. Recommandation

**Ne pas ouvrir le self-serve public maintenant.**

**Go pilote** si : Ops provisionne, order IDs caisse stables, Slack Ops, pull recon si possible, pas de signup massif, monitoring manuel DEAD / limit_skipped / past_due.

**Avant scale 60+ :** RLS runtime réel + tests 2-tenants ; enforce plan limits ; PITR ; templates WA ; drain DEAD ; tests idempotence POS + dunning Stripe.
