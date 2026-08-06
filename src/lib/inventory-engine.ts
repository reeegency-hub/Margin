import { prisma, type TenantDb, runTenantTx } from "@/lib/db";
import { formatQty, syncIngredientAlert } from "@/lib/stock-engine";

export async function createDraftInventory(
  restaurantId: string,
  note?: string,
  opts?: { ingredientIds?: string[]; db?: TenantDb }
) {
  const db = opts?.db ?? prisma;
  const filtered = Boolean(opts?.ingredientIds?.length);
  const ingredients = await db.ingredient.findMany({
    where: {
      restaurantId,
      ...(filtered ? { id: { in: opts!.ingredientIds } } : {}),
    },
  });

  if (filtered && !ingredients.length) {
    throw new Error("Aucun produit à compter");
  }

  const ordered = [...ingredients].sort((a, b) => {
    const ca =
      a.criticalThreshold > 0 && a.stockTheoretical <= a.criticalThreshold
        ? 0
        : 1;
    const cb =
      b.criticalThreshold > 0 && b.stockTheoretical <= b.criticalThreshold
        ? 0
        : 1;
    if (ca !== cb) return ca - cb;
    return a.name.localeCompare(b.name, "fr");
  });

  return db.inventoryCount.create({
    data: {
      restaurantId,
      status: "DRAFT",
      note: note || null,
      lines: {
        create: ordered.map((ing) => ({
          ingredientId: ing.id,
          theoreticalQty: ing.stockTheoretical,
          countedQty: ing.stockTheoretical,
          varianceQty: 0,
        })),
      },
    },
    include: { lines: { include: { ingredient: true } } },
  });
}

export async function updateInventoryLines(
  restaurantId: string,
  inventoryId: string,
  lines: { lineId: string; countedQty: number }[],
  db: TenantDb = prisma
) {
  const inv = await db.inventoryCount.findFirst({
    where: { id: inventoryId, restaurantId, status: "DRAFT" },
    include: { lines: true },
  });
  if (!inv) throw new Error("Inventaire introuvable ou déjà validé");

  for (const input of lines) {
    const line = inv.lines.find((l) => l.id === input.lineId);
    if (!line) continue;
    const varianceQty = input.countedQty - line.theoreticalQty;
    await db.inventoryCountLine.update({
      where: { id: line.id },
      data: { countedQty: input.countedQty, varianceQty },
    });
  }
}

/**
 * Validate inventory: recalibrate theoretical stock, log INVENTORY movements,
 * create waste alert if significant negative variance.
 */
export async function validateInventory(
  restaurantId: string,
  inventoryId: string,
  db: TenantDb = prisma
) {
  const inv = await db.inventoryCount.findFirst({
    where: { id: inventoryId, restaurantId, status: "DRAFT" },
    include: {
      lines: { include: { ingredient: true } },
    },
  });
  if (!inv) throw new Error("Inventaire introuvable ou déjà validé");

  await runTenantTx(db, async (tx) => {
    for (const line of inv.lines) {
      const delta = line.countedQty - line.theoreticalQty;
      const unitCost = line.ingredient.lastPurchasePrice ?? 0;
      const varianceValueEur =
        unitCost > 0 ? Math.round(delta * unitCost * 100) / 100 : null;

      await tx.inventoryCountLine.update({
        where: { id: line.id },
        data: { varianceValueEur },
      });

      await tx.ingredient.update({
        where: { id: line.ingredientId },
        data: { stockTheoretical: line.countedQty },
      });
      if (delta !== 0) {
        await tx.stockMovement.create({
          data: {
            restaurantId,
            ingredientId: line.ingredientId,
            type: "INVENTORY",
            deltaQty: delta,
            refType: "InventoryCount",
            refId: inv.id,
          },
        });
      }
    }

    await tx.inventoryCount.update({
      where: { id: inv.id },
      data: { status: "VALIDATED", validatedAt: new Date() },
    });
  });

  for (const line of inv.lines) {
    if (line.varianceQty >= 0) continue;
    const absVar = Math.abs(line.varianceQty);
    const threshold =
      line.theoreticalQty > 0 ? line.theoreticalQty * 0.05 : 0;
    if (absVar < threshold && absVar < 1) continue;

    const unitCost = line.ingredient.lastPurchasePrice;
    const lossEur =
      unitCost != null && unitCost > 0
        ? Math.round(absVar * unitCost * 100) / 100
        : null;

    await db.alert.create({
      data: {
        restaurantId,
        type: "ACTION_URGENT",
        severity: 2,
        status: "ACTIVE",
        title: `Gaspillage — ${line.ingredient.name}`,
        constat: `Écart inventaire : ${formatQty(line.varianceQty, line.ingredient.unit)} sur ${line.ingredient.name}${
          lossEur != null ? ` ≈ ${lossEur.toFixed(2)} €` : ""
        }.`,
        cause: "Stock réel inférieur au théorique (casse, démarrage, erreur recette).",
        impact: "Coût matière non facturé — marge réelle en baisse.",
        action: "Vérifier la fiche recette et former l’équipe sur les portions.",
        ingredientId: line.ingredientId,
      },
    });

    await syncIngredientAlert(restaurantId, line.ingredientId, {
      notify: false,
      db,
    });
  }

  return inv;
}
