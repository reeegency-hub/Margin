"use client";

import { useMemo, useState } from "react";
import { euro, pctDelta } from "@/lib/dashboard";
import { StatCard, SegmentedControl, PillButton } from "@/components/ui";
import type { DashboardAlert } from "./dashboard-alert";
import { DayFocus, type DayFocusItem } from "@/components/home/DayFocus";

export type CostHomeKpis = {
  hikesToday: number;
  hikesWeek: number;
  lossEur: number;
  needsInventory: boolean;
  avgFoodCostPct: number | null;
  pricedLineCount: number;
  savingsPotential: number;
};

export type DashboardViewProps = {
  restaurantName: string;
  whatsappTo: string | null;
  alerts: DashboardAlert[];
  caToday: number;
  caYesterday: number;
  caWeek: number;
  caLastWeek: number;
  caMonth: number;
  caLastMonth: number;
  caLast7Days: { x: number; y: number; label: string }[];
  topDishes: { label: string; pct: number; qty: number }[];
  ticketMoyen: number;
  ticketYesterday: number;
  salesTodayCount: number;
  ordersToValidate: number;
  offlineKiosks: number;
  openOutages: number;
  purchaseOrders: {
    id: string;
    totalAmount: number;
    supplier: { name: string };
    lines: { quantity: number; ingredient: { name: string; unit: string } }[];
  }[];
  focuses: DayFocusItem[];
  costKpis: CostHomeKpis;
};

/**
 * Accueil desktop — DayFocus + KPIs complets.
 * Le parcours démarrage reste dans le dock FirstHourGuide.
 */
