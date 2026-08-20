# Tarification administrateurs / apporteurs

Attribution automatique : un client qui s’inscrit via le lien ambassadeur
(`https://margin-shop.vercel.app/signup?amb=AMB-XXXX`) est rattaché à l’espace
partenaire — chaque facture Stripe crée une commission dans `/partner/commissions`.

## Farel (pilote — `AMB-FAREL`)

| Élément | Montant |
|---------|---------|
| Abonnement client amené | **80 % à vie** (chaque facture) |
| Onboarding (1ʳᵉ facture payée) | **250 €** une fois par commerce |

Lien : https://margin-shop.vercel.app/signup?amb=AMB-FAREL

## Prochains administrateurs

| Période | Commission sur l’abo |
|---------|----------------------|
| 2 premiers mois (factures 1–2) | **80 %** |
| Ensuite | **20 %** |

Pas de bonus onboarding fixe (sauf accord écrit).

## Base de calcul prévisions

- Plan de référence : **Commerce 89 € / mois**
- 1ʳᵉ facture client souvent à −20 % promo → **71,20 €** → commission Farel **56,96 €**
- Mois suivants : **89 €** → commission Farel **71,20 € / mois / client**

Code source : `src/lib/ambassador-pricing.ts` · ledger : `src/lib/crm/rewards.ts`
