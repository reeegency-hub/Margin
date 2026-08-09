"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenantDb } from "@/lib/session";
import { toStorageQty, type DisplayUnit } from "@/lib/units";
import { defaultThresholdForIngredient } from "@/lib/catalog/thresholds";
import { syncCatalogIssues } from "@/lib/catalog/issues";
import { assertCanAddProducts } from "@/lib/plan-limits";

export async function createIngredient(formData: FormData) {
  await requireTenantDb(async (db, ctx) => {
    const gate = await assertCanAddProducts(ctx.tenantId, 1, db);
    if (!gate.ok) {
      throw new Error(gate.error);
    }
    await db.stockUnit.create({
      data: {
        restaurantId: ctx.tenantId,
        name: String(formData.get("name") || "").trim(),
        unit: String(formData.get("unit") || "g"),
        stockTheoretical: Number(formData.get("stockTheoretical") || 0),
        criticalThreshold: Number(formData.get("criticalThreshold") || 0),
        reorderQty: Number(formData.get("reorderQty") || 0),
      },
    });
  });

  revalidatePath("/ingredients");
  revalidatePath("/");
  redirect("/ingredients");
}

export async function createIngredientsBulkAction(
  items: {
    name: string;
    unit: string;
    stockTheoretical: number;
    criticalThreshold: number;
    reorderQty: number;
  }[]
): Promise<
  | { ok: true; created: number; skipped: number }
  | { ok: false; error: string }
> {
  if (!items?.length) {
    return { ok: false, error: "Aucun ingrédient à enregistrer." };
  }

  const result = await requireTenantDb(async (db, ctx) => {
    const existing = await db.stockUnit.findMany({
      where: { restaurantId: ctx.tenantId },
      select: { name: true },
    });
    const known = new Set(
      existing.map((i) =>
        i.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
      )
    );

    let created = 0;
    let skipped = 0;
    const toCreate: typeof items = [];

    for (const item of items) {
      const name = String(item.name || "").trim();
      if (!name) continue;
      const key = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
      if (known.has(key)) {
        skipped += 1;
        continue;
      }
      known.add(key);
      toCreate.push(item);
    }

    const gate = await assertCanAddProducts(ctx.tenantId, toCreate.length, db);
    if (!gate.ok) {
      return { ok: false as const, error: gate.error };
    }

    for (const item of toCreate) {
      const name = String(item.name || "").trim();
      await db.stockUnit.create({
        data: {
          restaurantId: ctx.tenantId,
          name,
          unit: ["g", "ml", "pcs"].includes(item.unit) ? item.unit : "g",
          stockTheoretical: Number(item.stockTheoretical) || 0,
          criticalThreshold:
            Number(item.criticalThreshold) ||
            defaultThresholdForIngredient(name, item.unit).criticalThreshold,
          reorderQty:
            Number(item.reorderQty) ||
            defaultThresholdForIngredient(name, item.unit).reorderQty,
          category: defaultThresholdForIngredient(name, item.unit).category,
          thresholdSource: Number(item.criticalThreshold)
            ? "manual"
            : "unit_default",
        },
      });
      created += 1;
    }

    if (!created && skipped) {
      return {
        ok: false as const,
        error: "Tous ces produits existent déjà dans le stock.",
      };
    }
    if (!created) {
      return { ok: false as const, error: "Rien à enregistrer." };
    }

    await syncCatalogIssues(ctx.tenantId);
    return { ok: true as const, created, skipped };
  });

  if (result.ok) {
    revalidatePath("/ingredients");
    revalidatePath("/");
  }
  return result;
}

export async function updateIngredient(formData: FormData) {
  const id = String(formData.get("id"));
  const displayRaw = String(formData.get("displayUnit") || "");
  const display = (
    ["kg", "g", "L", "ml", "pcs"].includes(displayRaw) ? displayRaw : null
  ) as DisplayUnit | null;

  let stockTheoretical = Number(formData.get("stockTheoretical") || 0);
  let criticalThreshold = Number(formData.get("criticalThreshold") || 0);
  let reorderQty = Number(formData.get("reorderQty") || 0);

  if (display) {
    stockTheoretical = toStorageQty(stockTheoretical, display);
    criticalThreshold = toStorageQty(criticalThreshold, display);
    if (!(reorderQty > 0)) {
      reorderQty = Math.max(criticalThreshold * 2, 1);
    }
  }

  await requireTenantDb(async (db, ctx) => {
    await db.stockUnit.updateMany({
      where: { id, restaurantId: ctx.tenantId },
      data: {
        name: String(formData.get("name") || "").trim(),
        unit: String(formData.get("unit") || "g"),
        stockTheoretical,
        criticalThreshold,
        reorderQty,
        thresholdSource: "manual",
      },
    });
  });
  revalidatePath("/ingredients");
  revalidatePath("/orders");
  revalidatePath("/");
  redirect("/ingredients");
}

