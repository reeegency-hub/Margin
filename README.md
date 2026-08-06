# Margin Shop

Copilote opérationnel pour les commerces de proximité — **épiceries, primeurs, drogueries, petits marchés** : Accueil actionnable, stock, liste de courses, vérification, équipe, et livraison en option.

Principe : chaque écran répond à *« Que dois-je faire maintenant ? »*.

## Margin Shop vs Margin (resto)

Margin Shop est une **déclinaison** de Margin (le copilote pour restaurants indépendants), adaptée au petit commerce :

| | Margin (resto) | Margin Shop |
|---|---|---|
| Vocabulaire | Cuisine, plats, recettes, carte, cuisto | Rayon, réserve, produits, catalogue, vendeur |
| Équipe type | Salle, cuisine (x2), livreur | Caisse, rayon, livreur (optionnel) |
| Démo | La Fabrique du Sushi (burgers) | Épicerie du Marché (lait, tomates, pain, œufs, lessive…) |
| Livraison Uber/Deliveroo | Mise en avant (multi-canal) | Optionnelle, secondaire, désactivée par défaut |
| Fiches produit / import carte | Cœur du produit (recettes, allergènes) | Disponible mais masqué du téléphone et de la navigation principale — pas indispensable pour vendre des produits déjà unitaires |

Ce dépôt (`MarginShop`) est une copie indépendante de [`RestaurantOS`](../RestaurantOS) (le code de Margin resto). Les deux bases de code et bases de données sont totalement séparées — travailler ici ne modifie jamais `RestaurantOS`.

Sous le capot, le modèle de données reste technique et partagé (`Restaurant`, `Dish`, `Ingredient`…) : pour Margin Shop, un `Dish` représente simplement une **fiche produit vendable** (ex. "Lait 1L") qui consomme sa propre référence de stock en 1 pour 1 — pas de recette multi-ingrédients façon cuisine.

## Modules

| Module | Statut |
|---|---|
| Dashboard + stock + ventes manuelles + **WhatsApp bot bidirectionnel** | Fonctionnel |
| Import catalogue (PDF/photo/texte) + IA | Fonctionnel, réservé à l'ordinateur |
| **Saisie vocale** (micro + audio WhatsApp) | Fonctionnel |
| Liste de courses (manquants + risque 2–3 j, WhatsApp) | Fonctionnel — réassort perso, **pas** de commande auto fournisseurs |
| Vérification physique → mode focus + vocal | Fonctionnel |
| Équipe (présence, planning éditable) | Fonctionnel |
| Caisses + **connexion webhook POS** (intégration Margin) | Fonctionnel — commerçant choisit le logiciel, on branche ; CSV reste outil interne |
| **Admin magasins** (`/admin`) | Fonctionnel — liste, créer, statut caisse (emails `ADMIN_EMAILS`) |
| **Tarifs** (welcome + onboarding) | Fonctionnel — Commerce 89 € (1 boutique, ≤200 produits) / Franchise 249 € (1–3 boutiques, illimité) |
| **Livraison (optionnel)** — Uber Eats / Deliveroo + livreurs internes | Coffre-fort clés + webhooks (ping simulé), désactivé par défaut, pas de sync live promise |
| Assistant Keke | **Hors scope** — non monté, API désactivée |

## Stack

- Next.js 15 + TypeScript + Tailwind
- Prisma + **SQLite en local** (`prisma/dev.db`) · **Postgres recommandé en prod** (`docker-compose.yml`)
- NextAuth credentials
- Twilio WhatsApp optionnel (`ConsoleNotifier` sinon — message honnête « simulé »)

## Démarrage

```bash
cd MarginShop
cp .env.example .env
npm install
npm run db:up          # Postgres local (Docker) — ou utilisez Supabase
npx prisma db push
npm run db:seed        # démo Épicerie du Marché
# ou : npm run db:seed:admin
npm run dev -- -p 3020
```