export function DashboardView(props: DashboardViewProps) {
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");

  const caDayDelta = pctDelta(props.caToday, props.caYesterday);
  const caWeekDelta = pctDelta(props.caWeek, props.caLastWeek);
  const caMonthDelta = pctDelta(props.caMonth, props.caLastMonth);

  const caValue =
    period === "week"
      ? props.caWeek
      : period === "month"
        ? props.caMonth
        : props.caToday;
  const caDelta =
    period === "week"
      ? caWeekDelta
      : period === "month"
        ? caMonthDelta
        : caDayDelta;
  const caLabel =
    period === "week"
      ? "CA de la semaine"
      : period === "month"
        ? "CA du mois"
        : "CA du jour";
  const caUp = caDelta != null ? !String(caDelta).startsWith("-") : null;

  const hasCourses =
    props.ordersToValidate > 0 || props.purchaseOrders.length > 0;

  const topLine = useMemo(() => {
    if (!props.topDishes.length) return null;
    return props.topDishes
      .slice(0, 3)
      .map((d) => `${d.label} ${d.pct}%`)
      .join(" · ");
  }, [props.topDishes]);

  const hikeCount =
    props.costKpis.hikesToday || props.costKpis.hikesWeek;
  const hikeDelta =
    props.costKpis.hikesToday > 0
      ? `${props.costKpis.hikesToday} aujourd’hui`
      : props.costKpis.hikesWeek > 0
        ? `${props.costKpis.hikesWeek} cette semaine`
        : "Aucune ≥ 5 %";

  return (
    <div className="dashboard-view ds-stack">
      <header className="module-page-header">
        <h1 className="module-page-title">Accueil</h1>
        <p className="module-page-lead">
          Priorités à traiter, puis les indicateurs clés du magasin.
        </p>
      </header>

      <DayFocus
        focuses={props.focuses}
        eyebrow="À faire maintenant"
        ariaLabel="Priorités du jour"
      />

      <div className="dashboard-view__kpi-head">
        <h2 className="dashboard-view__section">Activité</h2>
        <SegmentedControl
          value={period}
          onChange={(v) => setPeriod(v as "today" | "week" | "month")}
          options={[
            { value: "today", label: "Aujourd’hui" },
            { value: "week", label: "Semaine" },
            { value: "month", label: "Mois" },
          ]}
        />
      </div>

      <div
        className="ds-grid ds-grid--stats ds-grid--stats-compact"
        data-tour="home-activity"
      >
        <StatCard
          tone="lime"
          label={caLabel}
          value={euro(caValue)}
          delta={
            caDelta
              ? `${caDelta} vs préc.`
              : period === "today"
                ? `${props.salesTodayCount} vente(s)`
                : "—"
          }
          deltaUp={caUp}
        />
        <StatCard
          tone="white"
          label="Courses"
          value={String(props.ordersToValidate)}
          delta={
            props.ordersToValidate > 0 ? "Listes en attente" : "Rien à faire"
          }
          href="/orders"
        />
        <StatCard
          className="phone-hide"
          tone="white"
          label="Ticket moyen"
          value={euro(props.ticketMoyen)}
          delta={
            pctDelta(props.ticketMoyen, props.ticketYesterday)
              ? `${pctDelta(props.ticketMoyen, props.ticketYesterday)} vs hier`
              : "—"
          }
          deltaUp={(() => {
            const d = pctDelta(props.ticketMoyen, props.ticketYesterday);
            return d != null ? !String(d).startsWith("-") : null;
          })()}
        />
        {props.offlineKiosks > 0 || props.openOutages > 0 ? (
          <StatCard
            tone="white"
            label="Caisse"
            value={
              props.offlineKiosks > 0
                ? `${props.offlineKiosks} hors ligne`
                : `${props.openOutages} alerte(s)`
            }
            delta="À vérifier"
            href="/kiosks"
          />
        ) : null}
      </div>

      <h2 className="dashboard-view__section">Coûts · KPI</h2>
      <div
        className="ds-grid ds-grid--stats ds-grid--stats-compact"
        data-tour="home-costs"
      >
        <StatCard
          tone={hikeCount > 0 ? "lime" : "white"}
          label="Hausses prix"
          value={String(hikeCount)}
          delta={hikeDelta}
          href="/costs#hausses"
        />
        <StatCard
          tone={props.costKpis.needsInventory ? "lime" : "white"}
          label="Pertes semaine"
          value={
            props.costKpis.needsInventory
              ? "À faire"
              : euro(props.costKpis.lossEur)
          }
          delta={
            props.costKpis.needsInventory
              ? "Inventaire hebdo"
              : props.costKpis.pricedLineCount > 0
                ? `${props.costKpis.pricedLineCount} prix saisis`
                : "Importer factures"
          }
          href={
            props.costKpis.needsInventory ? "/inventory" : "/costs#pertes"
          }
        />
        <StatCard
          tone="white"
          label="Coût matière"
          value={
            props.costKpis.avgFoodCostPct != null
              ? `${props.costKpis.avgFoodCostPct.toFixed(0)} %`
              : "—"
          }
          delta={
            props.costKpis.avgFoodCostPct != null
              ? "Moy. best-sellers"
              : "Après factures + ventes"
          }
          href="/costs#matiere"
        />
        <StatCard
          tone="white"
          label="Négociation"
          value={
            props.costKpis.savingsPotential > 0
              ? euro(props.costKpis.savingsPotential)
              : "—"
          }
          delta={
            props.costKpis.savingsPotential > 0
              ? "€ / unité à récupérer"
              : "Comparer fournisseurs"
          }
          href="/costs#negocier"
        />
      </div>

      {topLine ? (
        <p className="dashboard-view__tops">Top ventes · {topLine}</p>
      ) : null}

      <div className="home-actions-row">
        <PillButton href="/costs" variant="primary">
          Coûts & factures
        </PillButton>
        {hasCourses ? (
          <PillButton href="/orders" variant="ghost">
            Voir les courses
          </PillButton>
        ) : null}
        <PillButton href="/ingredients" variant="ghost">
          Stock
        </PillButton>
        <PillButton href="/inventory" variant="ghost">
          Vérification
        </PillButton>
        <PillButton href="/employees" variant="ghost">
          Équipe
        </PillButton>
      </div>
    </div>
  );
}
