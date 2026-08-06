"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { HomeData } from "./types";
import { euro } from "@/lib/dashboard";
import { SegmentedControl } from "@/components/ui";
import { DayFocus, type DayFocusItem } from "@/components/home/DayFocus";
import { AlertCard } from "@/components/home/AlertCard";
import { useHomeAlerts } from "@/components/dashboard/HomeAlertsContext";

function buildForecast(days: HomeData["caLast7Days"]) {
  if (!days.length) return null;
  const values = days.map((d) => d.y);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const maxBar = Math.max(1, ...values);
  return {
    avg: Math.round(avg),
    bars: days.map((d) => ({
      label: d.label,
      value: d.y,
      height: Math.max(8, Math.round((d.y / maxBar) * 100)),
    })),
  };
}

/**
 * Accueil mobile — priorités + KPIs (CA, coûts, raccourcis).
 * Le parcours démarrage vit dans le dock FirstHourGuide.
 */
export function MobileHome({
  data,
  focuses,
  dayFocus,
  costKpis,
}: {
  data: HomeData;
  focuses?: DayFocusItem[];
  /** @deprecated */
  dayFocus?: DayFocusItem;
  costKpis?: {
    hikesToday: number;
    hikesWeek: number;
    lossEur: number;
    needsInventory: boolean;
    avgFoodCostPct: number | null;
    pricedLineCount: number;
    savingsPotential: number;
  };
}) {
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const homeAlerts = useHomeAlerts();
  const showInlineAlert = Boolean(data.alert) && !homeAlerts?.hideInlineAlert;
  const initial = data.restaurantName.trim().charAt(0).toUpperCase() || "R";
  const focusList = focuses?.length ? focuses : dayFocus ? [dayFocus] : [];

  const caValue = useMemo(() => {
    if (period === "week") return data.caWeek;
    if (period === "month") return data.caMonth;
    return data.caToday;
  }, [period, data.caToday, data.caWeek, data.caMonth]);

  const caTitle =
    period === "week"
      ? "CA semaine"
      : period === "month"
        ? "CA mois"
        : "CA du jour";

  const forecast = useMemo(
    () => buildForecast(data.caLast7Days),
    [data.caLast7Days]
  );

  const topBars =
    data.topDishes?.length > 0 ? data.topDishes.slice(0, 3) : [];

  const hikeCount = costKpis
    ? costKpis.hikesToday || costKpis.hikesWeek
    : 0;

  return (
    <div className="mobile-home">
      <div className="mobile-home__inner">
        <header className="mobile-home__header module-page-header">
          <div className="mobile-home__identity">
            <div className="mobile-home__avatar" aria-hidden>
              {initial}
            </div>
            <div>
              <p className="mobile-home__hello">Bonjour</p>
              <h1 className="mobile-home__name module-page-title">
                {data.restaurantName}
              </h1>
            </div>
          </div>
          <p className="module-page-lead">
            Priorités du magasin, puis les indicateurs clés.
          </p>
        </header>

        <div className="mobile-home__block" data-tour="home-focus-wrap">
          {showInlineAlert && data.alert ? (
            <AlertCard alert={data.alert} />
          ) : (
            <DayFocus
              focuses={focusList}
              eyebrow="À faire maintenant"
              ariaLabel="Priorités du jour"
            />
          )}
        </div>

        <section
          className="mobile-home__block"
          data-tour="home-activity"
          aria-label="Activité"
        >
          <div className="mobile-home__section-row">
            <h2 className="mobile-home__section">Activité</h2>
            <SegmentedControl
              value={period}
              onChange={(v) => setPeriod(v as "today" | "week" | "month")}
              options={[
                { value: "today", label: "Jour" },
                { value: "week", label: "Sem." },
                { value: "month", label: "Mois" },
              ]}
            />
          </div>
          <div className="mobile-home__ca">
            <p className="mobile-home__ca-label">{caTitle}</p>
            <p className="mobile-home__ca-value">{euro(caValue)}</p>
            <p className="mobile-home__ca-sub">
              {forecast
                ? `Moy. 7 j · ${euro(forecast.avg)}`
                : "Les ventes apparaîtront ici"}
            </p>
          </div>
          {forecast && forecast.bars.length > 0 ? (
            <div className="mobile-home__forecast" aria-hidden>
              <div className="mobile-home__forecast-bars">
                {forecast.bars.map((b) => (
                  <div key={b.label} className="mobile-home__forecast-col">
                    <i
                      className="mobile-home__forecast-bar"
                      style={{ height: `${b.height}%` }}
                    />
                    <span className="mobile-home__forecast-day">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {topBars.length ? (
            <ul className="mobile-home__tops mobile-home__tops--compact">
              {topBars.map((d) => (
                <li key={d.label}>
                  <span>{d.label}</span>
                  <strong>{d.pct}%</strong>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {costKpis ? (
          <section
            className="mobile-home__block"
            data-tour="home-costs"
            aria-label="Coûts"
          >
            <h2 className="mobile-home__section">Coûts</h2>
            <ul className="mobile-home__cost-grid">
              <li>
                <Link href="/costs#hausses">
                  <span>Hausses</span>
                  <strong>{hikeCount}</strong>
                </Link>
              </li>
              <li>
                <Link
                  href={
                    costKpis.needsInventory ? "/inventory" : "/costs#pertes"
                  }
                >
                  <span>Pertes</span>
                  <strong>
                    {costKpis.needsInventory
                      ? "À faire"
                      : euro(costKpis.lossEur)}
                  </strong>
                </Link>
              </li>
              <li>
                <Link href="/costs#matiere">
                  <span>Matière</span>
                  <strong>
                    {costKpis.avgFoodCostPct != null
                      ? `${costKpis.avgFoodCostPct.toFixed(0)} %`
                      : "—"}
                  </strong>
                </Link>
              </li>
              <li>
                <Link href="/costs#negocier">
                  <span>Négocier</span>
                  <strong>
                    {costKpis.savingsPotential > 0
                      ? euro(costKpis.savingsPotential)
                      : "—"}
                  </strong>
                </Link>
              </li>
            </ul>
          </section>
        ) : null}

        <nav
          className="mobile-home__calm-links mobile-home__calm-links--row"
          aria-label="Raccourcis"
        >
          <Link href="/costs">Coûts</Link>
          <Link href="/orders">Courses</Link>
          <Link href="/inventory">Vérification</Link>
          <Link href="/ingredients">Stock</Link>
        </nav>
      </div>
    </div>
  );
}
