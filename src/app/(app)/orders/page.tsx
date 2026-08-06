import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatKitchenQty } from "@/lib/units";
import { BrandPage } from "@/components/brand/BrandCard";
import { OrderSplitPanel } from "@/components/dashboard/OrderSplitPanel";
import { computeShoppingNeeds } from "@/lib/orders-engine";
import { orderStatusLabel } from "@/lib/order-labels";
import { euro } from "@/lib/dashboard";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    generated?: string;
    validated?: string;
  }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const rid = session.user.restaurantId;

  const [restaurant, orders, needs] = await Promise.all([
    prisma.restaurant.findUniqueOrThrow({
      where: { id: rid },
      select: { name: true, whatsappTo: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { restaurantId: rid },
      include: {
        supplier: true,
        lines: { include: { ingredient: true } },
      },
      orderBy: { proposedAt: "desc" },
    }),
    computeShoppingNeeds(rid),
  ]);

  const lines = needs.map((n) => ({
    ingredientId: n.ingredientId,
    name: n.name,
    quantityLabel: formatKitchenQty(n.quantity, n.unit, n.name),
    stockLabel: formatKitchenQty(n.stock, n.unit, n.name),
    reason: n.reason,
    daysLeftLabel:
      n.reason === "soon" && n.daysLeft != null
        ? n.daysLeft < 1
          ? "Demain"
          : `~${Math.ceil(n.daysLeft)} j`
        : null,
  }));

  const missing = needs.filter((n) => n.reason === "missing").length;
  const soon = needs.filter((n) => n.reason === "soon").length;

  return (
    <BrandPage
      question="Courses"
      guide="Ce qu’il manque / risque sous 2–3 jours — une liste."
    >
      {params.generated ? <p className="flash">Liste mise à jour.</p> : null}
      {params.validated ? <p className="flash">Course marquée faite.</p> : null}

      <div className="dash-card dash-card--dark hub-now">
        <p className="hub-now__eyebrow">À faire maintenant</p>
        <p className="hub-now__title">
          {lines.length === 0
            ? "Rien à racheter"
            : `${lines.length} produit${lines.length > 1 ? "s" : ""} à faire`}
        </p>
        <p className="hub-now__detail">
          {lines.length === 0
            ? "Stock OK pour les 2–3 prochains jours. Actualisez si vous venez de compter."
            : [
                missing > 0
                  ? `${missing} manquant${missing > 1 ? "s" : ""}`
                  : null,
                soon > 0 ? `${soon} à risque` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
        </p>
      </div>

      <OrderSplitPanel
        lines={lines}
        restaurantName={restaurant.name}
        whatsappTo={restaurant.whatsappTo}
        orders={orders.map((o) => ({
          id: o.id,
          supplierName: o.supplier.name,
          status: o.status,
          statusLabel: orderStatusLabel(o.status),
          totalAmount: o.totalAmount,
          amountLabel:
            o.totalAmount > 0 ? euro(o.totalAmount) : "",
          lineCount: o.lines.length,
          linesLabel: o.lines
            .map(
              (l) =>
                formatKitchenQty(
                  l.quantity,
                  l.ingredient.unit,
                  l.ingredient.name
                ) + ` ${l.ingredient.name}`
            )
            .join(" · "),
          waLines: o.lines.map((l) => ({
            name: l.ingredient.name,
            quantityLabel: formatKitchenQty(
              l.quantity,
              l.ingredient.unit,
              l.ingredient.name
            ),
          })),
          productNames: o.lines.map((l) => l.ingredient.name),
          proposedAt: o.proposedAt.toISOString(),
          doneAt: (o.validatedAt || o.sentAt)?.toISOString() ?? null,
        }))}
      />
    </BrandPage>
  );
}
