# Infra matin — Margin Shop (pilote 1 client)

## Déjà fait (agent)
- [x] Projet Vercel créé : **margin-shop** (team `reeegency-1970s-projects`)
- [x] Lien local `.vercel/`
- [x] Secrets générés dans `.env.production.local` (gitignored)
- [x] Secrets poussés sur Vercel (sauf DB / Twilio / Stripe / URL)
- [x] Crons déjà dans `vercel.json` (stock-alerts, pos-process, pos-recon, stripe-sync)
- [x] Scripts : `scripts/gen-prod-secrets.sh`, `scripts/switch-db-provider.sh`

## Action humaine requise (2 clics)

### 1) Accepter Neon (Postgres) — bloque le reste
Ouvre et accepte les conditions :

https://vercel.com/reeegency-1970s-projects/~/integrations/accept-terms/neon?source=cli

Puis dis « Neon OK » (ou relance) pour que l’agent fasse :
```bash
npx vercel integration add neon --environment production --environment preview
bash scripts/switch-db-provider.sh postgresql
npx prisma db push
npx vercel --prod
```

### 2) Twilio + Stripe (consoles externes)
Coller dans Vercel → Project → Settings → Environment Variables :
- `TWILIO_*` + templates `HX…`
- `STRIPE_*`
- Puis `NEXTAUTH_URL` / `WEBHOOK_BASE_URL` = URL prod après 1er deploy

## Après Neon + 1er deploy
1. `npm run db:seed:admin` avec `DATABASE_URL` / `DIRECT_URL` Neon
2. Créer le magasin client via `/admin`
3. Webhook Stripe → `https://URL/api/stripe/webhook`
4. Twilio status → `https://URL/api/webhooks/twilio/status`
