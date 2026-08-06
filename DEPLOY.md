# Déploiement Margin Shop — Vercel + Supabase

> **Local (maintenant)** : SQLite (`DATABASE_URL="file:./dev.db"`) — pas besoin de Docker.
> **Prod** : basculez `provider` Prisma sur `postgresql` + `DATABASE_URL` / `DIRECT_URL` Supabase (voir §1).

## Accès local immédiat

```bash
# .env : DATABASE_URL="file:./dev.db"
npx prisma db push
npm run db:seed
DEMO_AUTO_LOGIN=1 npm run dev -- -p 3020
# → http://localhost:3020  (gerant@marginshop.app / marginshop2026)
```

## 1. Supabase (Postgres) — production

1. Créez un projet sur [supabase.com](https://supabase.com/dashboard)
2. **Project Settings → Database → Connection string**
3. Dans `prisma/schema.prisma`, remettez :

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

4. Variables :

| Variable | Où la prendre | Usage |
|---|---|---|
| `DATABASE_URL` | **Connection pooling** → mode **Transaction** (port `6543`) | App runtime (Vercel) |
| `DIRECT_URL` | **Direct connection** (port `5432`) | `prisma db push` / migrations |

```
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
```

```bash
npx prisma db push
npm run db:seed:admin
# Isolation multi-tenant (RLS) — Postgres / Supabase uniquement :
# psql "$DIRECT_URL" -f prisma/rls.sql
```

## Multi-tenant (shared schema)

- Clé : `restaurantId` (= tenant_id) — voir `src/lib/tenant.ts`
- RLS : `prisma/rls.sql` + `withTenantRls()`
- Auto-check à chaque feature : `npm run test:tenant`

## 2. Vercel

1. Importez le dépôt MarginShop
2. Framework : Next.js (détecté)
3. Build : `prisma generate && next build` (déjà dans `npm run build`)
4. Variables d’environnement (Production) :

| Variable | Obligatoire | Notes |
|---|---|---|
| `DATABASE_URL` | oui | Pooler Supabase (6543 + pgbouncer) |
| `DIRECT_URL` | oui | Connexion directe Supabase (5432) |
| `NEXTAUTH_URL` | oui | `https://votre-domaine` |
| `NEXTAUTH_SECRET` | oui | `openssl rand -base64 32` |
| `ADMIN_EMAILS` | oui | votre email ops |
| `CREDENTIALS_ENCRYPTION_KEY` | oui | 32+ chars |
| `DEMO_AUTO_LOGIN` | non | **ne pas définir** en prod (ou `0`) |
| `STRIPE_SECRET_KEY` | pour payer | `sk_test_…` puis `sk_live_…` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | pour payer | `pk_…` |
| `STRIPE_WEBHOOK_SECRET` | pour payer | `whsec_…` |
| `STRIPE_PRICE_COMMERCE_MONTHLY` | pour payer | `price_…` |
| `STRIPE_PRICE_COMMERCE_YEARLY` | pour payer | `price_…` |
| `STRIPE_PRICE_RESEAU_MONTHLY` | pour payer | `price_…` |
| `STRIPE_PRICE_RESEAU_YEARLY` | pour payer | `price_…` |
| `STRIPE_GRACE_DAYS` | non | Grâce après échec paiement (défaut `7`, max 14) |
| `WEBHOOK_BASE_URL` | webhooks | URL publique Vercel |
| `TWILIO_*` / `OPENAI_*` | optionnel | WA / import IA |
| `CRON_SECRET` | recommandé | Protège `/api/cron/*` |

## 3. Stripe

1. Dashboard → Produits : Commerce + Franchise (mensuel / annuel)
2. Copiez les 4 `price_…` dans les env Vercel
3. Webhooks → endpoint `https://votre-domaine/api/stripe/webhook`
   - Events : `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`, `invoice.paid`
4. Billing → Smart Retries + délai d’annulation ≥ `STRIPE_GRACE_DAYS` (voir [STRIPE_BILLING.md](./STRIPE_BILLING.md))
5. Test : carte `4242 4242 4242 4242` ; échec : `4000 0000 0000 0341`

```bash
stripe listen --forward-to localhost:3020/api/stripe/webhook
```

Cron billing (Vercel 06:00) : `GET /api/cron/stripe-sync`

## 4. Go-live checklist

- [ ] `DEMO_AUTO_LOGIN` absent / `0` en prod
- [ ] Login formulaire (email + mot de passe)
- [ ] `ADMIN_EMAILS` = votre compte
- [ ] Projet Supabase + `DATABASE_URL` / `DIRECT_URL` sur Vercel
- [ ] Stripe webhook live + 4 prix
- [ ] Parcours commerçant : welcome → Checkout → onboarding → Première heure
- [ ] Parcours Ops : `/admin` → créer magasin → Configurer fiche complète

## 5. Deux chemins mise en route

1. **Commerçant seul** : tarifs → Stripe → compte → onboarding → Première heure
2. **Vous pour lui** : `/admin` → Créer magasin → **Configurer** → plan, WA, caisse, skip onboarding
