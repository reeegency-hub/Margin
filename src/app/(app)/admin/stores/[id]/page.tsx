import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin";
import { PLANS } from "@/lib/plans";
import { Field, inputClass } from "@/components/ui";
import {
  adminUpdateStoreAction,
  adminResetPasswordAction,
  adminEnsurePosAction,
  adminSeedTeamAction,
  adminDeleteStoreAction,
} from "@/app/actions";
import { StripePortalButton } from "@/components/admin/StripePortalButton";
import { FounderSubnav } from "@/components/admin/FounderSubnav";
import { getStoreHealth, HEALTH_RISK_LABEL } from "@/lib/admin/store-health";
import { euro } from "@/lib/dashboard";

export default async function AdminStorePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireAdminSession();
  if (!session) redirect("/login?error=admin");

  const { id } = await params;
  const q = await searchParams;

  const store = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      users: { orderBy: { createdAt: "asc" }, take: 5 },
      externalPosConnections: { orderBy: { createdAt: "desc" }, take: 3 },
      employees: { where: { active: true }, orderBy: { name: "asc" } },
      _count: {
        select: { products: true, stockUnits: true,
          employees: true,
        },
      },
    },
  });

  if (!store) {
    redirect("/admin?error=missing");
  }

  const [health, timeline] = await Promise.all([
    getStoreHealth(id),
    prisma.activityLog.findMany({
      where: { restaurantId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const pos = store.externalPosConnections[0];
  const baseUrl = (
    process.env.NEXTAUTH_URL ||
    process.env.WEBHOOK_BASE_URL ||
    "http://localhost:3020"
  ).replace(/\/$/, "");
  const webhookUrl = pos
    ? `${baseUrl}/api/webhooks/pos/${pos.id}`
    : null;
  const webhookUrlV1 = pos
    ? `${baseUrl}/api/v1/webhooks/pos/${pos.vendor === "tiller" ? "sumup" : pos.vendor}?connectionId=${pos.id}`
    : null;

  return (
    <div className="admin-page space-y-6">
      <header className="module-page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="brand-eyebrow">Fondateur · Client</p>
          <h1 className="module-page-title">{store.name}</h1>
          <p className="module-page-lead">
            Configurer compte, plan, caisse, WhatsApp
          </p>
        </div>
        <Link href="/admin" className="btn-ghost">
          ← Clients
        </Link>
      </header>

      <FounderSubnav current="/admin" />

      {q.saved ? <p className="flash">Commerce enregistré.</p> : null}
      {q.password ? <p className="flash">Mot de passe mis à jour.</p> : null}
      {q.pos ? <p className="flash">Lien caisse mis à jour.</p> : null}
      {q.team ? <p className="flash">Équipe stub créée.</p> : null}
      {q.error === "password" ? (
        <p className="flash flash-warn">Mot de passe trop court (8+).</p>
      ) : null}
      {q.error === "delete" ? (
        <p className="flash flash-warn">
          Pour supprimer, retapez exactement le nom du commerce.
        </p>
      ) : null}

      <div className="dash-card dash-card--dark space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Santé client</h2>
            <p className="text-[13px] opacity-70">{health.headline}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-extrabold">{health.score}</p>
            <span
              className={`admin-badge${health.risk === "healthy" ? "" : " is-warn"}`}
            >
              {HEALTH_RISK_LABEL[health.risk]} · {health.grade}
            </span>
          </div>
        </div>
        <div className="grid gap-2 text-[13px] opacity-80 md:grid-cols-3">
          <p>
            Dernière connexion :{" "}
            {health.lastLoginAt
              ? health.lastLoginAt.toLocaleDateString("fr-FR")
              : "—"}
          </p>
          <p>
            Dernière vente :{" "}
            {health.lastSaleAt
              ? health.lastSaleAt.toLocaleDateString("fr-FR")
              : "—"}
          </p>
          <p>
            Dernière caisse :{" "}
            {health.lastPosOrderAt
              ? health.lastPosOrderAt.toLocaleDateString("fr-FR")
              : "—"}
          </p>
          {health.mrrCents != null ? (
            <p>MRR estimé : {euro(health.mrrCents / 100)}</p>
          ) : null}
          {store.churnType ? (
            <p className="text-[#ffb4b4]">
              Churn {store.churnType}
              {store.churnedAt
                ? ` · ${store.churnedAt.toLocaleDateString("fr-FR")}`
                : ""}
            </p>
          ) : null}
          {store.paymentFailedAt ? (
            <p className="text-[#ffb4b4]">
              Échec paiement ·{" "}
              {store.paymentFailedAt.toLocaleDateString("fr-FR")}
            </p>
          ) : null}
        </div>
        {health.signals.length ? (
          <ul className="text-[13px] space-y-1 border-t border-white/10 pt-3">
            {health.signals.map((sig) => (
              <li key={sig.id}>
                <span
                  className={
                    sig.severity === "critical"
                      ? "text-[#ffb4b4]"
                      : sig.severity === "warn"
                        ? "text-[#ffe0a3]"
                        : "opacity-70"
                  }
                >
                  {sig.label}
                  {sig.detail ? ` — ${sig.detail}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {timeline.length ? (
        <div className="dash-card dash-card--dark space-y-3">
          <h2 className="text-lg font-semibold">Timeline</h2>
          {timeline.map((ev) => (
            <div
              key={ev.id}
              className="flex flex-wrap justify-between gap-2 border-t border-white/10 pt-2 first:border-0 first:pt-0 text-[13px]"
            >
              <div>
                <strong>{ev.summary}</strong>
                <p className="opacity-60">{ev.kind}</p>
              </div>
              <span className="opacity-50">
                {ev.createdAt.toLocaleString("fr-FR")}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <form
        action={adminUpdateStoreAction}
        className="dash-card dash-card--dark grid gap-3 md:grid-cols-2"
      >
        <input type="hidden" name="restaurantId" value={store.id} />
        <h2 className="md:col-span-2 text-lg font-semibold">Identité & offre</h2>
        <Field label="Nom du commerce">
          <input
            name="name"
            className={inputClass}
            defaultValue={store.name}
            required
          />
        </Field>
        <Field label="Timezone">
          <input
            name="timezone"
            className={inputClass}
            defaultValue={store.timezone}
          />
        </Field>
        <Field label="WhatsApp commerce">
          <input
            name="whatsappTo"
            className={inputClass}
            defaultValue={store.whatsappTo || ""}
            placeholder="+336…"
          />
        </Field>
        <Field label="Plan">
          <select
            name="plan"
            className={inputClass}
            defaultValue={store.plan || "commerce"}
          >
            {PLANS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Facturation">
          <select
            name="billingPeriod"
            className={inputClass}
            defaultValue={store.billingPeriod || "monthly"}
          >
            <option value="monthly">Mensuel</option>
            <option value="yearly">Annuel</option>
          </select>
        </Field>
        <Field label="Stripe">
          <input
            className={inputClass}
            readOnly
            value={`${store.stripeStatus || "none"} · ${store.stripeCustomerId || "pas de customer"}`}
          />
        </Field>
        {store.stripeCustomerId ? (
          <div className="md:col-span-2">
            <StripePortalButton restaurantId={store.id} />
          </div>
        ) : null}
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            name="active"
            value="1"
            defaultChecked={store.active}
          />
          Commerce actif
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" name="completeOnboarding" value="1" />
          Marquer onboarding terminé
        </label>
        <label className="flex items-center gap-2 text-[13px] md:col-span-2">
          <input type="checkbox" name="reopenOnboarding" value="1" />
          Rouvrir l’onboarding (commerçant devra le refaire)
        </label>
        <div className="md:col-span-2">
          <button type="submit" className="btn-lime">
            Enregistrer
          </button>
        </div>
      </form>

      <div className="dash-card dash-card--dark space-y-3">
        <h2 className="text-lg font-semibold">Accès gérant</h2>
        <p className="text-[13px] opacity-70">
          {store.users.map((u) => u.email).join(", ") || "Aucun utilisateur"}
        </p>
        <form
          action={adminResetPasswordAction}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="restaurantId" value={store.id} />
          <Field label="Nouveau mot de passe temporaire">
            <input
              name="password"
              type="text"
              className={inputClass}
              minLength={8}
              required
              placeholder="MotDePasseFort!"
            />
          </Field>
          <button type="submit" className="btn-ghost">
            Réinitialiser
          </button>
        </form>
        <p className="text-[12px] opacity-60">
          Remettez ce mot de passe au commerçant, puis demandez-lui de le
          changer.
        </p>
      </div>

      <div className="dash-card dash-card--dark space-y-3">
        <h2 className="text-lg font-semibold">Caisse (webhook)</h2>
        {pos ? (
          <div className="space-y-2 text-[13px]">
            <p>
              Vendor : <strong>{pos.vendor}</strong> · statut {pos.status}
            </p>
            <p className="break-all opacity-80">
              URL : <code>{webhookUrl}</code>
            </p>
            {webhookUrlV1 ? (
              <p className="break-all opacity-80">
                URL v1 : <code>{webhookUrlV1}</code>
              </p>
            ) : null}
            <p className="break-all opacity-80">
              Header : <code>x-webhook-secret</code>
            </p>
            <p className="break-all opacity-80">
              Secret : <code>{pos.webhookSecret}</code>
            </p>
          </div>
        ) : (
          <p className="text-[13px] opacity-70">Aucune caisse créée.</p>
        )}
        <form
          action={adminEnsurePosAction}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="restaurantId" value={store.id} />
          <Field label="Logiciel">
            <select
              name="vendor"
              className={inputClass}
              defaultValue={pos?.vendor || "generic"}
            >
              <option value="generic">Générique / autre</option>
              <option value="zelty">Zelty</option>
              <option value="cashpad">Cashpad</option>
              <option value="tiller">Tiller</option>
              <option value="laddition">L’Addition</option>
            </select>
          </Field>
          <button type="submit" className="btn-ghost">
            {pos ? "Régénérer secret" : "Créer lien caisse"}
          </button>
        </form>
      </div>

      <div className="dash-card dash-card--dark space-y-3">
        <h2 className="text-lg font-semibold">Catalogue & équipe</h2>
        <p className="text-[13px] opacity-70">
          {store._count.products} produits · {store._count.stockUnits} stock ·{" "}
          {store._count.employees} employés
        </p>
        <ul className="text-[13px] opacity-80">
          {store.employees.slice(0, 8).map((e) => (
            <li key={e.id}>
              {e.name} ({e.role})
            </li>
          ))}
        </ul>
        <form action={adminSeedTeamAction}>
          <input type="hidden" name="restaurantId" value={store.id} />
          <button type="submit" className="btn-ghost">
            Créer stubs équipe (si vide)
          </button>
        </form>
      </div>

      <form
        action={adminDeleteStoreAction}
        className="dash-card dash-card--dark space-y-3"
      >
        <h2 className="text-lg font-semibold">Zone dangereuse</h2>
        <input type="hidden" name="restaurantId" value={store.id} />
        <Field label={`Tapez « ${store.name} » pour supprimer`}>
          <input name="confirm" className={inputClass} autoComplete="off" />
        </Field>
        <button type="submit" className="btn-ghost">
          Supprimer le commerce
        </button>
      </form>
    </div>
  );
}
