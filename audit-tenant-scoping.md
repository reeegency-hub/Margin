# Audit tenant-scoping — MarginShop
Date: 2026-08-08
Scope: Chantier 1 · Étape 1.1

## Modèles Prisma (référence)

| Modèle | `restaurantId` |
|--------|----------------|
| Ingredient, Dish, Sale, StockMovement, Alert, Supplier, PurchaseOrder, SupplierReceipt, InventoryCount, Employee, Kiosk | **direct** |
| ExternalPosConnection, PosWebhookEvent, LlmProviderCredential, AssistantDraft, AssistantCommit | **direct** |
| WhatsAppSession, WhatsAppActionLog | **direct** |
| WhatsAppOutboundMessage, NewsletterSubscriber | **optional** (`String?`) |
| RecipeIngredient, SaleItem, PurchaseOrderLine, SupplierReceiptLine, InventoryCountLine, SupplierCatalogItem | **via parent** (Dish / Sale / PurchaseOrder / Receipt / InventoryCount / Supplier / Ingredient) |
| Shift, Attendance | **via Employee** |
| LlmProviderCredentialEvent | **via LlmProviderCredential** |
| *(pas de modèle `Recipe` — uniquement `RecipeIngredient`)* | — |

Convention app : `Restaurant.id` = tenant ; session via `requireSession` / `requireTenantDb` (`session.user.restaurantId` / `ctx.tenantId`).

Méthode : lecture `prisma/schema.prisma` + ripgrep `prisma.|db.|tx.` sur les modèles cibles dans `src/` (~300 appels) + revue du contexte where/data et origine du tenant.

## Statut correctifs (2026-08-08)

Chantier 1.2 appliqué : les **8 ❌** ci-dessous sont corrigés (voir git).  
Wrapper `src/lib/db/tenant-scoped.ts` + tests `src/lib/security/tenant-isolation.test.ts`.

## Synthèse (audit initial)

| Statut | Count |
|--------|------:|
| ✅ | ~250 |
| ❌ | 8 → **corrigés** |
| ⚠️ | 52 (TOCTOU / admin / webhooks — durcis partiellement) |

> Les ✅ sont regroupés par fichier (échantillon / compteurs). Les ❌ et ⚠️ sont listés exhaustivement — ils pilotent le prochain pass de correctifs.

---

## ❌ À corriger (priorité)

### `src/lib/whatsapp/batch.ts:25` — Alert
- Appel: `prisma.alert.findUnique({ where: { id: alertId } })`
- Problème: lecture alerte par id seul, sans `restaurantId` ; fonction exportée `queueStockAlertForWhatsApp(alertId)` n’exige aucun contexte tenant.
- restaurantId présent: non
- Fix suggéré: exiger `(restaurantId, alertId)` et `where: { id: alertId, restaurantId }` ; propager depuis `syncIngredientAlert`.

### `src/lib/whatsapp/batch.ts:37` — Alert
- Appel: `prisma.alert.update({ where: { id: alertId }, data: { whatsappPendingAt } })`
- Problème: mutation cross-tenant possible si `alertId` est connu / forgé (IDOR).
- restaurantId présent: non
- Fix suggéré: `updateMany({ where: { id: alertId, restaurantId }, data: … })`.

### `src/lib/stock-engine.ts:160` — Alert
- Appel: `prisma.alert.findUnique({ where: { id: alertId }, include: { restaurant, ingredient } })` dans `sendAlertWhatsApp`
- Problème: résout l’alerte (et le numéro WhatsApp du resto) par id seul ; tout appelant avec un id étranger peut déclencher un envoi pour un autre tenant. Le `updateMany` suivant (L196) reprend `alert.restaurantId` de la ligne lue — ne protège pas la lecture / l’envoi.
- restaurantId présent: non (dérivé après coup de la ligne)
- Fix suggéré: signature `(restaurantId, alertId)` + `findFirst({ where: { id, restaurantId } })` ; faire passer `session.user.restaurantId` depuis `resendAlertWhatsApp`.

