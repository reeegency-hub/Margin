# Checklist Soft Launch — Demain matin

Ordre chronologique. Le domaine/DNS part en premier car c’est le seul délai incompressible (propagation).

---

## 0. Lancer en tout premier (délai de propagation)

- [ ] Acheter `marginshop.app` (Vercel Domains ou registrar)
- [ ] Resend → Add Domain → coller SPF / DKIM / DMARC chez le registrar
- [ ] Laisser propager en arrière-plan pendant les étapes suivantes

**Lien utile :** [vercel.com/dashboard/domains](https://vercel.com/dashboard/domains) · [resend.com/domains](https://resend.com/domains)

---

## 1. Pendant que le DNS propage (en parallèle)

### Stripe live E2E — priorité #1

- [ ] Payer 1 abo live avec une vraie carte (compte fondateur ou test)
- [ ] Vérifier : accès app + `stripeStatus=active` en base
- [ ] Si ça casse : webhook live `https://margin-shop.vercel.app/api/stripe/webhook` + logs Vercel

### OpenAI billing

- [ ] [platform.openai.com](https://platform.openai.com) : crédit + spending limit (10–20 €)
- [ ] Sans ça le Copilote reste en 429

### Neon PITR (backup)

- [ ] Créer une `NEON_API_KEY` (ou tester via dashboard Neon)
- [ ] Une fois : branche de restore à T−5 min pour prouver que ça marche

### Admin

- [ ] Vérifier `/admin` : magasin actif + rôle FOUNDER OK sur ton compte

---

## 2. Revenir sur Resend une fois le DNS propagé

- [ ] Verify **vert** sur Resend
- [ ] Vercel Production : `NEWSLETTER_FROM_EMAIL=Margin <contact@marginshop.app>`
- [ ] Redéployer
- [ ] Tester OTP vers une adresse **hors compte Resend** (vraie boîte externe)

---

## 3. Magasin #1 (déjà créé — à finir)

Compte : `reeegency+pilote1@gmail.com` (MDP déjà communiqué)  
Détail : [COMPTE-PILOTE-1.md](./COMPTE-PILOTE-1.md)

- [ ] WhatsApp commerçant dans Réglages → preuve d’une alerte réelle reçue
- [ ] Import stock réel (pas le CSV test) → doit tenir face aux données sales
- [ ] Documenter caisse (POS ou parcours manuel 5 lignes) → pas de flou ops — voir [POS-CAISSE.md](./POS-CAISSE.md)
- [ ] Coupon Stripe −20 % premier mois créé (à réutiliser pour #2 et #3)
- [ ] Call 30 min : le commerçant fait 3 actions seul — grille [FRICTION-CALL.md](./FRICTION-CALL.md)
- [ ] Noter 2–3 frictions → à corriger avant magasins #2–#3

---

## 4. Une fois Stripe + OTP verts → soft announce (réseau fermé)

**Message type :** voir [MESSAGE-ANNONCE.md](./MESSAGE-ANNONCE.md)

> On ouvre un programme pilote : 5 commerces max. Pas un lancement grand public. Intéressé → réponds ici, on te recontacte à la main.

- [ ] Liste file d’attente (Sheets) : Date | Nom | Commerce | Canal | Statut | Notes — modèle [FILE-ATTENTE.md](./FILE-ATTENTE.md)
- [ ] Réponses 1:1 uniquement
- [ ] 0 ads Meta/Google cette semaine
- [ ] Support unique déjà posé : `reeegency@gmail.com`
- [ ] Agenda par pilote dès l’onboard : **J+3** (15 min, ça démarre ?) / **J+7** (15 min, usage régulier ou abandon ?)

---

## Ne pas ouvrir tant que…

| Interdit | Condition de déblocage |
|----------|------------------------|
| Annonce « ready » | Stripe E2E + OTP verts |
| Self-serve `/signup` grand public | 3 pilotes stables + 0 friction critique après J+7 |
| Ads | Avant 3 pilotes stables |
| Promesses Grok/Gemini | Déjà retiré — ne pas remettre |

---

## Récap — checklist « je coche »

- [ ] Domaine acheté + DNS Resend verts + OTP reçu ailleurs
- [ ] 1 paiement Stripe live → accès OK
- [ ] Spending limit OpenAI
- [ ] PITR Neon testé une fois
- [ ] `/admin` : magasin actif + rôle FOUNDER OK
- [ ] WA + stock réel magasin #1
- [ ] Coupon −20 % créé
- [ ] Call 30 min + notes friction
- [ ] File d’attente Sheets créée
- [ ] 2 RDV J+3 / J+7 bloqués pour le prochain onboard
