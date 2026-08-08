# APIs caisse Margin — vue d’ensemble

Toutes les caisses suivent le même pipeline :

```
Webhook live ──► PosWebhookEvent ──► adapter.normalize ──► SALE / CANCEL
API pull nuit ──► compare Sale ──► backfill manquants
````

| Vendor | Webhook | Cancel | Pull API | Identifiants |
|---|---|---|---|---|
| Zelty | oui | oui | `GET {base}/orders` | Clé marketplace |
| Cashpad | oui | oui | `GET {base}/v1/tickets` | Clé API |
| Tiller / SumUp | oui | oui | SumUp transactions history | Token SumUp |
| L'Addition | oui | oui | `GET {base}/v1/tickets` | Clé API |
| Lightspeed | oui | oui | `GET …/Account/{id}/Sale.json` | Token + Account ID |
| Square | oui | oui | `POST /v2/orders/search` | Access token + Location ID |
| Custom / autre | générique | oui | base URL libre | Token + URL |
| CSV | import fichier | — | non | — |

## Config connexion (`/kiosks`)

- **Webhook** : URL + secret (toutes)
- **API pull** : clé/token (+ merchant ID si Square/Lightspeed, + base URL si custom)

## Variables d’environnement (surcharges)

| Vendor | Base | Path |
|---|---|---|
| Zelty | `ZELTY_API_BASE` | `ZELTY_ORDERS_PATH` |
| Cashpad | `CASHPAD_API_BASE` | `CASHPAD_ORDERS_PATH` |
| SumUp | `SUMUP_API_BASE` | `SUMUP_ORDERS_PATH` |
| L'Addition | `LADDITION_API_BASE` | `LADDITION_ORDERS_PATH` |
| Lightspeed | `LIGHTSPEED_API_BASE` | (+ `LIGHTSPEED_ACCOUNT_ID`) |
| Square | `SQUARE_API_BASE` | (+ `SQUARE_LOCATION_ID`, `SQUARE_API_VERSION`) |
| Custom | `CUSTOM_POS_API_BASE` | `CUSTOM_POS_ORDERS_PATH` |

## Cron

`GET /api/cron/pos-recon` — interne + pull **tous** vendors avec clé.  
`?vendor=square` pour cibler un vendor. `?skipPull=1` pour stats seules.

## Docs par vendor

- [zelty.md](./zelty.md)
- Les autres suivent le même contrat webhook + table ci-dessus ; endpoints pull exactes peuvent dépendre du contrat partenaire (surcharge via env / `apiBaseUrl`).
