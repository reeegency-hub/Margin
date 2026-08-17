# Go / No-Go — état au 9 août 2026

Critères soft announce **réseau fermé** (5 pilotes max).

| Critère | Statut | Preuve / manque |
|---------|--------|-----------------|
| Fondations Sam–Dim (toi = commerçant) | **À valider** | Démo off + Stripe live branché + LLM + Copilote + CSV — à cocher à la main |
| Stripe live (paiement → accès) | **NO-GO** (ops) | Clés live + garde `sk_test` en check-prod-env. Il reste **1 paiement réel** à faire pour passer `stripeStatus=active`. |
| OTP email / domaine | **REPORTÉ** | Pas de domaine acheté ; OK pour pilote **comptes manuels**. Bloquant seulement pour signup public |
| 1 magasin actif + usage | **GO** | Magasin Pilote #1 · import CSV fait |

**Verdict annonce :** **NO-GO** tant que Stripe E2E n’est pas vert.  
OTP n’est plus sur le chemin critique du soft launch fermé.

Plan jour par jour : [CHECKLIST-DEMAIN.md](./CHECKLIST-DEMAIN.md).
