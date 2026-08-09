import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin";
import { adminCreateStoreAction } from "@/app/actions";
import { PLANS } from "@/lib/plans";
import { Field, inputClass } from "@/components/ui";
import { getPosHealthSnapshot, POS_HEALTH_THRESHOLDS } from "@/lib/pos/health";
import { getChurnBreakdown } from "@/lib/stripe/recon";
import { STRIPE_GRACE_DAYS } from "@/lib/stripe/access";
import { getWhatsAppDeliveryStats } from "@/lib/whatsapp/metrics";
import { WHATSAPP_BATCH_MINUTES } from "@/lib/whatsapp/config";
import { getCatalogHealthForStores } from "@/lib/catalog/health";
import { FounderSubnav } from "@/components/admin/FounderSubnav";
import { FounderAcquisitionPanel } from "@/components/admin/FounderAcquisitionPanel";
import { MarketingHub } from "@/components/admin/MarketingHub";

function planLabel(plan: string | null | undefined) {
  return PLANS.find((p) => p.id === plan)?.name || plan || "—";
}

function planPrice(plan: string | null | undefined, period: string | null) {
  const p = PLANS.find((x) => x.id === plan);
  if (!p) return null;
  if (period === "yearly") {
    return `${Math.round(p.priceMonthly * 12 * 0.8)} €/an`;
  }
  return `${p.priceMonthly} €/mois`;
}

