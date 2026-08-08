"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { HomeData } from "./types";
import { euro } from "@/lib/dashboard";
import { SegmentedControl } from "@/components/ui";
import type { DayFocusItem } from "@/components/home/DayFocus";
import { BrandPage } from "@/components/brand/BrandCard";
import { useHomeAlerts } from "@/components/dashboard/HomeAlertsContext";
import { FOCUS_ID_TO_GUIDE_ACTION } from "@/lib/guide-anchors";
import { validateOrderAction } from "@/app/actions";

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

const CADENCE: Record<DayFocusItem["cadence"], string> = {
  day: "Jour",
  week: "Semaine",
  month: "Mois",
};

/**
 * Accueil mobile — une priorité (hub-now), puis pouls CA / signaux coûts.
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

  const focusList = focuses?.length ? focuses : dayFocus ? [dayFocus] : [];
  const openFocuses = focusList.filter((f) => !f.done);
  const primary = openFocuses[0] ?? focusList[0] ?? null;
  const queue = openFocuses.slice(1);

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

  const topLine =
    data.topDishes?.length > 0
      ? data.topDishes
          .slice(0, 3)
          .map((d) => `${d.label} ${d.pct}%`)
          .join(" · ")
      : null;

  const hikeCount = costKpis
    ? costKpis.hikesToday || costKpis.hikesWeek
    : 0;

  const primaryAction = primary
    ? FOCUS_ID_TO_GUIDE_ACTION[primary.id]
    : undefined;

  return (
    <BrandPage
      question={data.restaurantName}
      guide="Une priorité à traiter, puis le pouls du commerce."
    >
      <div className="home-now dash-card dash-card--dark hub-now" data-tour="home-focus">
        {showInlineAlert && data.alert ? (
          <>
            <p className="hub-now__eyebrow">{data.alert.badgeLabel}</p>
            <p className="hub-now__title">{data.alert.message}</p>
            <div className="hub-now__actions">
              {data.alert.orderId ? (
                <form action={validateOrderAction}>
                  <input type="hidden" name="id" value={data.alert.orderId} />
                  <button type="submit" className="btn-lime">
                    {data.alert.ctaLabel}
                  </button>
                </form>
              ) : (
                <Link
                  href={data.alert.ctaHref || "/orders"}
                  className="btn-lime"
                >
                  {data.alert.ctaLabel}
                </Link>
              )}
            </div>
          </>
        ) : primary && !primary.done ? (
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
                  +{queue.length} autre{queue.length > 1 ? "s" : ""} en dessous
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <p className="hub-now__eyebrow">À faire maintenant</p>
            <p className="hub-now__title">Rien d’urgent</p>
            <p className="hub-now__detail">
              Le commerce est à jour — CA et signaux coûts juste en dessous.
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

      <section className="home-pulse" data-tour="home-activity" aria-label="Activité">
        <div className="home-pulse__head">
          <h2 className="home-pulse__section">Pouls</h2>
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
        <p className="home-pulse__label">{caTitle}</p>
        <p className="home-pulse__value">{euro(caValue)}</p>
        <p className="home-pulse__sub">
          {forecast
            ? `Moyenne 7 j · ${euro(forecast.avg)}`
            : "Les ventes apparaîtront ici"}
        </p>
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

      {costKpis ? (
        <section className="home-signals" data-tour="home-costs" aria-label="Coûts">
          <h2 className="home-pulse__section">Signaux coûts</h2>
          <ul className="home-signals__list">
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

      <nav className="home-jump" aria-label="Raccourcis">
        <Link href="/orders">Courses</Link>
        <Link href="/inventory">Vérification</Link>
        <Link href="/ingredients">Stock</Link>
        <Link href="/costs">Coûts</Link>
      </nav>
    </BrandPage>
  );
}
