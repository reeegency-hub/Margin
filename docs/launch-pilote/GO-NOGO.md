# Go / No-Go — état au 8 août 2026

Critères soft announce : **les 3 doivent être verts**.

| Critère | Statut | Preuve / manque |
|---------|--------|-----------------|
| Stripe live (paiement → accès) | **NO-GO** | Clés live OK, sessions unpaid. 0 magasin `stripeStatus=active` |
| OTP email | **NO-GO** | 0 domaine Resend, From = `onboarding@resend.dev` |
| 1 magasin actif + usage | **GO** | Magasin Pilote #1 · 4 produits · 1 import CSV |

**Verdict actuel : NO-GO annonce.**

Après paiement live + OTP domaine verts → re-check puis section 4 de la checklist.
