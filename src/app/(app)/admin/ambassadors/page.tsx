import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin";
import { FounderSubnav } from "@/components/admin/FounderSubnav";
import { CopyTextButton } from "@/components/admin/CopyTextButton";
import { getFounderAmbassadorDashboard } from "@/lib/ambassador-stats";
import { REFERRAL_STATUS_LABEL } from "@/lib/crm/activity";
import { euro } from "@/lib/dashboard";

export default async function AdminAmbassadorsPage() {
  const session = await requireAdminSession();
  if (!session) redirect("/login?error=admin");

  const { ambassadors, totals } = await getFounderAmbassadorDashboard();

  return (
    <div className="admin-page founder-page mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="brand-eyebrow">Margin · Fondateur</p>
          <h1 className="module-page-title">Ambassadeurs</h1>
          <p className="module-page-lead">
            Codes parrainage, magasins apportés, prospects CRM et commissions
            estimées — {session.user.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/partner/login" className="btn-ghost">
            Login ambassadeur
          </Link>
          <Link href="/" className="btn-ghost">
            Retour app
          </Link>
        </div>
      </header>

      <FounderSubnav current="/admin/ambassadors" />

      <div className="founder-kpis">
        <div className="founder-kpi">
          <p className="founder-kpi__label">Ambassadeurs</p>
          <p className="founder-kpi__value">{totals.ambassadors}</p>
        </div>
        <div className="founder-kpi">
          <p className="founder-kpi__label">Magasins apportés</p>
          <p className="founder-kpi__value">{totals.stores}</p>
        </div>
        <div className="founder-kpi">
          <p className="founder-kpi__label">Actifs payants</p>
          <p className="founder-kpi__value">{totals.activeStores}</p>
        </div>
        <div className="founder-kpi">
          <p className="founder-kpi__label">Commission est.</p>
          <p className="founder-kpi__value">{euro(totals.commissionCents / 100)}</p>
        </div>
      </div>

      <div className="founder-kpis">
        <div className="founder-kpi">
          <p className="founder-kpi__label">Ambassadeurs actifs</p>
          <p className="founder-kpi__value">{totals.activeAmbassadors}</p>
        </div>
        <div className="founder-kpi">
          <p className="founder-kpi__label">Prospects CRM</p>
          <p className="founder-kpi__value">{totals.prospects}</p>
        </div>
      </div>

      {!ambassadors.length ? (
        <div className="dash-card dash-card--dark">
          <p className="module-page-lead">
            Aucun ambassadeur. Créez-en un avec{" "}
            <code>npx tsx scripts/create-ambassador.ts</code>
          </p>
        </div>
      ) : (
        ambassadors.map((a) => (
          <section key={a.id} className="dash-card dash-card--dark space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="brand-eyebrow">
                  {a.status} · {a.type.replace(/_/g, " ")} · {a.storeCount} magasin(s)
                </p>
                <h2 className="text-xl font-bold tracking-tight">{a.name}</h2>
                <p className="module-page-lead">{a.email}</p>
              </div>
              <div className="text-right">
                <p className="founder-kpi__label">Commission est.</p>
                <p className="text-2xl font-extrabold tracking-tight">
                  {euro(a.commissionCents / 100)}
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="founder-kpi__label">Code parrainage</p>
                <p className="mt-1 font-mono text-lg font-bold text-[#e6f8aa]">
                  {a.referralCode ?? "—"}
                </p>
                {a.referralCode ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <CopyTextButton text={a.referralCode} label="Copier code" />
                    {a.signupUrl ? (
                      <CopyTextButton
                        text={a.signupUrl}
                        label="Copier lien signup"
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="founder-kpi__label">Pipeline CRM</p>
                <p className="mt-2 text-sm opacity-80">
                  {a.prospectCount} prospects · {a.prospectsOpen} en cours
                </p>
                <p className="mt-1 text-sm opacity-80">
                  {a.activeStores} magasin(s) actif(s) payant(s)
                </p>
                <Link href="/partner/login" className="btn-ghost mt-3 inline-flex text-sm">
                  Ouvrir espace ambassadeur →
                </Link>
              </div>
            </div>

            {a.stores.length ? (
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Magasin</th>
                      <th>Login</th>
                      <th>Statut filleul</th>
                      <th>Stripe</th>
                      <th>Produits</th>
                      <th>Facture</th>
                      <th>Comm. %</th>
                      <th>Comm. est.</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {a.stores.map((s) => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td className="text-sm opacity-80">{s.email ?? "—"}</td>
                        <td>
                          <span className="admin-badge">
                            {REFERRAL_STATUS_LABEL[s.referralStatus as keyof typeof REFERRAL_STATUS_LABEL] ?? s.referralStatus}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`admin-badge${
                              s.stripeStatus === "active" ? "" : " is-warn"
                            }`}
                          >
                            {s.stripeStatus ?? "none"}
                          </span>
                        </td>
                        <td>{s.productCount}</td>
                        <td>
                          {s.lastInvoiceAmountCents
                            ? euro(s.lastInvoiceAmountCents / 100)
                            : "—"}
                        </td>
                        <td>{s.commissionPercent} %</td>
                        <td>{euro(s.commissionCents / 100)}</td>
                        <td>
                          <Link
                            href={`/admin/stores/${s.id}`}
                            className="btn-ghost text-sm"
                          >
                            Config →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm opacity-70">
                Aucun magasin lié — création via espace ambassadeur ou{" "}
                <code>link-ambassador-referral.ts</code>
              </p>
            )}
          </section>
        ))
      )}
    </div>
  );
}
