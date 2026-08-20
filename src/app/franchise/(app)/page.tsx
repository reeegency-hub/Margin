import Link from "next/link";
import { getDashboardMetrics, euro } from "@/lib/dashboard";
import { listNetworkStores } from "@/lib/franchise-network";
import { requireFranchiseSession } from "../actions";

export default async function FranchiseHomePage() {
  const session = await requireFranchiseSession();
  const networkId = session.user.networkId!;
  const stores = await listNetworkStores(networkId);

  const metrics = await Promise.all(
    stores.map(async (s) => {
      const m = await getDashboardMetrics(s.id);
      return {
        id: s.id,
        name: s.name,
        caToday: m.caToday,
        alertCount: m.alerts.length + m.critical.length,
        active: s.active,
      };
    })
  );

  const caToday = metrics.reduce((a, m) => a + m.caToday, 0);
  const alerts = metrics.reduce((a, m) => a + m.alertCount, 0);
  const activeStores = metrics.filter((m) => m.active).length;

  return (
    <div className="franchise-page">
      <header className="franchise-page-head">
        <p className="franchise-page-head__eyebrow">Réseau</p>
        <h1>Vue d’ensemble</h1>
        <p className="franchise-page-head__lead">
          KPIs agrégés sur {stores.length} boutique
          {stores.length > 1 ? "s" : ""}.
        </p>
      </header>

      <div className="franchise-kpi-grid">
        <div className="franchise-kpi">
          <p className="franchise-kpi__label">Ventes du jour</p>
          <p className="franchise-kpi__value">{euro(caToday)}</p>
        </div>
        <div className="franchise-kpi">
          <p className="franchise-kpi__label">Alertes</p>
          <p className="franchise-kpi__value">{alerts}</p>
        </div>
        <div className="franchise-kpi">
          <p className="franchise-kpi__label">Boutiques actives</p>
          <p className="franchise-kpi__value">
            {activeStores}/{stores.length}
          </p>
        </div>
      </div>

      <div className="franchise-page-head__row">
        <h2>Boutiques</h2>
        <div className="franchise-inline-actions">
          <Link href="/franchise/stores" className="franchise-btn franchise-btn--ghost">
            Toutes les boutiques
          </Link>
          {stores.length < 3 ? (
            <Link href="/franchise/stores/new" className="franchise-btn">
              Ajouter une boutique
            </Link>
          ) : null}
        </div>
      </div>

      <ul className="franchise-store-list">
        {metrics.map((m) => (
          <li key={m.id}>
            <Link
              href={`/franchise/stores/${m.id}`}
              className="franchise-store-row"
            >
              <div>
                <p className="franchise-store-row__name">{m.name}</p>
                <p className="franchise-store-row__meta">
                  {euro(m.caToday)} aujourd’hui
                  {m.alertCount > 0 ? ` · ${m.alertCount} alerte(s)` : ""}
                </p>
              </div>
              <span
                className={
                  m.alertCount > 0
                    ? "franchise-badge franchise-badge--warn"
                    : "franchise-badge franchise-badge--ok"
                }
              >
                {m.active ? "Active" : "Inactive"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