**Production** : suivez [DEPLOY.md](./DEPLOY.md) (Vercel + Supabase + Stripe) et [GO_LIVE.md](./GO_LIVE.md).

### Postgres (prod / multi-magasins)

```bash
docker compose up -d
# DATABASE_URL="postgresql://margin:margin@localhost:5433/marginshop?schema=public"
# DIRECT_URL="postgresql://margin:margin@localhost:5433/marginshop?schema=public"
npx prisma db push
npm run db:seed
```

- App : [http://localhost:3020](http://localhost:3020)
- Login : formulaire email / mot de passe (démo auto seulement si `DEMO_AUTO_LOGIN=1`)
- Démo seed : `gerant@marginshop.app` / `marginshop2026`
- Ops : [http://localhost:3020/admin](http://localhost:3020/admin) (`ADMIN_EMAILS`)
- Inscription : [http://localhost:3020/signup](http://localhost:3020/signup)
- Tarifs : [http://localhost:3020/welcome#tarifs](http://localhost:3020/welcome#tarifs)

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Postgres (Supabase pooler prod / Docker local `localhost:5433`) |
| `DIRECT_URL` | Postgres direct (Supabase 5432 / même URL en local Docker) |
| `NEXTAUTH_URL` | URL publique (`http://localhost:3020` ou domaine) |
| `NEXTAUTH_SECRET` | Secret session |
| `DEMO_AUTO_LOGIN` | `1` local only — **jamais en prod** |
| `ADMIN_EMAILS` | Accès `/admin` Ops |
| `STRIPE_*` | Checkout abonnements (voir DEPLOY.md + [STRIPE_BILLING.md](./STRIPE_BILLING.md)) |
| `TWILIO_*` | WhatsApp optionnel — voir [WHATSAPP_ALERTS.md](./WHATSAPP_ALERTS.md) |
| `WEBHOOK_BASE_URL` | URL publique webhooks |
| `OPENAI_API_KEY` | Import catalogue / vocal |
| `CREDENTIALS_ENCRYPTION_KEY` | Chiffrement clés API |

## Écrans

- `/welcome` Landing (pitch commerces de proximité)
- `/onboarding` Première config (équipe → livraison optionnelle → produits → réassort → WhatsApp)
- `/` Accueil
- `/ingredients` Stock & réassort
- `/orders` Courses (valider / historique)
- `/employees` Pointage + `/employees/planning`
- `/settings` WhatsApp · Connexions · Avancé
- `/inventory` Vérification
- `/dishes` Produits (fiches produit — **masqué sur téléphone**, réservé à l'ordinateur)
- `/ingredients/menu` Import catalogue (**masqué sur téléphone**, réservé à l'ordinateur)
- `/delivery` `/kiosks` (livraison optionnelle ; caisses → catalogue → vérification)

## Surfaces resto masquées / atténuées

Pour rester focalisé « commerce de proximité », Margin Shop masque ou déclasse les écrans propres au restaurant :

- **Produits** (`/dishes`, ex-« Recettes ») et **Import catalogue** (`/ingredients/menu`, ex-« Ma carte ») : absents de la barre de navigation téléphone et de la navigation principale ; redirigés automatiquement vers l'accueil si on y accède depuis le mode téléphone (voir `src/middleware.ts`).
- **Livraison** (Uber Eats / Deliveroo) : jamais dans la navigation principale ni la barre du bas — accessible seulement via « Aussi » / le menu secondaire, explicitement étiqueté « optionnel », et désactivée (`DISCONNECTED`) par défaut dans la démo. Aucune synchronisation live Uber/Deliveroo n'est promise (webhook générique de test uniquement).
- **Vocabulaire** : les libellés visibles utilisent rayon / réserve / vendeur / réassort / inventaire plutôt que cuisine / cuisto / plats / recettes. Les codes techniques internes (`role: "cuisine"`, champs `staffCuisine`…) restent inchangés pour ne pas casser le schéma partagé avec Margin resto — seul l'affichage change (voir `roleLabel()` dans `src/lib/employee-engine.ts`).

## Limitations documentées

- Uber Eats / Deliveroo : optionnel, désactivé par défaut — sélection ≠ connexion, clé API requise dans Connexions, pas de sync live promise
- Code-barres / caisse enregistreuse physique : scan matériel **pas encore** — matching SKU/nom via webhook & CSV oui
- WhatsApp sans Twilio : test « simulé » (rien sur le téléphone)
- POS externe : webhook multi-caisses côté commerçant ; CSV réservé usage interne Margin
- Offre : programmation branchement ~400 € + Margin actif dès 89 € / mois (Commerce)
- Liste de courses : réassort perso (WhatsApp / marché) — **pas** de commande auto ni multi-fournisseurs
- Assistant Keke : hors scope produit (non monté)

## Récap rupture de stock

Après chaque vente (et via cron) : **dédup par cycle** (1 notif jusqu’au retour au-dessus du seuil) + **batch 15 min** (1 message groupé). Voir [WHATSAPP_ALERTS.md](./WHATSAPP_ALERTS.md).

- Service : `src/lib/stock-alert-service.ts` + `src/lib/whatsapp/*`
- Cron : `GET /api/cron/stock-alerts` — scan + flush WhatsApp batch
- Status délivrabilité : `POST /api/webhooks/twilio/status`
- CTA modal : **Envoyer sur** WhatsApp (manuel)

## Webhooks & caisse

- WhatsApp entrant : `POST /api/webhooks/whatsapp` (configurer dans Twilio)
- POS live : `POST /api/webhooks/pos/{connectionId}` + header `x-webhook-secret`
  - Journal `PosWebhookEvent` + idempotence (`externalEventId`) → vente + déstockage
  - Lignes inconnues → produits découverts (`/kiosks`) → valider → compter
  - Retry / DLQ : `GET /api/cron/pos-process` (Vercel Cron chaque minute, `CRON_SECRET`)
  - **Sync temps réel SKU** : `POST /api/v1/webhooks/pos/{provider}?connectionId=` + secret ou HMAC · mapping SKU strict · doc `src/lib/pos/docs/sku-sync.md`
  - Réconciliation nuit : `GET /api/cron/pos-recon` — interne + **pull multi-caisse** (Zelty, Cashpad, Tiller/SumUp, L’Addition, Lightspeed, Square, custom)
  - Doc : `src/lib/pos/docs/overview.md` + `zelty.md` + `sku-sync.md` · widgets Admin synchro + réconciliation
  - CANCEL / void : tous adapters · order-gate soft si SALE absente
  - Clé API + merchant ID (Square / Lightspeed) sur `/kiosks`
- **Offre magasin** : le commerçant choisit son logiciel sur `/kiosks` et crée la connexion ; l’équipe Margin programme le branchement (~400 €, inclus Franchise) puis abonnement (89 € Commerce / 249 € Franchise)
- CSV / import fichier : **outil interne** (action `importPosSalesAction`), pas exposé au parcours commerçant

Flux commerçant : **choisir la caisse → créer le webhook → on branche → valider les produits → compter**.

## Tests

```bash
npm run test:unit
npm run db:seed && npm run test:loop
npm run test:load:pos    # charge 60 tenants × 20 ventes
npm run drp:drill        # backup + restore testé
```

Résilience (SPOF, charge, DRP, observabilité) : voir `RESILIENCE.md`.
Santé Ops : `GET /api/ops/pos-health` · widget `/admin`.

## Ce qui est laissé pour plus tard

- Scan code-barres matériel / intégration caisse physique native
- Sync live Uber Eats / Deliveroo (compte partenaire officiel)
- Vocabulaire 100 % shop dans les couches techniques profondes (les codes de rôle DB restent `salle` / `cuisine` / `livreur` — seul l'affichage utilisateur est traduit)
- OAuth partenaire avancé (refresh tokens Square/Lightspeed multi-compte) — tokens manuels + pull J-1 déjà branchés
