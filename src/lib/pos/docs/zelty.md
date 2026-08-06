# Zelty — connecteur pilote Margin

> Vue multi-caisse : [overview.md](./overview.md)

## Auth Margin (webhook)

- URL : `POST /api/webhooks/pos/{connectionId}`
- Secret : header `x-webhook-secret` **ou** champ JSON `secret`
- Pas de signature HMAC Zelty en V1 (secret partagé Margin)

## Auth Zelty API (pull nuit)

- Clé marketplace Zelty stockée chiffrée (`apiKeyEncrypted`) sur `/kiosks`
- Header : `Authorization: Bearer <clé>`
- Base : `ZELTY_API_BASE` (défaut `https://api.zelty.fr/2.0`)
- Path : `ZELTY_ORDERS_PATH` (défaut `/orders`)
- Cron : `GET /api/cron/pos-recon` (05:15 UTC via Vercel)

## Payload attendu (formes acceptées)

```json
{
  "order": {
    "id": "12345",
    "created_at": "2026-08-04T12:00:00Z",
    "dishs": [
      { "id": "sku-1", "name": "Croissant", "quantity": 2, "price": 1.2 }
    ]
  }
}
```

### Annulation / void

```json
{
  "event": "order.cancelled",
  "order": { "id": "12345", "status": "cancelled" }
}
```

Alias cancel : `cancelled` | `canceled` | `void` | `refund` | `annul` (event/type/action/status).

Alias supportés (vente) :
- `order.dishs` | `order.dishes` | `order.items` | `items` (racine)
- ID commande : `order.id` | `order.order_id` | `id` | `order_id`
- Date : `created_at` | `date` | `ordered_at` | `closed_at`

## Garanties de livraison (Zelty → Margin)

| Garantie | Valeur |
|---|---|
| Au moins une fois | **oui** (retries possibles) |
| Exactement une fois | **non** — Margin déduplique via `PosWebhookEvent.externalEventId` |
| Ordre garanti | **non** — CANCEL sans SALE → `DEFERRED` puis retry |

## Idempotence Margin

1. `externalEventId` = ID commande Zelty ; CANCEL → `cancel:{id}`
2. Unique `(restaurantId, connectionId, externalEventId)`
3. Retry POS → `200 { duplicate: true }` sans second décrément stock
4. Barrière 2 : `Sale @@unique(restaurantId, externalOrderId)`
5. Void : restaure stock (`VOID_SALE`) + `channel = pos_cancelled`

## Order-gate (P2)

- **SALE** : toujours appliquée (idempotente), même tardive
- **CANCEL** sans vente connue : `DEFERRED` (45 s × jusqu’à 12) puis `DEAD` + Slack
- Processor traite `SALE` avant `CANCEL` dans le même batch

## Réconciliation (P3 / P4)

| Kind | Contenu |
|---|---|
| `internal` | Events 24 h, stock négatif, pending > 7 j |
| `zelty_pull` | Tickets J-1 vs `Sale` ; backfill manquants ; alerte si ≥ 3 manquants ou écart CA > 5 % |

Table : `PosReconciliationRun` · widget Admin « Réconciliation nuit »

## Réponses HTTP

| Code | Cas |
|---|---|
| 200 | Appliqué, duplicate ou deferred (cancel en attente) |
| 401 | Secret invalide |
| 422 | Schéma canon invalide (`SCHEMA:…`) |
| 400 | Aucune ligne après parse/match (vente) |
