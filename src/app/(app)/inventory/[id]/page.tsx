import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { BrandPage } from "@/components/brand/BrandCard";
import { InventoryCountWorkspace } from "@/components/inventory/InventoryCountWorkspace";

export default async function InventoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const sp = await searchParams;

  const inv = await prisma.inventoryCount.findFirst({
    where: { id, restaurantId: session.user.restaurantId },
    include: {
      lines: {
        include: { ingredient: true },
        orderBy: { ingredient: { name: "asc" } },
      },
    },
  });
  if (!inv) notFound();

  const editable = inv.status === "DRAFT";
  const lines = inv.lines.map((line) => ({
    id: line.id,
    name: line.ingredient.name,
    unit: line.ingredient.unit,
    theoreticalQty: line.theoreticalQty,
    countedQty: line.countedQty,
    critical:
      line.ingredient.criticalThreshold > 0 &&
      line.ingredient.stockTheoretical <= line.ingredient.criticalThreshold,
    threshold: line.ingredient.criticalThreshold,
  }));

  return (
    <BrandPage
      question={editable ? "Vérifiez le rayon" : "Vérification terminée"}
      guide={
        editable
          ? "Indiquez ce qu’il y a vraiment en magasin. Valider corrige le stock."
          : "Cette vérification a recalibré le stock. Les alertes et Courses partent de là."
      }
    >
      {sp.saved ? <p className="flash">Brouillon enregistré.</p> : null}

      <div className="inv-detail-bar">
        <Link href="/inventory" className="btn-ghost btn-ghost--sm">
          ← Vérification
        </Link>
        <span>
          {editable ? "Brouillon" : "Validé"} ·{" "}
          {inv.countedAt.toLocaleString("fr-FR")} · {lines.length} produits
        </span>
      </div>

      <InventoryCountWorkspace
        inventoryId={inv.id}
        lines={lines}
        editable={editable}
      />

      {!editable ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/ingredients" className="btn-lime">
            Voir le stock corrigé
          </Link>
          <Link href="/orders" className="btn-ghost">
            Voir Courses
          </Link>
        </div>
      ) : null}
    </BrandPage>
  );
}
