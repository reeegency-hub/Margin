import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatKitchenQty } from "@/lib/units";
import { OrderSplitPanel } from "@/components/dashboard/OrderSplitPanel";
import { computeShoppingNeeds } from "@/lib/orders-engine";
import { orderStatusLabel } from "@/lib/order-labels";
import { euro } from "@/lib/dashboard";
import {
  completeShoppingListAction,
  generateOrders,
} from "@/app/actions";
import { buildWaMeLink, shoppingListWaMessage } from "@/lib/wa-link";
import { WaSendLabel } from "@/components/ui/WhatsAppIcon";
import { requireFranchiseSession } from "../../../../actions";

export default async function FranchiseOrdersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireFranchiseSession();
  const { id: rid } = await params;

  const [restaurant, orders, needs] = await Promise.all([
    prisma.restaurant.findUniqueOrThrow({
      where: { id: rid },
      select: { name: true, whatsappTo: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { restaurantId: rid },
      include: {
        supplier: true,
        lines: { include: { stockUnit: true } },
      },
      orderBy: { proposedAt: "desc" },
    }),
    computeShoppingNeeds(rid),
  ]);

  const lines = needs.map((n) => ({
    stockUnitId: n.stockUnitId,
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

  const waHref =
    buildWaMeLink(
      restaurant.whatsappTo,
      shoppingListWaMessage(
        restaurant.name,
        lines.map((l) => ({
          name: l.name,
          quantityLabel: l.quantityLabel,
        }))
      )
    ) || `/franchise/s/${rid}/settings`;

  return (
    <div className="franchise-page">
      <header className="franchise-page-head">
        <p className="franchise-page-head__eyebrow">{restaurant.name}</p>
        <h1>Courses</h1>
        <p className="franchise-page-head__lead">
          {lines.length === 0
            ? "Rien à racheter"
            : `${lines.length} ligne(s) à faire`}
        </p>
      </header>

      <div className="franchise-inline-actions" style={{ marginBottom: "1rem" }}>
        {lines.length > 0 ? (
          <>
            <a
              href={waHref}
              target={waHref.startsWith("https://") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="franchise-btn"
            >
              <WaSendLabel kind="list" />
            </a>
            <form action={completeShoppingListAction}>
              <button type="submit" className="franchise-btn franchise-btn--ghost">
                Marquer comme fait
              </button>
            </form>
          </>
        ) : (
          <form action={generateOrders}>
            <button type="submit" className="franchise-btn franchise-btn--ghost">
              Actualiser
            </button>
          </form>
        )}
        <Link href={`/franchise/s/${rid}/stock`} className="franchise-btn franchise-btn--ghost">
          Stock →
        </Link>
      </div>

      <OrderSplitPanel
        lines={lines}
        restaurantName={restaurant.name}
        whatsappTo={restaurant.whatsappTo}
        primaryActionsInInk
        orders={orders.map((o) => ({
          id: o.id,
          supplierName: o.supplier.name,
          status: o.status,
          statusLabel: orderStatusLabel(o.status),
          totalAmount: o.totalAmount,
          amountLabel: o.totalAmount > 0 ? euro(o.totalAmount) : "",
          lineCount: o.lines.length,
          linesLabel: o.lines
            .map(
              (l) =>
                formatKitchenQty(
                  l.quantity,
                  l.stockUnit.unit,
                  l.stockUnit.name
                ) + ` ${l.stockUnit.name}`
            )
            .join(" · "),
          waLines: o.lines.map((l) => ({
            name: l.stockUnit.name,
            quantityLabel: formatKitchenQty(
              l.quantity,
              l.stockUnit.unit,
              l.stockUnit.name
            ),
          })),
          productNames: o.lines.map((l) => l.stockUnit.name),
          proposedAt: o.proposedAt.toISOString(),
          doneAt: (o.validatedAt || o.sentAt)?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