export async function deleteIngredient(formData: FormData) {
  const id = String(formData.get("id"));
  await requireTenantDb(async (db, ctx) => {
    await db.stockUnit.deleteMany({
      where: { id, restaurantId: ctx.tenantId },
    });
  });
  revalidatePath("/ingredients");
  revalidatePath("/");
  redirect("/ingredients");
}

export async function createDish(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const salePrice = Number(formData.get("salePrice") || 0);
  const description = String(formData.get("description") || "").trim() || null;
  const allergensRaw = String(formData.get("allergens") || "").trim();
  const allergens = allergensRaw || null;
  const externalSkuRaw =
    String(formData.get("externalSku") || "").trim() || null;
  const { normalizeSku } = await import("@/lib/pos/sku");
  const externalSku = normalizeSku(externalSkuRaw);

  const stockUnitIds = formData.getAll("stockUnitId").map(String);
  const newIngredientNames = formData.getAll("newIngredientName").map(String);
  const quantities = formData.getAll("quantity").map(Number);
  const units = formData.getAll("unit").map(String);

  let imageUrl: string | null = null;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    if (image.size > 5 * 1024 * 1024) {
      return { ok: false as const, error: "Image trop volumineuse (max 5 Mo)." };
    }
    const { mkdir, writeFile } = await import("fs/promises");
    const { join } = await import("path");
    const ext =
      image.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
      "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)
      ? ext
      : "jpg";
    const dir = join(process.cwd(), "public", "uploads", "dishes");
    await mkdir(dir, { recursive: true });
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
    const buffer = Buffer.from(await image.arrayBuffer());
    await writeFile(join(dir, filename), buffer);
    imageUrl = `/uploads/dishes/${filename}`;
  }

  return requireTenantDb(async (db, ctx) => {
    const lines: { stockUnitId: string; quantity: number; unit: string }[] =
      [];
    let newIngredientSlots = 0;

    for (
      let i = 0;
      i < Math.max(stockUnitIds.length, newIngredientNames.length);
      i++
    ) {
      const qty = quantities[i];
      if (!(qty > 0)) continue;
      const stockUnitId = stockUnitIds[i]?.trim() || "";
      const newName = newIngredientNames[i]?.trim() || "";
      if (!stockUnitId && newName) {
        const existing = await db.stockUnit.findFirst({
          where: { restaurantId: ctx.tenantId, name: { equals: newName } },
          select: { id: true },
        });
        if (!existing) newIngredientSlots += 1;
      }
    }
    const gate = await assertCanAddProducts(
      ctx.tenantId,
      newIngredientSlots,
      db
    );
    if (!gate.ok) {
      return { ok: false as const, error: gate.error };
    }

    for (
      let i = 0;
      i < Math.max(stockUnitIds.length, newIngredientNames.length);
      i++
    ) {
      const qty = quantities[i];
      const unit = units[i] || "g";
      if (!(qty > 0)) continue;

      let stockUnitId = stockUnitIds[i]?.trim() || "";
      const newName = newIngredientNames[i]?.trim() || "";

      if (!stockUnitId && newName) {
        const existing = await db.stockUnit.findFirst({
          where: {
            restaurantId: ctx.tenantId,
            name: { equals: newName },
          },
        });
        if (existing) {
          stockUnitId = existing.id;
        } else {
          const created = await db.stockUnit.create({
            data: {
              restaurantId: ctx.tenantId,
              name: newName,
              unit,
              stockTheoretical: 0,
              criticalThreshold: 0,
              reorderQty: 0,
            },
          });
          stockUnitId = created.id;
        }
      }

      if (stockUnitId) {
        lines.push({ stockUnitId, quantity: qty, unit });
      }
    }

    const byId = new Map(lines.map((l) => [l.stockUnitId, l]));
    const uniqueLines = [...byId.values()];

    if (!name || uniqueLines.length === 0) {
      return {
        ok: false as const,
        error: "Nom et au moins un produit avec quantité sont requis.",
      };
    }

    await db.product.create({
      data: {
        restaurantId: ctx.tenantId,
        name,
        salePrice,
        description,
        allergens,
        imageUrl,
        externalSku,
        productStocks: { create: uniqueLines },
      },
    });

    revalidatePath("/dishes");
    revalidatePath("/ingredients");
    revalidatePath("/ingredients/menu");
    return { ok: true as const };
  });
}

export async function deleteDish(formData: FormData) {
  const id = String(formData.get("id"));
  const from = String(formData.get("from") || "").trim();
  await requireTenantDb(async (db, ctx) => {
    await db.product.deleteMany({
      where: { id, restaurantId: ctx.tenantId },
    });
  });
  revalidatePath("/dishes");
  revalidatePath("/ingredients");
  if (from === "stock") redirect("/ingredients?tab=catalogue");
  redirect("/dishes");
}