export default async function FounderAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    deleted?: string;
    error?: string;
  }>;
}) {
  const session = await requireAdminSession();
  if (!session) {
    redirect("/login?error=admin");
  }

  const params = await searchParams;

  const stores = await prisma.restaurant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: { select: { email: true }, take: 3 },
      externalPosConnections: {
        select: { id: true, status: true, lastOrderAt: true, vendor: true },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: { products: true, stockUnits: true, employees: true },
      },
    },
  });

  /** Commerce interne Ops — hors suivi clients */
  const clients = stores.filter((s) => s.name !== "Margin Ops");
  const activeClients = clients.filter((s) => s.active);
  const byPlan = {
    commerce: activeClients.filter((s) => s.plan === "commerce" || s.plan === "boutique")
      .length,
    reseau: activeClients.filter((s) => s.plan === "reseau").length,
    none: activeClients.filter((s) => !s.plan).length,
  };

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const posHealthRows = await prisma.posWebhookEvent.groupBy({
    by: ["restaurantId", "status"],
    where: { receivedAt: { gte: since7d } },
    _count: { _all: true },
  });
  const lastApplied = await prisma.posWebhookEvent.findMany({
    where: { status: "APPLIED" },
    orderBy: { appliedAt: "desc" },
    distinct: ["restaurantId"],
    select: {
      restaurantId: true,
      appliedAt: true,
      externalEventId: true,
      vendor: true,
    },
  });
  const lastRecons = await prisma.posReconciliationRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      restaurantId: true,
      dayKey: true,
      kind: true,
      status: true,
      deadCount: true,
      failedCount: true,
      missingCount: true,
      backfilledCount: true,
      createdAt: true,
    },
  });
  const reconByStore = new Map<string, (typeof lastRecons)[number]>();
  for (const row of lastRecons) {
    if (!reconByStore.has(row.restaurantId)) {
      reconByStore.set(row.restaurantId, row);
    }
  }

  const serviceHealth = await getPosHealthSnapshot(24);
  const churn30 = await getChurnBreakdown(30);
  const waStats = await getWhatsAppDeliveryStats(24);
  const catalogHealth = await getCatalogHealthForStores(stores.map((s) => s.id));
  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));
  const catalogAtRisk = [...catalogHealth.values()].filter(
    (h) => h.risk === "high" || h.risk === "medium"
  ).length;
  const [stripeFailedEvents, stripeDeadEvents, lastStripeRecon, pastDueCount, prospects, influencers] =
    await Promise.all([
      prisma.stripeWebhookEvent.count({ where: { status: "FAILED" } }),
      prisma.stripeWebhookEvent.count({ where: { status: "DEAD" } }),
      prisma.stripeReconciliationRun.findFirst({
        orderBy: { createdAt: "desc" },
      }),
      prisma.restaurant.count({
        where: {
          OR: [{ stripeStatus: "past_due" }, { stripeStatus: "unpaid" }],
          active: true,
          NOT: { name: "Margin Ops" },
        },
      }),
      prisma.marketingProspect.findMany({
        orderBy: [{ nextFollowUpAt: "asc" }, { createdAt: "desc" }],
        take: 200,
      }),
      prisma.marketingInfluencer.findMany({
        orderBy: [{ fitScore: "desc" }, { createdAt: "desc" }],
        take: 200,
      }),
    ]);

  const now = Date.now();
  const dueProspects = prospects.filter(
    (p) =>
      p.nextFollowUpAt &&
      p.nextFollowUpAt.getTime() <= now &&
      !["won", "lost", "paused"].includes(p.status)
  ).length;
  const prospectCount = prospects.length;
  const influencerCount = influencers.length;

  const healthByStore = new Map<
    string,
    {
      applied: number;
      failed: number;
      dead: number;
      dup: number;
      lastOk?: Date | null;
      lastEvent?: string;
    }
  >();
  for (const row of posHealthRows) {
    const cur = healthByStore.get(row.restaurantId) || {
      applied: 0,
      failed: 0,
      dead: 0,
      dup: 0,
    };
    const n = row._count._all;
    if (row.status === "APPLIED") cur.applied += n;
    else if (row.status === "FAILED") cur.failed += n;
    else if (row.status === "DEAD") cur.dead += n;
    else if (row.status === "IGNORED_DUP") cur.dup += n;
    healthByStore.set(row.restaurantId, cur);
  }
  for (const row of lastApplied) {
    const cur = healthByStore.get(row.restaurantId) || {
      applied: 0,
      failed: 0,
      dead: 0,
      dup: 0,
    };
    cur.lastOk = row.appliedAt;
    cur.lastEvent = row.externalEventId;
    healthByStore.set(row.restaurantId, cur);
  }

  return (
    <div className="admin-page founder-page">
      <header className="module-page-header mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="brand-eyebrow">Margin · Fondateur</p>
          <h1 className="module-page-title">Espace fondateur</h1>
          <p className="module-page-lead">
            Crée et configure les comptes clients · suivi des plans ·{" "}
            {session.user.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className="btn-ghost">
            Retour app
          </Link>
        </div>
      </header>

      <FounderSubnav current="/admin" />

      <div className="flash mb-4" role="status">
        Hub Marketing : playbook ICP · cold email 3 touches · micro-influenceurs
        (envoi manuel copier / mailto). Onglets ci-dessous — ou{" "}
        <Link href="/admin/marketing" className="underline font-semibold">
          /admin/marketing
        </Link>
        .
      </div>

      <FounderAcquisitionPanel
        prospectCount={prospectCount}
        dueCount={dueProspects}
        influencerCount={influencerCount}
      />

      <section className="mb-8 space-y-3" aria-label="Hub marketing">
        <h2 className="text-lg font-semibold">Outils acquisition</h2>
        <MarketingHub
          initialTab="playbook"
          dueCount={dueProspects}
          prospects={prospects.map((p) => ({
            id: p.id,
            email: p.email,
            contactName: p.contactName,
            businessName: p.businessName,
            city: p.city,
            segment: p.segment,
            posVendor: p.posVendor,
            status: p.status,
            sequenceStep: p.sequenceStep,
            lastContactedAt: p.lastContactedAt?.toISOString() ?? null,
            nextFollowUpAt: p.nextFollowUpAt?.toISOString() ?? null,
            notes: p.notes,
          }))}
          influencers={influencers.map((i) => ({
            id: i.id,
            handle: i.handle,
            displayName: i.displayName,
            platform: i.platform,
            profileUrl: i.profileUrl,
            email: i.email,
            city: i.city,
            niche: i.niche,
            followers: i.followers,
            engagementPct: i.engagementPct,
            fitScore: i.fitScore,
            status: i.status,
            dealType: i.dealType,
            notes: i.notes,
            lastContactedAt: i.lastContactedAt?.toISOString() ?? null,
          }))}
        />
      </section>

      {params.created ? (
        <p className="flash mb-4">
          Client créé : {decodeURIComponent(params.created)}
        </p>
      ) : null}
      {params.deleted ? (
        <p className="flash mb-4">Client supprimé.</p>
      ) : null}
      {params.error === "email" ? (
        <p className="flash flash-warn mb-4">Cet email existe déjà.</p>
      ) : null}
      {params.error === "missing" ? (
        <p className="flash flash-warn mb-4">
          Nom, email et mot de passe requis.
        </p>
      ) : null}

      {/* KPIs clients */}
      <div className="founder-kpis mb-6">
        <div className="founder-kpi">
          <p className="founder-kpi__label">Clients actifs</p>
          <p className="founder-kpi__value">{activeClients.length}</p>
          </div>
        <div className="founder-kpi">
          <p className="founder-kpi__label">Commerce</p>
          <p className="founder-kpi__value">{byPlan.commerce}</p>
        </div>
        <div className="founder-kpi">
          <p className="founder-kpi__label">Franchise</p>
          <p className="founder-kpi__value">{byPlan.reseau}</p>
        </div>
        <div className="founder-kpi">
          <p className="founder-kpi__label">Paiement en retard</p>
          <p className="founder-kpi__value">{pastDueCount}</p>
        </div>
      </div>

      {/* Créer un client — premier */}
      <div className="dash-card dash-card--dark space-y-4 mb-6" id="nouveau">
        <h2 className="text-lg font-semibold">Nouveau client</h2>
        <p className="text-[13px] opacity-70">
          Crée le commerce + le login gérant. Tu configures ensuite plan, caisse,
          WhatsApp.
        </p>
        <form
          action={adminCreateStoreAction}
          className="grid gap-3 md:grid-cols-2"
        >
          <Field label="Nom du commerce">
            <input
              name="name"
              className={inputClass}
              placeholder="Épicerie Bellevue"
              required
            />
          </Field>
          <Field label="Email gérant">
            <input
              name="email"
              type="email"
              className={inputClass}
              placeholder="gerant@commerce.fr"
              required
            />
          </Field>
          <Field label="Mot de passe temporaire">
            <input
              name="password"
              type="text"
              className={inputClass}
              placeholder="MotDePasseFort!"
              required
              minLength={8}
            />
          </Field>
          <Field label="WhatsApp (optionnel)">
            <input name="whatsapp" className={inputClass} placeholder="+336…" />
          </Field>
          <Field label="Plan">
            <select name="plan" className={inputClass} defaultValue="commerce">
              {PLANS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.priceMonthly} €/mois
                </option>
              ))}
            </select>
          </Field>
          <Field label="Facturation">
            <select
              name="billingPeriod"
              className={inputClass}
              defaultValue="monthly"
            >
              <option value="monthly">Mensuel</option>
              <option value="yearly">Annuel (−20 %)</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" name="skipOnboarding" value="1" defaultChecked />
            Skip onboarding (livraison clé en main)
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name="configureNow"
              value="1"
              defaultChecked
            />
            Ouvrir la fiche après création
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="btn-lime">
              Créer le compte client
            </button>
          </div>
        </form>
      </div>

      {/* Suivi clients */}
      <div className="dash-card dash-card--dark mb-6 overflow-x-auto">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Clients & plans</h2>
            <p className="text-[13px] opacity-70">
              {clients.length} client(s) · clique Configurer pour login, plan,
              caisse, WA
            </p>
          </div>
          <a href="#nouveau" className="btn-ghost" style={{ fontSize: 13 }}>
            + Nouveau
          </a>
        </div>
        {clients.length === 0 ? (
          <p className="text-[14px] opacity-70">
            Aucun client pour l’instant. Crée le premier commerce ci-dessus.
          </p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Plan</th>
                <th>Statut</th>
                <th>Login</th>
                <th>Caisse</th>
                <th>Catalogue</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {clients.map((s) => {
                const pos = s.externalPosConnections[0];
                const caisseOk =
                  Boolean(pos?.lastOrderAt) || pos?.status === "CONNECTED";
                const price = planPrice(s.plan, s.billingPeriod);
                const stripe = (s.stripeStatus || "none").toLowerCase();
                const h = catalogHealth.get(s.id);
                return (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      <div className="text-[11px] opacity-50">
                        {s.createdAt.toLocaleDateString("fr-FR")}
                        {s.whatsappTo ? ` · WA ${s.whatsappTo}` : ""}
                      </div>
                    </td>
                    <td>
                      <strong>{planLabel(s.plan)}</strong>
                      {price ? (
                        <div className="text-[11px] opacity-60">{price}</div>
                      ) : null}
                      <div className="text-[11px] opacity-50">
                        Stripe · {stripe}
                        {s.churnType ? ` · churn ${s.churnType}` : ""}
                      </div>
                    </td>
                    <td>
                      {!s.active ? (
                        <span className="admin-badge is-warn">Inactif</span>
                      ) : stripe === "past_due" || stripe === "unpaid" ? (
                        <span className="admin-badge is-warn">Retard paiement</span>
                      ) : stripe === "active" || stripe === "trialing" ? (
                        <span className="admin-badge">Payant</span>
                      ) : (
                        <span className="admin-badge is-muted">Pilote / manuel</span>
                      )}
                      {!s.onboardingCompletedAt ? (
                        <div className="mt-1">
                          <span className="admin-badge is-warn">Onboarding</span>
                        </div>
                      ) : null}
                    </td>
                    <td className="text-[13px]">{s.users[0]?.email || "—"}</td>
                    <td>
                      {pos ? (
                        <span
                          className={`admin-badge${caisseOk ? "" : " is-warn"}`}
                        >
                          {caisseOk
                            ? `OK · ${pos.vendor}`
                            : `Attente · ${pos.vendor}`}
                        </span>
                      ) : (
                        <span className="admin-badge is-muted">Non</span>
                      )}
                    </td>
                    <td>
                      {s._count.products} prod.
                      {h ? (
                        <div className="text-[11px] opacity-70">
                          Santé {h.grade}
                          {h.risk !== "low" ? (
                            <span className="admin-badge is-warn ml-1">
                              {h.risk}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <Link
                        href={`/admin/stores/${s.id}`}
                        className="btn-ghost"
                        style={{ padding: "6px 12px", fontSize: 12 }}
                      >
                        Configurer
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Santé technique repliée */}
      <details className="founder-tech dash-card dash-card--dark mb-6">
        <summary className="founder-tech__summary">
          Santé technique (caisse, Stripe, WhatsApp, catalogue)
        </summary>
        <div className="founder-tech__body space-y-6 pt-4">
          <section>
            <h3 className="mb-2 text-[15px] font-semibold">Sync caisse · 24 h</h3>
            <p className="mb-3 text-[13px] opacity-70">
              Seuils erreur ≥{POS_HEALTH_THRESHOLDS.errorRatePctWarn}% · p95 ≥
              {POS_HEALTH_THRESHOLDS.latencyP95MsWarn}ms
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-[12px] opacity-60">Events</p>
                <p className="text-xl font-semibold">
                  {serviceHealth.totals.received}
                </p>
              </div>
              <div>
                <p className="text-[12px] opacity-60">Succès</p>
                <p className="text-xl font-semibold">
                  {serviceHealth.rates.successRatePct}%
                </p>
              </div>
              <div>
                <p className="text-[12px] opacity-60">Erreur</p>
                <p className="text-xl font-semibold">
                  {serviceHealth.rates.errorRatePct}%
                </p>
              </div>
              <div>
                <p className="text-[12px] opacity-60">Latence p95</p>
                <p className="text-xl font-semibold">
                  {serviceHealth.latencyMs.p95 != null
                    ? `${serviceHealth.latencyMs.p95} ms`
                    : "—"}
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[15px] font-semibold">Billing · 30 j</h3>
            <p className="mb-2 text-[13px] opacity-70">
              Grâce {STRIPE_GRACE_DAYS} j · churn vol. {churn30.voluntary} /
              invol. {churn30.involuntary} · FAILED {stripeFailedEvents} · DEAD{" "}
              {stripeDeadEvents}
              {lastStripeRecon
                ? ` · dernière recon ${lastStripeRecon.status}`
                : ""}
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-[15px] font-semibold">WhatsApp · 24 h</h3>
            <p className="mb-2 text-[13px] opacity-70">
              Batch {WHATSAPP_BATCH_MINUTES} min · envoyés {waStats.total} ·
              délivrés{" "}
              {waStats.deliveryRatePct != null
                ? `${waStats.deliveryRatePct}%`
                : "—"}{" "}
              · plafond {waStats.limitSkipped}
              {waStats.byTenant[0] ? (
                <>
                  {" "}
                  · top{" "}
                  {storeNameById.get(waStats.byTenant[0].restaurantId) || "—"}
                </>
              ) : null}
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-[15px] font-semibold">Catalogue</h3>
            <p className="text-[13px] opacity-70">
              {catalogAtRisk} commerce(s) à risque sur {stores.length}
            </p>
          </section>

          <section className="overflow-x-auto">
            <h3 className="mb-2 text-[15px] font-semibold">
              Sync caisse · 7 jours
            </h3>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Commerce</th>
                  <th>Dernier OK</th>
                  <th>APPLIED</th>
                  <th>FAILED</th>
                  <th>DEAD</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((s) => {
                  const h = healthByStore.get(s.id);
                  const anomalies = (h?.failed || 0) + (h?.dead || 0);
                  return (
                    <tr key={`pos-${s.id}`}>
                      <td>
                        <strong>{s.name}</strong>
                        {anomalies > 0 ? (
                          <span className="admin-badge is-warn ml-2">
                            {anomalies}
                          </span>
                        ) : null}
                      </td>
                      <td className="text-[12px]">
                        {h?.lastOk ? h.lastOk.toLocaleString("fr-FR") : "—"}
                      </td>
                      <td>{h?.applied ?? 0}</td>
                      <td>{h?.failed ?? 0}</td>
                      <td>{h?.dead ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="overflow-x-auto">
            <h3 className="mb-2 text-[15px] font-semibold">Réconciliation</h3>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Commerce</th>
                  <th>Jour</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>DEAD/FAIL</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((s) => {
                  const r = reconByStore.get(s.id);
                  if (!r) {
                    return (
                      <tr key={`recon-${s.id}`}>
                        <td>{s.name}</td>
                        <td colSpan={4} className="opacity-50">
                          Pas encore de run
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={`recon-${s.id}`}>
                      <td>
                        <strong>{s.name}</strong>
                      </td>
                      <td>{r.dayKey}</td>
                      <td>{r.kind}</td>
                      <td>
                        {r.status === "ALERT" || r.status === "ERROR" ? (
                          <span className="admin-badge is-warn">{r.status}</span>
                        ) : (
                          r.status
                        )}
                      </td>
                      <td>
                        {r.deadCount}/{r.failedCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
      </details>
    </div>
  );
}
