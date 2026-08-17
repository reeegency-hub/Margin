# Parcours client — ton job (accompagnement)

Tu n’es pas là pour “vendre une feature”. Tu accompagnes **un commerçant** de A → B jusqu’à ce qu’il tourne seul.

Support : `reeegency@gmail.com` · App : https://margin-shop.vercel.app

---

## Les 5 étapes (dans l’ordre)

| # | Étape | Ce que tu fais | Ce que le client fait | Critère “ok” |
|---|--------|----------------|------------------------|--------------|
| 1 | **Compte** | Tu crées le magasin à la main (email + MDP temporaire) · tu lui envoies le lien login | Se connecte une 1ʳᵉ fois · change le MDP si besoin | Login OK, voit l’accueil |
| 2 | **Stock / menu** | Tu guides l’import · tu débloques si le fichier est sale | Envoie **CSV, PDF ou TXT** (inventaire / stock / menu) · valide le brouillon | Stock visible dans l’app, quantités plausibles |
| 3 | **Abonnement** | Tu partages le lien checkout + coupon −20 % · tu vérifies l’accès après paiement | Paie l’abo Margin (Stripe) | `stripeStatus=active` · accès commerce OK |
| 4 | **Caisse** | Tu facilites le branchement POS (Zelty / autre / webhook custom) · fallback manuel si pas prêt | Donne l’accès API / webhook ou accepte le parcours manuel 5 lignes | 1 vente test → stock bouge **ou** process manuel écrit |
| 5 | **WhatsApp** | Tu configures le numéro dans Réglages · tu déclenches 1 alerte test | Reçoit le message sur son téléphone | 1 alerte WA réelle reçue |

Ensuite seulement : call 30 min ([FRICTION-CALL.md](./FRICTION-CALL.md)) → notes → hotfix si bloquant → J+3 / J+7.

---

## Script call d’onboard (45–60 min)

### 0. Avant l’appel (toi, 10 min)
- [ ] Compte magasin créé (ou prêt à créer en live)
- [ ] Coupon −20 % sous la main
- [ ] Lien app + identifiants (SMS / WhatsApp / mail)
- [ ] Savoir quel fichier il a : CSV stock ? PDF menu ? photo rayon ?

### 1. Compte (5 min)
- [ ] Login ensemble
- [ ] “Voici où tu reviens chaque matin” (Accueil / Stock)
- [ ] Noter si le login coince → friction P0

### 2. Import (15–20 min)
- [ ] Il partage le fichier (CSV / PDF / TXT)
- [ ] Import via Copilote ou écran Import catalogue
- [ ] Relire **ensemble** 5–10 lignes : nom, unité, quantité, seuil
- [ ] Commit / appliquer au stock
- [ ] S’il n’a que le menu (PDF) : créer les fiches produits + stock à 0, puis inventaire plus tard

### 3. Abonnement (5–10 min)
- [ ] Expliquer : l’abo Margin = accès outil (pas la caisse bancaire)
- [ ] Checkout live + coupon
- [ ] Attendre le retour “accès OK” avant de passer à la caisse

### 4. Caisse (10–15 min)
→ Suivre le déroulé complet : [POS-CAISSE.md](./POS-CAISSE.md)

- [ ] Demander **quelle caisse** (Zelty, SumUp, autre, rien…)
- [ ] Si connecteur connu → webhook `/kiosks` + SKU alignés
- [ ] Si inconnu / trop long → **parcours manuel** · ne pas bloquer l’onboard
- [ ] 1 test : vente → stock −1 (ou note « manuel jusqu’à J+7 »)

### 5. WhatsApp (5 min)
- [ ] Numéro commerçant dans Réglages
- [ ] Déclencher alerte test (seuil bas ou alerte manuelle)
- [ ] Il confirme réception sur le téléphone

### 6. Clôture (2 min)
- [ ] “Tu reviens seul pour : regarder le stock + 1 question Copilote”
- [ ] RDV **J+3** (15 min) et **J+7** (15 min) dans l’agenda
- [ ] Support unique : `reeegency@gmail.com`

---

## Ce que tu ne fais pas pendant l’onboard

- Ne pas ouvrir le signup public
- Ne pas promettre Grok / Gemini / “toutes les caisses plug & play”
- Ne pas passer 40 min sur une caisse obscure → bascule manuel + ticket technique
- Ne pas confondre **Stripe abo Margin** et **caisse / POS** (deux sujets)

---

## Fiche magasin (copier-coller par client)

```
Magasin #:
Nom commerce:
Contact:
Email login:
Caisse (marque):
Fichier reçu (CSV/PDF/TXT):
Import: OK / partiel / reporté
Abo Stripe: unpaid / active
Caisse: branchée / manuel temporaire
WhatsApp: OK / KO
Frictions:
J+3:
J+7:
```
