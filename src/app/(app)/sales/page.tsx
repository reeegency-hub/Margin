import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { BrandPage } from "@/components/brand/BrandCard";
import { formatKitchenQty } from "@/lib/units";
import {
  ManualSalePanel,
  type ManualSaleProduct,
  type RecentManualSale,
} from "@/components/sales/ManualSalePanel";

export default async function ManualSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ sold?: string; error?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const rid = session.user.restaurantId;

  const [products, recentRaw] = await Promise.all([
    prisma.product.findMany({
      where: { restaurantId: rid, active: true },
      include: {
        productStocks: { include: { stockUnit: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.sale.findMany({
      where: { restaurantId: rid, channel: "manual" },
      include: { items: { include: { product: { select: { name: true } } } } },
      orderBy: { soldAt: "desc" },
      take: 12,
    }),
  ]);

  const catalog: ManualSaleProduct[] = products.map((p) => {
    const stocks = p.productStocks;
    let stockLabel: string | null = null;
    if (stocks.length === 1) {
      const u = stocks[0]!.stockUnit;
      stockLabel = formatKitchenQty(u.stockTheoretical, u.unit, u.name);
    } else if (stocks.length > 1) {
      stockLabel = `${stocks.length} refs`;
    }
    return {
      id: p.id,
      name: p.name,
      salePrice: p.salePrice,
      sku: p.externalSku,
      stockLabel,
    };
  });

  const recent: RecentManualSale[] = recentRaw.map((s) => ({
    id: s.id,
    soldAt: s.soldAt.toLocaleString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    items: s.items.map((i) => ({
      name: i.product.name,
      quantity: i.quantity,
    })),
  }));

  return (
    <BrandPage
      question="Hors caisse"
      guide="Dictez ou notez. Puis « C’est vendu »."
    >
      {params.sold ? (
        <p className="flash">Vente enregistrée — stock mis à jour.</p>
      ) : null}
      {params.error ? (
        <p className="flash flash-warn">{decodeURIComponent(params.error)}</p>
      ) : null}
      <ManualSalePanel products={catalog} recent={recent} />
    </BrandPage>
  );
}
