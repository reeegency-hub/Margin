# Sync caisse temps réel — mapping SKU

## Endpoint recommandé

```
POST /api/v1/webhooks/pos/{provider}?connectionId={id}
```

Providers : `zelty` | `cashpad` | `tiller` | `sumup` | `laddition` | `lightspeed` | `square` | `custom`

Legacy (équivalent) : `POST /api/webhooks/pos/{connectionId}`

## Auth

| Méthode | Headers |
|---|---|
| Secret partagé | `x-webhook-secret: <secret>` (ou `body.secret`) |
| HMAC-SHA256 | `x-pos-signature: sha256=<hex>` (body brut, clé = webhookSecret) |

Alias HMAC : `x-hub-signature-256`, `x-margin-signature`.

`401` / `403` si échec.

## Idempotence

Table `PosWebhookEvent` (`webhook_events`) :
- unique `(restaurantId, connectionId, externalEventId)`
- Retry POS → `200 { duplicate: true }` sans second décrément

## Mapping SKU strict (live)

1. Normalisation : trim, suppression espaces, **MAJUSCULES** (`normalizeSku`)
2. Match **uniquement** sur `Dish.externalSku` (unique par magasin)
3. Pas de fallback nom
4. SKU inconnu → `PosPendingProduct` + statut event `SKU_NOT_FOUND` (alerte Ops)
5. `order.cancelled` / refund → void stock (ré-incrément)

## Stock

`recordSale` / `voidSaleByExternalOrderId` en **transaction** Prisma (stock + `StockMovement`).

## Catalogue

`Dish.externalSku` : `@@unique([restaurantId, externalSku])` — un SKU = une déclinaison produit par magasin.
