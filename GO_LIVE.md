# Go-live — checklist audit Margin Shop

## Audit code (2026-08-03) — OK côté repo
- [x] Prisma `postgresql` + champs Stripe / `active`
- [x] Demo-login gated (`DEMO_AUTO_LOGIN`) ; formulaire login prod
- [x] Stripe checkout / webhook / portal + CTA `/signup?plan=`
- [x] Admin liste Ops + fiche `/admin/stores/[id]`
- [x] Onboarding court Plan → Équipe → Produits → WA → Récap
- [x] Courses « Marquer comme fait » → `recordReceipt` / stock
- [x] `DEPLOY.md` + `.env.example` + `db:seed:admin`

## Infra (à cocher sur Vercel / Supabase)
- [ ] Projet Supabase + `DATABASE_URL` (pooler) + `DIRECT_URL` sur Vercel
- [ ] `npx prisma db push` sur Supabase
- [ ] `npm run db:seed:admin` (compte Ops)
- [ ] `NEXTAUTH_URL` = URL prod
- [ ] `NEXTAUTH_SECRET` fort
- [ ] `DEMO_AUTO_LOGIN` **absent** ou `0` en prod
- [ ] `ADMIN_EMAILS` = votre email
- [ ] Domaine custom branché (optionnel)

## Stripe
- [ ] 4 prices créés (Commerce/Franchise × mois/an)
- [ ] Env `STRIPE_*` sur Vercel
- [ ] Webhook `/api/stripe/webhook` (checkout + subscription events)
- [ ] Test carte `4242…` → magasin `stripeStatus=active`

## Parcours commerçant (self-serve)
- [ ] `/welcome` → Choisir plan → `/signup`
- [ ] Création compte → Checkout (si Stripe) ou `/login`
- [ ] Login formulaire email/mdp
- [ ] Onboarding : Plan → Équipe → Produits → WA → Récap
- [ ] Accueil : Première heure actionnable
- [ ] Stock : niveaux, préparer/envoyer liste
- [ ] Courses : liste → **Marquer comme fait** → stock remonte
- [ ] Équipe : pointer + planning
- [ ] Caisse : créer lien webhook, secrets derrière détails

## Parcours Ops (vous pour le client)
- [ ] `/admin` liste (plan, Stripe, WA, caisse, onboarding)
- [ ] Créer magasin + « Je configure »
- [ ] Fiche `/admin/stores/[id]` : identité, plan, WA, mdp, caisse, équipe, delete
- [ ] Skip onboarding si vous livrez clé en main

## Sécurité
- [ ] Pas d’auto-login démo en prod
- [ ] Secrets hors git
- [ ] Webhook Stripe vérifié (`STRIPE_WEBHOOK_SECRET`)

Voir aussi [DEPLOY.md](./DEPLOY.md).
