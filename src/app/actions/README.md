# Découpage de `actions.ts` (monolithe)

Objectif : sortir les domaines du fichier `src/app/actions.ts`
sans casser les imports `@/app/actions`.

## Convention

| Fichier | Domaine |
|---|---|
| `actions/catalog.ts` | ingredients, dishes |
| `actions/pos.ts` | connexions caisse, secrets, simulate |
| `actions/orders.ts` | courses, validate, shopping list *(à faire)* |
| `actions/billing.ts` | signupAndCheckout *(à faire)* |
| `actions/team.ts` | employés, planning *(à faire)* |
| `actions/inventory.ts` | vérification *(à faire)* |
| `actions.ts` | ré-exporte tout (façade stable) |

## Pattern

```ts
// actions/catalog.ts
"use server";
export async function createIngredient(...) {
  await requireTenantDb(async (db, ctx) => { ... });
}

// actions.ts — wrappers async (pas de `export { } from`, interdit par Next)
export async function createIngredient(fd) {
  return catalogActions.createIngredient(fd);
}
```

## Fait

- `requireTenantDb` + `withTenantRls` (transaction) : modèle pour écritures tenant
- **catalog** + **pos** extraits ; delete POS scoped `restaurantId` (plus de `delete` nu)
- Billing gate + cron auth hors monolithe (`lib/stripe/access`, `lib/cron-auth`)
