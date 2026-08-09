# File d’attente + suivi J+3 / J+7

## Colonnes Sheets (copier-coller)

```
Date | Nom | Commerce | Caisse | Canal | Statut | Notes | Onboardé le | J+3 | J+7 | Stable ?
```

### Statuts suggérés

`nouveau` → `call_planifié` → `onboardé` → `j3_ok` / `j3_bloqué` → `j7_actif` / `j7_abandon` → `stable`

### Canaux

WhatsApp · Email · Tel · Autre

---

## Template check J+3 (15 min)

- [ ] S’est connecté au moins 1× depuis l’onboard ?
- [ ] Bloqué où ? (login / stock / WA / copilote / autre)
- [ ] Une action réussie seule ? (laquelle)
- [ ] Besoin support ? → `reeegency@gmail.com`

**Note libre :**

---

## Template check J+7 (15 min)

- [ ] Usage ≥ 2 jours distincts ?
- [ ] Stock à jour OU alerte WA reçue OU liste courses utilisée ?
- [ ] Friction critique restante ? (paiement / accès / copilote muet / caisse)
- [ ] Garde / abandon / pause

**Décision :** `stable` · `à corriger` · `abandon`

---

## Règle self-serve

N’ouvrir `/signup` grand public que si **≥ 3** lignes `stable` et **0** friction critique ouverte.