### `src/lib/whatsapp-bot.ts:424` — InventoryCount
- Appel: `prisma.inventoryCount.findFirst({ where: { id: payload.inventoryId } })`
- Problème: pas de `restaurantId` alors que le flux WhatsApp a déjà un `restaurantId` fiable ; si le payload session est corrompu / manipulé, fuite de lignes d’inventaire d’un autre tenant.
- restaurantId présent: non (id issu du payload session)
- Fix suggéré: `where: { id: payload.inventoryId, restaurantId }` (même pattern que `startInventoryFlow` L365).

### `src/lib/catalog/issues.ts:282` — SupplierCatalogItem (via Ingredient)
- Appel: `tx.supplierCatalogItem.deleteMany({ where: { ingredientId: removeId } })`
- Problème: filtre uniquement par `ingredientId` (pas de jointure `supplier.restaurantId`). Après un `findFirst` scoped, le risque est faible (cuid), mais le delete n’est pas défensif multi-tenant.
- restaurantId présent: non (dépendance implicite sur l’id)
- Fix suggéré: `where: { ingredientId: removeId, supplier: { restaurantId } }` (ou supprimer via relation ingredient déjà validée).

### `src/lib/catalog/issues.ts:285` — PurchaseOrderLine
- Appel: `tx.purchaseOrderLine.updateMany({ where: { ingredientId: removeId }, data: { ingredientId: keepId } })`
- Problème: pas de filtre tenant via `order: { restaurantId }` ; même pattern non défensif que ci-dessus.
- restaurantId présent: non
- Fix suggéré: `where: { ingredientId: removeId, order: { restaurantId } }`.

### `src/lib/catalog/issues.ts:289` — InventoryCountLine
- Appel: `tx.inventoryCountLine.updateMany({ where: { ingredientId: removeId }, … })`
- Problème: idem, pas de `inventoryCount: { restaurantId }`.
- restaurantId présent: non
- Fix suggéré: `where: { ingredientId: removeId, inventoryCount: { restaurantId } }`.

### `src/app/api/stripe/checkout/route.ts:52` — Restaurant (tenant root, hors liste mais critique)
- Appel: `const restaurantId = body.restaurantId || session?.user?.restaurantId` puis `prisma.restaurant.findUnique({ where: { id: restaurantId } })`
- Problème: `restaurantId` accepté depuis le body **sans** revalidation contre la session (contrairement au portal qui gate admin). Un client authentifié peut initier un checkout Stripe pour un autre tenant.
- restaurantId présent: client-supplied (body) sans check ownership
- Fix suggéré: aligner sur `portal` — `session.user.restaurantId` sauf `isAdminEmail` + body.

---

## ⚠️ À vérifier manuellement

### Accès / mutation par id après find scoped (pattern TOCTOU)

