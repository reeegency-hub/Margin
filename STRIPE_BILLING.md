# Billing Stripe — sync, grâce, churn

Pipeline Margin ↔ Stripe pour abonnements (Checkout + webhooks + recon).

## Principes

| Principe | Implémentation |
|---|---|
| Idempotence | `StripeWebhookEvent.stripeEventId` unique (`evt_…`) |
| Retry | Stripe rejoue si HTTP 5xx ; cron `stripe-sync` retraite `FAILED` |
| Alerte | Event `DEAD` après 8 tentatives → alerte Ops |
| Réconciliation | Cron quotidien compare API Stripe ↔ colonnes Restaurant |
| Accès | `hasAppAccess` : `active` **ou** `past_due`/`unpaid` dans la grâce |

## Délai de grâce (défaut **7 jours**)

Env : `STRIPE_GRACE_DAYS` (1–14, défaut 7).

1. `invoice.payment_failed` → `stripeStatus=past_due`, `paymentFailedAt`, `accessGraceUntil = now + N j`
2. `active` reste `true` pendant la grâce → l’app reste utilisable
3. Relance client (WhatsApp si `whatsappTo`, sinon log Ops) + lien **Billing Portal**
4. Cron : si `accessGraceUntil` dépassé → `active=false`, `churnType=involuntary`

**Cohérence Stripe Dashboard (à configurer une fois) :**

1. Settings → **Billing → Subscriptions and emails**
2. Activer **Smart Retries** (ou calendrier de retry progressif)
3. Régler l’annulation après échecs pour **≥ grâce app** (ex. 7–14 j après 1er échec)
4. Activer les emails Stripe « payment failed » (complément au WhatsApp Margin)

## Events webhook à souscrire

Endpoint : `POST /api/stripe/webhook`

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.payment_succeeded` / `invoice.paid`

## Cron

`GET /api/cron/stripe-sync` — auth `Authorization: Bearer $CRON_SECRET`

- Retry journal `FAILED` / `RECEIVED`
- Réconciliation abonnements + fin de grâce
- Vercel : quotidien 06:00 (`vercel.json`)

```bash
npm run cron:stripe
```

## Churn volontaire vs involontaire

Champ `Restaurant.churnType` + `churnedAt` :

| Valeur | Signification |
|---|---|
| `voluntary` | Résiliation client (`cancel_at_period_end`, `cancellation_requested`) |
| `involuntary` | Échec paiement non résolu / grâce expirée / `payment_failed` |
| `null` | Pas (encore) churné, ou réactivé |

Reporting Ops : widget **Billing Stripe · 30 j** sur `/admin` (`getChurnBreakdown`).

Hypothèse business 3 % churn mensuel : décomposer volontaires / involontaires pour séparer produit vs récupération facturation.

## Fichiers clés

- `src/lib/stripe/ingest.ts` — journal + apply
- `src/lib/stripe/apply.ts` — mapping statut / grâce / churn
- `src/lib/stripe/dunning.ts` — relances
- `src/lib/stripe/recon.ts` — recon + stats churn
- `src/lib/stripe/access.ts` — garde d’accès
- `src/app/api/cron/stripe-sync/route.ts`
