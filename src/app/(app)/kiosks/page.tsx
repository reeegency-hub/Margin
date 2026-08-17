import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { BrandPage } from "@/components/brand/BrandCard";
import { PosConnectionPanel } from "@/components/kiosks/PosConnectionPanel";
import { POS_VENDOR_LABELS, type PosVendor } from "@/lib/pos/types";
import { Suspense } from "react";

export default async function KiosksPage({
  searchParams,
}: {
  searchParams: Promise<{
    connected?: string;
    name?: string;
    imported?: string;
    accepted?: string;
    countIngredients?: string;
    ignored?: string;
    pos?: string;
    tested?: string;
    secret?: string;
    deleted?: string;
    error?: string;
  }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const rid = session.user.restaurantId;
  const [posConnections, pendingRaw] = await Promise.all([
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

  const live =
    posConnections.find((c) => c.lastOrderAt) || posConnections[0] || null;
  const liveVendor = live
    ? POS_VENDOR_LABELS[live.vendor as PosVendor] ?? live.vendor
    : null;
  const pendingCount = pendingProducts.length;

  const inkTitle =
    pendingCount > 0
      ? `${pendingCount} produit${pendingCount > 1 ? "s" : ""} à valider`
      : live?.lastOrderAt
        ? "Caisse synchronisée"
        : posConnections.length > 0
          ? "En attente de première vente"
          : "Caisse à brancher";

  const inkDetail =
    pendingCount > 0
      ? "Validez les articles découverts pour les ajouter au catalogue."
      : live?.lastOrderAt
        ? `Dernière vente · ${live.lastOrderAt.toLocaleString("fr-FR")}${
            liveVendor ? ` · ${liveVendor}` : ""
          }`
        : posConnections.length > 0
          ? "Lien créé — collez l’adresse dans la caisse ou testez une vente."
          : "Choisissez votre logiciel, créez le lien, les ventes mettent le stock à jour.";

  return (
    <BrandPage
      question="Caisse"
      guide="Branchez le logiciel — les ventes mettent le stock à jour."
    >
      {params.connected ? (
        <p className="flash">
          Connexion créée
          {params.name ? ` « ${decodeURIComponent(params.name)} »` : ""}.
          Copiez l’adresse à coller dans la caisse, puis testez une vente ou
          branchez la vraie caisse.
        </p>
      ) : null}
      {params.tested ? (
        <p className="flash">
          Vente test reçue — regardez « Produits découverts » ci-dessous.
        </p>
      ) : null}
      {params.secret ? (
        <p className="flash">
          Code secret régénéré — mettez à jour la config côté caisse.
        </p>
      ) : null}
      {params.deleted ? <p className="flash">Lien caisse supprimé.</p> : null}
      {params.imported ? (
        <p className="flash">Import OK — validez les produits ci-dessous.</p>
      ) : null}
      {params.accepted ? (
        <p className="flash">
          {params.accepted} produit(s) ajouté(s) au catalogue.
        </p>
      ) : null}
      {params.ignored ? <p className="flash">Produits ignorés.</p> : null}
      {params.error === "name" ? (
        <p className="flash flash-warn">Nom de caisse requis.</p>
      ) : null}
      {params.error === "delete" ? (
        <p className="flash flash-warn">
          Pour supprimer, retapez exactement le nom du lien.
        </p>
      ) : null}
      {params.error === "missing" ? (
        <p className="flash flash-warn">Connexion introuvable.</p>
      ) : null}

      <div className="dash-card dash-card--dark hub-now">
        <p className="hub-now__eyebrow">À faire maintenant</p>
        <p className="hub-now__title">{inkTitle}</p>
        <p className="hub-now__detail">{inkDetail}</p>
        {pendingCount > 0 ? (
          <p className="hub-now__hint">Liste à valider juste en dessous.</p>
        ) : (
          <div className="hub-now__actions mt-3">
            <a href="/sales" className="btn-lime">
              Hors caisse
            </a>
          </div>
        )}
      </div>

      <Suspense
        fallback={
          <div className="dash-card dash-card--light">
            <p className="text-[14px]">Chargement…</p>
          </div>
        }
      >
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
          countIngredientIds={params.countIngredients ?? null}
        />
      </Suspense>
    </BrandPage>
  );
}
