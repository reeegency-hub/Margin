import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { euro } from "@/lib/dashboard";
import {
  CHANNEL_LABELS,
  getSalesByChannel,
  platformStatusLabel,
  deliveryOrderStatusLabel,
} from "@/lib/channels";
import { BrandPage } from "@/components/brand/BrandCard";
import { setDeliveryStatusAction } from "@/app/actions";
import { DeliveryIntegrationsPanel } from "@/components/delivery/DeliveryIntegrationsPanel";
import Link from "next/link";

const PLATFORMS = [
  { key: "uber_eats", label: "Uber Eats" },
  { key: "deliveroo", label: "Deliveroo" },
];

export default async function DeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{
    sold?: string;
    saved?: string;
    order?: string;
    connected?: string;
    driver?: string;
    msg?: string;
  }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const rid = session.user.restaurantId;

  for (const p of PLATFORMS) {
    await prisma.deliveryPlatformConnection.upsert({
      where: {
        restaurantId_platform: { restaurantId: rid, platform: p.key },
      },
      create: { restaurantId: rid, platform: p.key, status: "DISCONNECTED" },
      update: {},
    });
  }

  const [connections, outages, byChannel, drivers, deliveryOrders] =
    await Promise.all([
      prisma.deliveryPlatformConnection.findMany({
        where: { restaurantId: rid },
        orderBy: { platform: "asc" },
      }),
      prisma.platformOutage.findMany({
        where: { restaurantId: rid, endedAt: null },
      }),
      getSalesByChannel(rid),
      prisma.deliveryDriver.findMany({
        where: { restaurantId: rid },
        orderBy: { name: "asc" },
      }),
      prisma.deliveryOrder.findMany({
        where: { restaurantId: rid },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  const outage = outages[0];
  const offline = connections.find((c) => c.status !== "CONNECTED");
  const activeDrivers = drivers.filter((d) => d.isActive).length;
  const connectedCount = connections.filter(
    (c) => c.status === "CONNECTED"
  ).length;
  const channelTotal = byChannel.reduce((s, c) => s + c.amount, 0);
  const needsOnline = Boolean(outage || offline);

  const panelConnections = PLATFORMS.map((p) => {
    const c = connections.find((x) => x.platform === p.key);
    return {
      platform: p.key,
      label: p.label,
      status: c?.status ?? "DISCONNECTED",
      storeId: c?.storeId ?? null,
      hasKey: Boolean(c?.apiKeyEncrypted),
    };
  });

  const inkTitle = needsOnline
    ? outages.length > 0
      ? `${outages.length} coupure${outages.length > 1 ? "s" : ""}`
      : "Plateforme hors ligne"
    : connectedCount === 0
      ? "Livraison optionnelle"
      : "Plateformes OK";

  const inkDetail = needsOnline
    ? "Remettez en ligne Uber / Deliveroo si vous livrez aujourd’hui."
    : connectedCount === 0
      ? "Pas obligatoire pour le stock. Configurez Uber / Deliveroo seulement si vous les utilisez."
      : `${connectedCount}/${connections.length} connectée${
          connectedCount > 1 ? "s" : ""
        } · ${activeDrivers} livreur${activeDrivers !== 1 ? "s" : ""}.`;

  return (
    <BrandPage
      question="Livraison (optionnel)"
      guide="Uber / Deliveroo et livreurs si vous en avez. Pas le stock."
    >
      {params.saved ? <p className="flash">Clés enregistrées.</p> : null}
      {params.driver ? <p className="flash">Livreur ajouté.</p> : null}
      {params.connected ? (
        <p className="flash">
          {decodeURIComponent(params.msg || "Connexion OK")}
        </p>
      ) : null}

      <div className="dash-card dash-card--dark hub-now">
        <p className="hub-now__eyebrow">À faire maintenant</p>
        <p className="hub-now__title">{inkTitle}</p>
        <p className="hub-now__detail">{inkDetail}</p>
        <div className="hub-now__actions">
          {needsOnline ? (
            <form action={setDeliveryStatusAction}>
              <input
                type="hidden"
                name="platform"
                value={outage?.platform || offline?.platform}
              />
              <input type="hidden" name="status" value="CONNECTED" />
              <button type="submit" className="btn-lime">
                Remettre en ligne
              </button>
            </form>
          ) : (
            <Link href="/kiosks" className="btn-ghost">
              Voir la caisse
            </Link>
          )}
        </div>
      </div>

      <div className="status-strip">
        <div>
          <span>Coupures</span>
          <strong>{outages.length}</strong>
        </div>
        <div>
          <span>Plateformes</span>
          <strong>
            {connectedCount}/{connections.length}
          </strong>
        </div>
        <div>
          <span>Livreurs</span>
          <strong>{activeDrivers}</strong>
        </div>
        <div>
          <span>CA canaux</span>
          <strong>{euro(channelTotal)}</strong>
        </div>
      </div>

      <div className="phone-hide">
        <div className="dash-card dash-card--light">
          <p className="hub-section-title">Livraison</p>
          <p className="hub-section-lead mb-4">
            Uber, Deliveroo, livreurs — seulement si vous en avez.
          </p>
          <DeliveryIntegrationsPanel
            connections={panelConnections}
            drivers={drivers.map((d) => ({
              id: d.id,
              name: d.name,
              phone: d.phone,
              isActive: d.isActive,
            }))}
          />
        </div>
      </div>

      <aside className="phone-only stock-desktop-hint">
        <p className="stock-desktop-hint__title">Clés API & livreurs</p>
        <p className="stock-desktop-hint__body">
          Configurer Uber / Deliveroo et les livreurs se fait sur ordinateur.
          Ici : état des plateformes et remise en ligne.
        </p>
      </aside>

      {deliveryOrders.length ? (
        <div className="dash-card dash-card--light">
          <p className="hub-section-title">Commandes récentes</p>
          {deliveryOrders.map((o) => (
            <div key={o.id} className="supplier-row">
              <div className="supplier-row__name">
                #{o.externalOrderId.slice(-6)}
              </div>
              <div className="supplier-row__detail text-[var(--text-secondary-light)]">
                {CHANNEL_LABELS[o.platform] ?? o.platform}
              </div>
              <div className="supplier-row__amount">
                {deliveryOrderStatusLabel(o.status)}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="dash-card dash-card--light">
        <p className="hub-section-title">État des plateformes</p>
        {connections.map((c) => (
          <div key={c.id} className="supplier-row">
            <div className="supplier-row__name">
              {CHANNEL_LABELS[c.platform] ?? c.platform}
            </div>
            <div className="supplier-row__amount text-[var(--text-secondary-light)]">
              {platformStatusLabel(c.status)}
            </div>
          </div>
        ))}
      </div>

      <div className="phone-hide">
        <div className="dash-card dash-card--light">
          <p className="hub-section-title">Ventes par canal</p>
          {byChannel.map((c) => (
            <div
              key={c.channel}
              className="flex justify-between border-b border-[var(--border-dark)] py-3 last:border-0"
            >
              <span className="text-[14px]">{c.label}</span>
              <span className="tabular-nums text-[14px] font-semibold">
                {euro(c.amount)}
              </span>
            </div>
          ))}
          <Link href="/kiosks" className="btn-lime mt-6 inline-flex">
            Caisses & POS externe
          </Link>
        </div>
      </div>
    </BrandPage>
  );
}
