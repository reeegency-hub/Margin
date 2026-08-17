import { prisma, type TenantDb, runTenantTx } from "@/lib/db";
import { formatQty, syncIngredientAlert } from "@/lib/stock-engine";

export async function createDraftInventory(
  restaurantId: string,
  note?: string,
  opts?: { stockUnitIds?: string[]; db?: TenantDb }
) {
  const db = opts?.db ?? prisma;
  const filtered = Boolean(opts?.stockUnitIds?.length);
  const ingredients = await db.stockUnit.findMany({
    where: {
      restaurantId,
      ...(filtered ? { id: { in: opts!.stockUnitIds } } : {}),
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
          stockUnitId: ing.id,
          theoreticalQty: ing.stockTheoretical,
          countedQty: ing.stockTheoretical,
          varianceQty: 0,
        })),
      },
    },
    include: { lines: { include: { stockUnit: true } } },
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
      lines: { include: { stockUnit: true } },
    },
  });
  if (!inv) throw new Error("Inventaire introuvable ou déjà validé");

  await runTenantTx(db, async (tx) => {
    for (const line of inv.lines) {
      const delta = line.countedQty - line.theoreticalQty;
      const unitCost = line.stockUnit.lastPurchasePrice ?? 0;
      const varianceValueEur =
        unitCost > 0 ? Math.round(delta * unitCost * 100) / 100 : null;

      await tx.inventoryCountLine.update({
        where: { id: line.id },
        data: { varianceValueEur },
      });

      await tx.stockUnit.update({
        where: { id: line.stockUnitId },
        data: { stockTheoretical: line.countedQty },
      });
      if (delta !== 0) {
        await tx.stockMovement.create({
          data: {
            restaurantId,
            stockUnitId: line.stockUnitId,
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

    const unitCost = line.stockUnit.lastPurchasePrice;
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
        title: `Gaspillage — ${line.stockUnit.name}`,
        constat: `Écart inventaire : ${formatQty(line.varianceQty, line.stockUnit.unit)} sur ${line.stockUnit.name}${
          lossEur != null ? ` ≈ ${lossEur.toFixed(2)} €` : ""
        }.`,
        cause: "Stock réel inférieur au théorique (casse, démarrage, erreur de fiche).",
        impact: "Coût d’achat non couvert — marge réelle en baisse.",
        action: "Vérifier la fiche produit et former l’équipe sur les quantités.",
        stockUnitId: line.stockUnitId,
      },
    });

    await syncIngredientAlert(restaurantId, line.stockUnitId, {
      notify: false,
      db,
    });
  }

  return inv;
}