| Fichier:ligne | Modèle | Note |
|---------------|--------|------|
| `src/app/actions.ts:407` | Alert | `update({ where: { id } })` après `findFirst` scoped session |
| `src/lib/stock-engine.ts:125` | Alert | `update` by id après `findFirst` scoped |
| `src/lib/stock-engine.ts:267–342` | Ingredient | `update` by id dans tx après dishes scoped |
| `src/lib/stock-engine.ts:356` | Sale | `update` by id après `findFirst` scoped |
| `src/lib/stock-engine.ts:419` | Ingredient | `update` by id après ingredients/supplier scoped |
| `src/lib/orders-engine.ts:240` | PurchaseOrder | `update({ where: { id: orderId } })` après findFirst scoped (préférer `updateMany` + restaurantId comme cancel) |
| `src/lib/inventory-engine.ts:69–106` | InventoryCountLine / Ingredient | update by line/ingredient id après inventaire scoped |
| `src/lib/inventory-engine.ts:123` | InventoryCount | update by id après find scoped |
| `src/lib/employee-engine.ts:159` | Shift | `delete({ where: { id: shiftId } })` après findFirst `employee.restaurantId` |
| `src/lib/employee-engine.ts:158` | Attendance | `deleteMany({ where: { shiftId } })` sans restaurantId |
| `src/lib/employee-engine.ts:174–196` | Employee | `update` by id après findFirst scoped |
| `src/lib/employee-engine.ts:356–477` | Attendance | find/update by id/shiftId ; employee issu liste scoped |
| `src/lib/employee-engine.ts:395` | Shift | `findFirst` par `employeeId` sans `employee: { restaurantId }` (employee déjà scoped) |
| `src/lib/assistant/drafts.ts:49` | AssistantDraft | `update` by id après findFirst scoped |
| `src/lib/assistant/drafts.ts:87` | AssistantDraft | `update` by id après `getAssistantDraft` scoped |
| `src/lib/assistant/commit.ts:92` | Ingredient | `update` by id depuis map d’un `findMany` scoped |
| `src/lib/cost-engine.ts:124–270` | Dish | `update` by id après findMany scoped |
| `src/lib/cost-engine.ts:169` | Ingredient | `update` by id après findFirst scoped |
| `src/lib/catalog/thresholds.ts:64–132` | Ingredient | `update` by id après findMany scoped |
| `src/lib/catalog/issues.ts:261–308` | RecipeIngredient / Ingredient | merge : ops by id après keep/remove scoped |
| `src/lib/catalog/issues.ts:336–365` | Ingredient | `update` by id après findFirst scoped |
| `src/lib/channels.ts:36` | Kiosk | `update` by id après findFirst scoped |
| `src/lib/pos/catalog.ts:71` | Dish | `update` by id après findMany restaurantId |
| `src/lib/llm/router.ts:126` | LlmProviderCredential | `update` by `credId` (issu de findFirst scoped) |
| `src/lib/llm/handleProviderError.ts:30` | LlmProviderCredential | `update` by id |
| `src/app/api/settings/llm-credentials/[provider]/route.ts:35` | LlmProviderCredential | `update` by id après findUnique `(restaurantId, provider)` |
| `src/app/actions.ts:2161` | ExternalPosConnection | admin `update` by id après findFirst `restaurantId` form |
| `src/lib/whatsapp-bot.ts:58` | WhatsAppSession | `delete` by id après findUnique composite restaurantId_phone |
| `src/lib/whatsapp/outbound.ts:212–310` | WhatsAppOutboundMessage | `update` by id après create/findUnique (twilioSid / row) |
| `src/app/actions.ts:1811–1814` | Attendance / Shift | `deleteMany` par `employeeId in stubIds` (stubs filtrés restaurantId) |

### Nested / child models sans `restaurantId` (accès par id parent)

| Fichier:ligne | Modèle | Note |
|---------------|--------|------|
| `src/lib/dashboard.ts:125` | SaleItem | `groupBy` sur `saleId in weekSaleIds` (sales déjà scoped) — OK métier, pas de restaurantId direct |
| `src/lib/cost-engine.ts:241` | SaleItem | `groupBy` avec `sale: { restaurantId }` — bien ; vérifier cohérence partout |
| `src/lib/first-hour.ts:133–154` | SupplierReceiptLine / Shift / Attendance | filtre via relation `receipt` / `employee` — OK si toujours passé |
| `src/lib/channels.ts` / engines | RecipeIngredient | accès via Dish/Ingredient scoped |

### Admin / cron cross-tenant (intentionnel ?)

| Fichier:ligne | Modèle | Note |
|---------------|--------|------|
| `src/app/(app)/admin/page.tsx:72–77` | PosWebhookEvent | `groupBy` / `findMany` sans filtre restaurant — `requireAdminSession` |
| `src/app/(app)/admin/newsletter/page.tsx:12–16` | NewsletterSubscriber | liste globale — admin |
| `src/lib/pos/health.ts:60–118` | PosWebhookEvent | agrégats globaux santé POS |
| `src/lib/whatsapp/metrics.ts:27` | WhatsAppOutboundMessage | stats globales admin |
| `src/app/api/cron/pos-process/route.ts:21` | PosWebhookEvent | `count` DEAD global (ops) |
| `src/lib/whatsapp/batch.ts:163` | Alert | `groupBy` by restaurantId pour flush cron tous tenants |
| `src/app/api/cron/stock-alerts/route.ts:41` | Ingredient | boucle tous restos actifs — OK cron |
| `src/app/actions.ts:2149+` | ExternalPosConnection / Employee | actions admin avec `restaurantId` form + `requireAdminOrRedirect` |

