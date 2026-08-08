"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { euro, pctDelta } from "@/lib/dashboard";
import { SegmentedControl } from "@/components/ui";
import type { DashboardAlert } from "./dashboard-alert";
import type { DayFocusItem } from "@/components/home/DayFocus";
import { BrandPage } from "@/components/brand/BrandCard";
import { FOCUS_ID_TO_GUIDE_ACTION } from "@/lib/guide-anchors";

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

const CADENCE: Record<DayFocusItem["cadence"], string> = {
  day: "Jour",
  week: "Semaine",
  month: "Mois",
};

/**
 * Accueil desktop — hub priorité + pouls, aligné mobile.
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

  const openFocuses = props.focuses.filter((f) => !f.done);
  const primary = openFocuses[0] ?? props.focuses[0] ?? null;
  const queue = openFocuses.slice(1);
  const primaryAction = primary
    ? FOCUS_ID_TO_GUIDE_ACTION[primary.id]
    : undefined;

  const topLine = useMemo(() => {
    if (!props.topDishes.length) return null;
    return props.topDishes
      .slice(0, 3)
      .map((d) => `${d.label} ${d.pct}%`)
      .join(" · ");
  }, [props.topDishes]);

  const hikeCount =
    props.costKpis.hikesToday || props.costKpis.hikesWeek;

  const forecast = useMemo(() => {
    const days = props.caLast7Days;
    if (!days.length) return null;
    const values = days.map((d) => d.y);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const maxBar = Math.max(1, ...values);
    return {
      avg: Math.round(avg),
      bars: days.map((d) => ({
        label: d.label,
        height: Math.max(8, Math.round((d.y / maxBar) * 100)),
      })),
    };
  }, [props.caLast7Days]);

  void props.whatsappTo;
  void props.alerts;

  return (
    <BrandPage
      question={props.restaurantName}
      guide="Une priorité à traiter, puis le pouls du commerce."
    >
      <div className="home-now dash-card dash-card--dark hub-now" data-tour="home-focus">
        {primary && !primary.done ? (
          <>
            <p className="hub-now__eyebrow">
              À faire maintenant · {CADENCE[primary.cadence]}
              {primary.urgency === "high" ? " · Urgent" : ""}
            </p>
            <p className="hub-now__title">{primary.title}</p>
            <p className="hub-now__detail">{primary.message}</p>
            <div className="hub-now__actions">
              <Link
                href={primary.ctaHref}
                className="btn-lime"
                {...(primaryAction
                  ? { "data-guide-action": primaryAction }
                  : {})}
              >
                {primary.ctaLabel}
              </Link>
              {queue.length > 0 ? (
                <p className="hub-now__hint">
                  +{queue.length} autre{queue.length > 1 ? "s" : ""} en file
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <p className="hub-now__eyebrow">À faire maintenant</p>
            <p className="hub-now__title">Rien d’urgent</p>
            <p className="hub-now__detail">
              Commerce à jour — activité et coûts juste en dessous.
            </p>
            <div className="hub-now__actions">
              <Link href="/orders" className="btn-ghost">
                Courses
              </Link>
              <Link href="/inventory" className="btn-ghost">
                Vérification
              </Link>
            </div>
          </>
        )}
      </div>

      {queue.length > 0 ? (
        <ul className="home-queue" aria-label="Autres priorités">
          {queue.map((item) => {
            const action = FOCUS_ID_TO_GUIDE_ACTION[item.id];
            return (
              <li key={item.id}>
                <Link
                  href={item.ctaHref}
                  className={`home-queue__row${
                    item.urgency === "high" ? " is-urgent" : ""
                  }`}
                  {...(action ? { "data-guide-action": action } : {})}
                >
                  <span className="home-queue__cadence">
                    {CADENCE[item.cadence]}
                  </span>
                  <span className="home-queue__body">
                    <strong>{item.title}</strong>
                    <span>{item.message}</span>
                  </span>
                  <span className="home-queue__cta" aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      <section
        className="home-pulse home-pulse--desktop"
        data-tour="home-activity"
        aria-label="Activité"
      >
        <div className="home-pulse__head">
          <h2 className="home-pulse__section">Pouls</h2>
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
        <div className="home-pulse__grid">
          <div>
            <p className="home-pulse__label">{caLabel}</p>
            <p className="home-pulse__value">{euro(caValue)}</p>
            <p className="home-pulse__sub">
              {caDelta
                ? `${caDelta} vs préc.`
                : period === "today"
                  ? `${props.salesTodayCount} vente(s)`
                  : forecast
                    ? `Moy. 7 j · ${euro(forecast.avg)}`
                    : "—"}
            </p>
          </div>
          <div className="home-pulse__side">
            <p className="home-pulse__label">Ticket moyen</p>
            <p className="home-pulse__side-value">{euro(props.ticketMoyen)}</p>
            <p className="home-pulse__sub">
              {props.ordersToValidate > 0
                ? `${props.ordersToValidate} course(s) à valider`
                : "Aucune course en attente"}
            </p>
            {props.offlineKiosks > 0 || props.openOutages > 0 ? (
              <Link href="/kiosks" className="home-pulse__warn">
                {props.offlineKiosks > 0
                  ? `${props.offlineKiosks} caisse(s) hors ligne`
                  : `${props.openOutages} alerte(s) caisse`}
              </Link>
            ) : null}
          </div>
        </div>
        {forecast && forecast.bars.length > 0 ? (
          <div className="home-pulse__bars" aria-hidden>
            {forecast.bars.map((b, i) => (
              <div key={`${b.label}-${i}`} className="home-pulse__col">
                <i
                  className="home-pulse__bar"
                  style={{ ["--bar-h" as string]: `${b.height}%` }}
                />
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        ) : null}
        {topLine ? (
          <p className="home-pulse__tops">Top · {topLine}</p>
        ) : null}
      </section>

      <section className="home-signals" data-tour="home-costs" aria-label="Coûts">
        <h2 className="home-pulse__section">Signaux coûts</h2>
        <ul className="home-signals__list home-signals__list--wide">
          <li>
            <Link href="/costs#hausses">
              <span>Hausses</span>
              <strong>{hikeCount}</strong>
            </Link>
          </li>
          <li>
            <Link
              href={
                props.costKpis.needsInventory
                  ? "/inventory"
                  : "/costs#pertes"
              }
            >
              <span>Pertes</span>
              <strong>
                {props.costKpis.needsInventory
                  ? "À faire"
                  : euro(props.costKpis.lossEur)}
              </strong>
            </Link>
          </li>
          <li>
            <Link href="/costs#matiere">
              <span>Matière</span>
              <strong>
                {props.costKpis.avgFoodCostPct != null
                  ? `${props.costKpis.avgFoodCostPct.toFixed(0)} %`
                  : "—"}
              </strong>
            </Link>
          </li>
          <li>
            <Link href="/costs#negocier">
              <span>Négocier</span>
              <strong>
                {props.costKpis.savingsPotential > 0
                  ? euro(props.costKpis.savingsPotential)
                  : "—"}
              </strong>
            </Link>
          </li>
        </ul>
      </section>

      <nav className="home-jump" aria-label="Raccourcis">
        <Link href="/orders">Courses</Link>
        <Link href="/inventory">Vérification</Link>
        <Link href="/ingredients">Stock</Link>
        <Link href="/costs">Coûts</Link>
        <Link href="/employees">Équipe</Link>
      </nav>
    </BrandPage>
  );
}
