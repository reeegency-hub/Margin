# Soft Launch — Semaine fondations → pilote

App : https://margin-shop.vercel.app · Support : `reeegency@gmail.com`  
**Ton job :** accompagner le client — [PARCOURS-CLIENT.md](./PARCOURS-CLIENT.md)  
Compte test : `reeegency+pilote1@gmail.com` · [COMPTE-PILOTE-1.md](./COMPTE-PILOTE-1.md)

**Règle :** pas d’invite client tant que Sam–Dim (prod) n’est pas vert.  
**Domaine :** optionnel (pilote = comptes à la main).

---

## Ton rôle vs la technique

| Toi (accompagnement) | Prod (fondations Sam–Dim) |
|----------------------|---------------------------|
| Création du compte client | Démo auto-login off |
| Import CSV / PDF / TXT (stock ou menu) | Stripe live + 1 paiement test |
| Abonnement Margin (checkout + coupon) | Clé LLM + Copilote qui répond |
| Intégration caisse (ou manuel) | App stable |
| Mise en place WhatsApp | |

Sans la colonne de droite, l’accompagnement plante. Sans la colonne de gauche, pas de vrai pilote.

---

## Sam–Dim — Fondations (avant le 1er client)

- [ ] `DEMO_AUTO_LOGIN=0` en prod
- [ ] Stripe **live** branché (clés + webhook)
- [ ] Clé ChatGPT + spending limit (10–20 €)
- [ ] 1 message Copilote OK + 1 petit import CSV (smoke)
- [ ] Toi login 10 min sans page cassée

**Ok :** le parcours client peut commencer sans surprise technique.

---

## Lundi — 1er accompagnement (magasin #1)

Enchaîne le [parcours](./PARCOURS-CLIENT.md) avec #1 (ou self-run si le commerçant n’est pas dispo) :

1. [ ] Compte
2. [ ] Import stock / menu (fichier réel)
3. [ ] Abonnement live + coupon −20 %
4. [ ] Caisse — guide détaillé [POS-CAISSE.md](./POS-CAISSE.md) (branchée **ou** manuel)
5. [ ] WhatsApp (1 alerte reçue)

Aussi : `/admin` FOUNDER OK · coupon créé une fois pour tous.

**Ok Lundi :** les 5 étapes cochées (ou blocker noté avec plan B).

---

## Mardi — Il se débrouille un peu + pipeline

- [ ] Call 30 min — lui aux commandes · grille [FRICTION-CALL.md](./FRICTION-CALL.md)
- [ ] 2–3 frictions notées · hotfix P0 le jour même
- [ ] File d’attente [FILE-ATTENTE.md](./FILE-ATTENTE.md)
- [ ] Créneaux J+3 / J+7 bloqués
- [ ] Soft announce réseau **si** abo live vert — [MESSAGE-ANNONCE.md](./MESSAGE-ANNONCE.md)

**Ok Mardi :** tu sais onboarder #2 sans improvisation.

---

## Mer–Ven

| Jour | Focus |
|------|--------|
| Mer | Onboard #2 avec le même parcours 5 étapes |
| Jeu | J+3 magasin #1 |
| Ven | #3 ou pause · [GO-NOGO.md](./GO-NOGO.md) |

---

## Ne pas ouvrir tant que…

| Interdit | Déblocage |
|----------|-----------|
| Annonce grand public | Stripe E2E vert |
| Signup self-serve | 3 pilotes stables après J+7 |
| Ads | Avant 3 pilotes stables |
| “Toutes les caisses en 2 clics” | Non promis — facilité + plan B manuel |