### Webhooks — résolution tenant via connection id

| Fichier:ligne | Modèle | Note |
|---------------|--------|------|
| `src/app/api/webhooks/pos/[connectionId]/route.ts:12` | ExternalPosConnection | `findUnique({ id })` puis secret ; tenant = `connection.restaurantId` |
| `src/app/api/webhooks/pos/[connectionId]/route.ts:94` | ExternalPosConnection | **GET** sans secret — expose name/status/vendor si id connu |
| `src/app/api/v1/webhooks/pos/[provider]/route.ts:52` | ExternalPosConnection | idem POST + auth secret/HMAC |
| `src/app/api/v1/webhooks/pos/[provider]/route.ts:133` | ExternalPosConnection | GET health-like par connectionId query — pas de secret |

### WhatsApp inbound — résolution tenant

| Fichier:ligne | Note |
|---------------|------|
| `src/lib/whatsapp-bot.ts:98–104` | `findRestaurantByPhone` charge tous les restos avec `whatsappTo` puis match téléphone — pas d’index unique sur le numéro ; collision possible entre tenants |

### Newsletter (global)

| Fichier:ligne | Note |
|---------------|------|
| `src/lib/newsletter.ts:49–160` | lookups par `email` / `unsubscribeToken` / `id` — modèle global, `restaurantId` optionnel ; OK produit si pas de données tenant sensibles dans la row |

---

## ✅ OK (échantillon représentatif / comptes par fichier)

Appels où `where` / `data` inclut clairement `restaurantId` (ou équivalent relation) dérivé session / arg serveur / cron par tenant.

| Fichier | ≈ OK | Exemples |
|---------|------:|----------|
| `src/app/actions.ts` | 18 | alertes `updateMany` + session ; inventaire findFirst ; employees ; pos updateMany |
| `src/app/actions/catalog.ts` | 10 | ingredient/dish CRUD via `requireTenantDb` + `ctx.tenantId` |
| `src/app/actions/pos.ts` | 8 | ExternalPosConnection create/find/update/delete + `ctx.tenantId` |
| `src/lib/stock-engine.ts` | 12 | syncIngredientAlert, recordSale, voidSale, recordReceipt (finds scoped) |
| `src/lib/orders-engine.ts` | 12 | supplier/PO/stockMovement avec restaurantId |
| `src/lib/inventory-engine.ts` | 4 | createDraft / findFirst inventaire + restaurantId |
| `src/lib/employee-engine.ts` | 14 | employee/shift finds avec restaurantId ou `employee.restaurantId` |
| `src/lib/dashboard.ts` | 12 | sales/ingredients/alerts/kiosks scoped |
| `src/lib/first-hour.ts` | 13 | counts scoped |
| `src/lib/pos/ingest.ts` | 14 | dishes, events, connections avec restaurantId |
| `src/lib/pos/pull-recon.ts` / `recon.ts` | 4 | connections/sales/ingredients scoped |
| `src/lib/assistant/drafts.ts` | 3 | create + findFirst + updateMany avec restaurantId |
| `src/lib/assistant/commit.ts` | 5 | ingredient/employee create + findMany scoped |
| `src/app/api/assistant/route.ts` | 3 | ingredient findMany/create + restaurantId session |
| `src/app/api/assistant/drafts/**` | — | getAssistantDraft(session.restaurantId, id) |
| `src/app/api/settings/llm-credentials/**` | 3 | findMany/upsert/findUnique composite session |
| `src/lib/llm/router.ts` | 2 | findFirst credential + restaurantId |
| `src/lib/catalog/issues.ts` | 8 | findMany/findFirst ingredient+restaurantId ; stockMovement groupBy |
| `src/lib/catalog/health.ts` / `thresholds.ts` | 8 | counts/finds scoped |
| `src/lib/cost-engine.ts` | 8 | dish/ingredient/inventory/receipts scoped |
| `src/lib/channels.ts` | 5 | kiosk/dish/sale finds + updateMany scoped |
| `src/lib/whatsapp-bot.ts` | 10 | PO/inventory/session upsert avec restaurantId |
| `src/lib/whatsapp/batch.ts` | 3 | flush findMany/updateMany + restaurantId |
| `src/lib/stock-alert-service.ts` | 2 | ingredients/alerts scoped |
| `src/app/(app)/ingredients/**` | 4 | findMany rid session |
| `src/app/(app)/inventory/**` | 3 | findFirst/findMany + session |
| `src/app/(app)/orders/page.tsx` / `page.tsx` | 2 | purchaseOrder + rid |
| `src/app/(app)/costs/page.tsx` | 4 | supplier/ingredient/receipt + create |
| `src/app/(app)/kiosks/page.tsx` | 1 | externalPosConnection |
| `src/app/api/cron/stock-alerts/route.ts` | 1 | ingredient par `r.id` |
| `src/lib/delivery-engine.ts` | 1+ | dishes + orders scoped (hors scope strict mais cohérent) |
| Autres pages / helpers | ~40 | onboarding dish.count, plan-limits, etc. |

