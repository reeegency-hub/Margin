import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getCostPilotSnapshot } from "@/lib/cost-engine";
import { euro } from "@/lib/dashboard";
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DayFocus } from "@/components/home/DayFocus";
import { buildCostsFocuses } from "@/lib/home-focus";
import { PageTitleSync } from "@/components/PageTitle";
import { ModulePageHeader } from "@/components/ui/ModulePageHeader";
import { InvoiceImportPanel } from "@/components/costs/InvoiceImportPanel";

export const metadata: Metadata = {
  title: "Coûts",
  description:
    "Factures fournisseurs, hausses de prix, coût matière, pertes et négociation.",
};

function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "idle";
  children: ReactNode;
}) {
  return <span className={`costs-pill costs-pill--${tone}`}>{children}</span>;
}

export default async function CostsPage({
  searchParams,
}: {
  searchParams?: Promise<{ received?: string }>;
}) {
  const session = await requireSession();
  const rid = session.user.restaurantId;
  const sp = (await searchParams) || {};

  const [snapshot, suppliers, ingredients, recentReceipts] = await Promise.all([
    getCostPilotSnapshot(rid),
    prisma.supplier.findMany({
      where: { restaurantId: rid },
      orderBy: { name: "asc" },
    }),
    prisma.ingredient.findMany({
      where: { restaurantId: rid },
      orderBy: { name: "asc" },
      take: 80,
      select: {
        id: true,
        name: true,
        unit: true,
      },
    }),
    prisma.supplierReceipt.findMany({
      where: { restaurantId: rid },
      orderBy: { receivedAt: "desc" },
      take: 8,
      include: {
        supplier: true,
        lines: {
          include: { ingredient: { select: { name: true, unit: true } } },
        },
      },
    }),
  ]);

  let supplierList = suppliers;
  if (supplierList.length === 0) {
    const created = await prisma.supplier.create({
      data: { restaurantId: rid, name: "Mes fournisseurs" },
    });
    supplierList = [created];
  }

  const hikeCount = snapshot.hikesWeek.length;
  const focuses = buildCostsFocuses(snapshot);
  const foodReady = snapshot.topDishCosts.length > 0;
  const compareReady = snapshot.supplierCompare.length > 0;

  return (
    <div className="costs-page ds-stack">
      <PageTitleSync
        title="Coûts"
        guide="Factures → hausses → négocier. Matière = ventes + fiches + factures."
      />
      <ModulePageHeader
        title="Coûts"
        lead="Importez les factures, suivez les hausses, négociez. Les pertes en € sont ici après une vérification."
      />

      <DayFocus
        focuses={focuses}
        eyebrow="Coûts · à gérer"
        ariaLabel="Priorités Coûts"
      />

      <nav
        className="costs-page__tabs"
        aria-label="Sections Coûts"
        data-tour="costs-tabs"
      >
        <a href="#facture">Facture</a>
        <a href="#hausses">
          Hausses{hikeCount ? ` · ${hikeCount}` : ""}
        </a>
        <a href="#matiere">Matière</a>
        <a href="#pertes">Pertes</a>
        <a href="#negocier">Négocier</a>
      </nav>

      <div className="costs-page__stats" aria-label="Résumé">
        <div>
          <strong>{snapshot.pricedLineCount}</strong>
          <span>prix</span>
        </div>
        <div>
          <strong>{hikeCount}</strong>
          <span>hausses</span>
        </div>
        <div>
          <strong>{euro(snapshot.weeklyLoss.lossEur)}</strong>
          <span>pertes</span>
        </div>
        <div>
          <strong>{euro(snapshot.monthlySavingsPotential)}</strong>
          <span>à gagner</span>
        </div>
      </div>

      {sp.received ? (
        <p className="costs-page__flash" role="status">
          Facture importée.
        </p>
      ) : null}

      {/* ——— Facture ——— */}
      <section
        id="facture"
        className="costs-panel"
        data-tour="costs-invoice"
      >
        <header className="costs-panel__head">
          <span className="costs-panel__icon" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
              <path d="M14 3v5h5M9 13h6M9 17h4" />
            </svg>
          </span>
          <div className="costs-panel__titles">
            <h2>Facture</h2>
            <StatusPill tone={recentReceipts.length ? "ok" : "warn"}>
              {recentReceipts.length ? "Dernière OK" : "À importer"}
            </StatusPill>
          </div>
        </header>

        <InvoiceImportPanel
          suppliers={supplierList.map((s) => ({ id: s.id, name: s.name }))}
          ingredients={ingredients.map((ing) => ({
            id: ing.id,
            name: ing.name,
            unit: ing.unit,
          }))}
        />

        {recentReceipts.length ? (
          <ul className="costs-chips" aria-label="Dernières factures">
            {recentReceipts.slice(0, 4).map((r) => (
              <li key={r.id}>
                <strong>{r.supplier.name}</strong>
                <em>
                  {r.receivedAt.toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                  })}
                </em>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* ——— Hausses ——— */}
      <section id="hausses" className="costs-panel" data-tour="costs-hikes" data-guide-action="costs-hikes">
        <header className="costs-panel__head">
          <span className="costs-panel__icon" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M4 18l6-6 4 4 6-8" />
              <path d="M16 8h4v4" />
            </svg>
          </span>
          <div className="costs-panel__titles">
            <h2>Hausses</h2>
            <StatusPill tone={hikeCount ? "warn" : "ok"}>
              {hikeCount ? `${hikeCount} cette semaine` : "Rien à signaler"}
            </StatusPill>
          </div>
        </header>

        {snapshot.hikesWeek.length ? (
          <ul className="costs-rows">
            {snapshot.hikesWeek.map((h) => (
              <li key={`${h.ingredientId}-${h.at.toISOString()}`}>
                <div>
                  <strong>{h.name}</strong>
                  <span className="costs-rows__meta">
                    {h.previousPrice.toFixed(2)} → {h.newPrice.toFixed(2)} €
                  </span>
                </div>
                <em className="costs-rows__delta">+{h.deltaPct}%</em>
              </li>
            ))}
          </ul>
        ) : (
          <div className="costs-empty">
            <p>Aucune hausse ≥ 5 %</p>
          </div>
        )}
      </section>

      {/* ——— Matière ——— */}
      <section id="matiere" className="costs-panel">
        <header className="costs-panel__head">
          <span className="costs-panel__icon" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v4l3 2" />
            </svg>
          </span>
          <div className="costs-panel__titles">
            <h2>Matière</h2>
            <StatusPill tone={foodReady ? "ok" : "idle"}>
              {foodReady ? "Best-sellers" : "En attente"}
            </StatusPill>
          </div>
        </header>

        {foodReady ? (
          <ul className="costs-rows">
            {snapshot.topDishCosts.map((d) => (
              <li key={d.dishId}>
                <div>
                  <strong>{d.label}</strong>
                  <span className="costs-rows__meta">
                    {d.qty} vtes · PV {euro(d.salePrice)}
                  </span>
                </div>
                <em>
                  {d.foodCostPct != null ? `${d.foodCostPct}%` : "—"}
                </em>
              </li>
            ))}
          </ul>
        ) : (
          <div className="costs-empty">
            <p>
              Le coût matière apparaît après ventes caisse + fiches produit +
              factures importées.
            </p>
            <a href="#facture" className="costs-empty__cta">
              Importer une facture →
            </a>
          </div>
        )}
      </section>

      {/* ——— Pertes ——— */}
      <section id="pertes" className="costs-panel" data-guide-action="costs-losses">
        <header className="costs-panel__head">
          <span className="costs-panel__icon" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M4 20h16M7 20V10M12 20V4M17 20v-6" />
            </svg>
          </span>
          <div className="costs-panel__titles">
            <h2>Pertes</h2>
            <StatusPill
              tone={snapshot.weeklyLoss.needsInventory ? "warn" : "ok"}
            >
              {snapshot.weeklyLoss.needsInventory
                ? "Inventaire dû"
                : euro(snapshot.weeklyLoss.lossEur)}
            </StatusPill>
          </div>
        </header>

        {snapshot.weeklyLoss.topLosses.length ? (
          <ul className="costs-rows">
            {snapshot.weeklyLoss.topLosses.map((l) => (
              <li key={l.name}>
                <div>
                  <strong>{l.name}</strong>
                  <span className="costs-rows__meta">
                    −{l.qty} {l.unit}
                  </span>
                </div>
                <em>{euro(l.eur)}</em>
              </li>
            ))}
          </ul>
        ) : null}

        <Link href="/inventory" className="btn-lime costs-panel__cta">
          {snapshot.weeklyLoss.needsInventory
            ? "Lancer la vérification"
            : "Voir l’inventaire"}
        </Link>
      </section>

      {/* ——— Négocier ——— */}
      <section id="negocier" className="costs-panel" data-guide-action="negotiate">
        <header className="costs-panel__head">
          <span className="costs-panel__icon" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M7 10h10M7 14h6" />
              <path d="M4 6h16v12H4z" />
            </svg>
          </span>
          <div className="costs-panel__titles">
            <h2>Négocier</h2>
            <StatusPill tone={compareReady ? "warn" : "idle"}>
              {compareReady
                ? `${snapshot.supplierCompare.length} écarts`
                : "Mensuel"}
            </StatusPill>
          </div>
        </header>

        {compareReady ? (
          <ul className="costs-rows">
            {snapshot.supplierCompare.map((r) => (
              <li key={r.ingredientId}>
                <div>
                  <strong>{r.name}</strong>
                  <span className="costs-rows__meta">
                    {r.currentSupplier} → {r.cheapestSupplier}
                  </span>
                </div>
                <em className="costs-rows__delta">−{r.savingsPct}%</em>
              </li>
            ))}
          </ul>
        ) : (
          <div className="costs-empty">
            <p>2 tarifs catalogue = comparatif</p>
          </div>
        )}
      </section>
    </div>
  );
}
