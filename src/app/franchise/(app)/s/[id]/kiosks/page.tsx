import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { PosConnectionPanel } from "@/components/kiosks/PosConnectionPanel";
import { POS_VENDOR_LABELS, type PosVendor } from "@/lib/pos/types";
import { requireFranchiseSession } from "../../../../actions";

export default async function FranchiseKiosksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireFranchiseSession();
  const { id: rid } = await params;

  const [restaurant, posConnections, pendingRaw] = await Promise.all([
    prisma.restaurant.findUniqueOrThrow({
      where: { id: rid },
      select: { name: true },
    }),
    prisma.externalPosConnection.findMany({
      where: { restaurantId: rid },
      orderBy: { createdAt: "desc" },
    }),
    prisma.posPendingProduct.findMany({
      where: { restaurantId: rid, status: "PENDING" },
      orderBy: [{ timesSeen: "desc" }, { name: "asc" }],
      include: { connection: { select: { vendor: true, name: true } } },
    }),
  ]);

  const baseUrl =
    process.env.WEBHOOK_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3020";

  const pendingProducts = pendingRaw.map((p) => ({
    id: p.id,
    name: p.name,
    externalSku: p.externalSku,
    lastUnitPrice: p.lastUnitPrice,
    timesSeen: p.timesSeen,
    totalQtySold: p.totalQtySold,
    vendorHint: p.connection
      ? POS_VENDOR_LABELS[p.connection.vendor as PosVendor] ??
        p.connection.vendor
      : null,
  }));

  return (
    <div className="franchise-page">
      <header className="franchise-page-head">
        <p className="franchise-page-head__eyebrow">{restaurant.name}</p>
        <h1>Caisse</h1>
        <p className="franchise-page-head__lead">
          Branchez le logiciel — les ventes mettent le stock à jour.
        </p>
      </header>

      <Suspense fallback={<p>Chargement…</p>}>
        <PosConnectionPanel
          baseUrl={baseUrl}
          connections={posConnections.map((c) => ({
            id: c.id,
            name: c.name,
            vendor: c.vendor,
            status: c.status,
            webhookUrl: `${baseUrl}/api/webhooks/pos/${c.id}`,
            webhookSecret: c.webhookSecret,
            lastOrderAt: c.lastOrderAt
              ? c.lastOrderAt.toLocaleString("fr-FR")
              : null,
            hasApiKey: Boolean(c.apiKeyEncrypted),
            merchantExternalId: c.merchantExternalId,
            apiBaseUrl: c.apiBaseUrl,
          }))}
          pendingProducts={pendingProducts}
          countIngredientIds={null}
        />
      </Suspense>
    </div>
  );
}