**Total ✅ estimé : ~250** (sur ~310 appels prisma/db/tx des modèles ciblés).

---

## Notes

### Admin routes intentionally cross-tenant?
Oui — `requireAdminSession` / `requireAdminOrRedirect` sur `/admin/**`, métriques POS/WhatsApp globales, seed POS/équipe par `restaurantId` form. À documenter comme exception ; ne pas réutiliser ces helpers hors admin.

### Newsletter global (no restaurantId)?
`NewsletterSubscriber.email` est unique global ; `restaurantId` optionnel (lien soft). Admin newsletter lit tout. Ce n’est pas un isolat tenant strict — acceptable si pas de secrets tenant dans la row.

### Webhooks resolve tenant how?
1. **POS** : `ExternalPosConnection.findUnique({ id: connectionId })` → `connection.restaurantId` ; auth par `webhookSecret` / HMAC (POST). GET health expose métadonnées sans secret → à durcir (⚠️).
2. **WhatsApp inbound** : match `Restaurant.whatsappTo` ↔ From (scan multi-tenant).
3. **Twilio status** : `WhatsAppOutboundMessage` par `twilioSid` → update by row id.
4. **Stripe** : metadata / customer / subscription → `resolveRestaurantIdFromStripe` (hors modèles listés).

### RLS
`requireTenantDb` → `withTenantRls` existe, mais de nombreux chemins utilisent encore `prisma` global (pages, engines, webhooks). L’audit where/data reste nécessaire même avec RLS Postgres.

### Hors modèles listés mais critique
`src/app/api/stripe/checkout/route.ts` — `body.restaurantId` non revalidé (listé en ❌). Portal Stripe est correctement gaté admin.

---

## Priorité fix pass (recommandé)

1. **P0** — `sendAlertWhatsApp` + `queueStockAlertForWhatsApp` : imposer `restaurantId` dans tous les where.
2. **P0** — WhatsApp inventaire L424 : ajouter `restaurantId` au find.
3. **P0** — Stripe checkout : ne jamais faire confiance à `body.restaurantId` hors admin.
4. **P1** — mergeIngredients : scoper les `*Many` enfants via relation parent.restaurantId.
5. **P1** — Durcir GET webhooks POS (auth ou 404 sans secret).
6. **P2** — Remplacer les `update({ where: { id } })` post-find par `updateMany({ where: { id, restaurantId } })` (défense en profondeur).
)
