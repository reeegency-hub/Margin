# Caisse / POS — chemin réaliste pilote

## Verdict audit (8 août)

**Partiel.** Webhook temps réel **OK** en prod (auth, ingest sync, idempotence).  
Pas plug-and-play : matching = **Dish** (pas Ingredient CSV), CANCEL non branché, setup partenaire.

## Options pour le magasin #1

### A — La caisse peut POST un webhook

1. Login pilote → `/kiosks` → créer connexion (Zelty ou Autre)
2. Copier URL : `https://margin-shop.vercel.app/api/webhooks/pos/{id}`
3. Coller secret `x-webhook-secret` chez le POS / via Margin
4. Créer les **articles vendus (Dish)** liés au stock — sinon tout reste en « produits découverts »
5. 1 vente réelle → vérifier pending ou stock −1

### B — Pas de webhook (cas fréquent)

Documenter le **parcours manuel** (5 lignes) :

1. Après la journée / à la pause → ouvrir Margin
2. Mettre à jour le stock (comptage ou Copilote)
3. Vérifier alertes WhatsApp
4. (Optionnel) Importer un export CSV caisse si dispo
5. Contacter le support si bloqué : `reeegency@gmail.com`

## Script catalogue retail

```bash
npx tsx scripts/import-retail-catalog.ts \
  --restaurant-id <RESTAURANT_ID> \
  --csv chemin/stock.csv
```

Pour chaque ligne : 1 Ingredient + 1 Dish (`externalSku`) + 1 RecipeIngredient (qty 1).

## Cycle prouvé (pilote #1 · 8 août)

- SALE `LAIT-ENTIER` → stock 12→11, `pending:0`, HTTP 200  
- CANCEL → stock 11→12, `channel=pos_cancelled`, HTTP 200  
- 2ᵉ CANCEL → `IGNORED_DUP`, stock inchangé  
