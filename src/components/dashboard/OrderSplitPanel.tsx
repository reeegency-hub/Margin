"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { completeShoppingListAction, generateOrders } from "@/app/actions";
import { buildWaMeLink, shoppingListWaMessage } from "@/lib/wa-link";
import { WaSendLabel } from "@/components/ui/WhatsAppIcon";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

export type ShoppingLine = {
  stockUnitId: string;
  name: string;
  quantityLabel: string;
  stockLabel: string;
  reason: "missing" | "soon";
  daysLeftLabel: string | null;
};

export type OrderRow = {
  id: string;
  supplierName: string;
  status: string;
  statusLabel?: string;
  totalAmount: number;
  amountLabel: string;
  linesLabel: string;
  lineCount: number;
  waLines: { name: string; quantityLabel: string }[];
  productNames: string[];
  proposedAt: string;
  doneAt: string | null;
};

function formatDay(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return "—";
  }
}

function formatDayFull(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function isDone(status: string) {
  return ["VALIDATED", "SENT", "RECEIVED"].includes(status);
}

function isHistory(status: string) {
  return isDone(status) || status === "CANCELLED";
}

function ShoppingListCard({
  lines,
  restaurantName,
  whatsappTo,
  primaryActionsInInk,
}: {
  lines: ShoppingLine[];
  restaurantName: string;
  whatsappTo: string | null;
  /** CTAs principaux déjà dans le bloc ink de la page */
  primaryActionsInInk?: boolean;
}) {
  const href =
    buildWaMeLink(
      whatsappTo,
      shoppingListWaMessage(
        restaurantName,
        lines.map((l) => ({
          name: l.name,
          quantityLabel: l.quantityLabel,
        }))
      )
    ) || "/settings?error=nonumber";
  const external = href.startsWith("https://");

  if (!lines.length) {
    return (
      <article className="dash-card dash-card--light shop-list shop-list--empty">
        <p className="shop-list__empty">
          Rien à racheter pour les 2–3 prochains jours.
        </p>
        <p className="shop-list__hint">
          Quantité fausse → <Link href="/inventory">Vérification</Link>
        </p>
        {!primaryActionsInInk ? (
          <div className="shop-list__actions" data-tour="courses-actions">
            <form action={generateOrders} data-guide-form="courses-create">
              <button
                type="submit"
                className="btn-ghost"
                data-guide-action="courses-create"
              >
                Actualiser
              </button>
            </form>
          </div>
        ) : null}
      </article>
    );
  }

  const cardTone = primaryActionsInInk
    ? "dash-card dash-card--light shop-list"
    : "dash-card dash-card--dark shop-list";

  return (
    <article className={cardTone}>
      <header className="shop-list__head">
        <div>
          {!primaryActionsInInk ? (
            <p className="shop-list__eyebrow">À faire</p>
          ) : null}
          <h3 className="shop-list__title">Liste de courses</h3>
        </div>
        <span className="shop-list__count">
          {lines.length} ligne{lines.length > 1 ? "s" : ""}
        </span>
      </header>

      <ul className="shop-list__rows">
        {lines.map((line) => (
          <li key={line.stockUnitId}>
            <div className="shop-list__info">
              <strong>{line.name}</strong>
              <small>
                {line.reason === "missing" ? (
                  <span className="is-missing">À racheter</span>
                ) : (
                  <span className="is-soon">
                    {line.daysLeftLabel
                      ? `Risque · ${line.daysLeftLabel}`
                      : "Risque sous 3 jours"}
                  </span>
                )}
                {" · stock "}
                {line.stockLabel}
              </small>
            </div>
            <span className="shop-list__qty">{line.quantityLabel}</span>
          </li>
        ))}
      </ul>

      <p className="shop-list__hint">
        Quantité fausse → <Link href="/inventory">Vérification</Link>
      </p>

      <div className="shop-list__actions" data-tour="courses-actions">
        {primaryActionsInInk ? (
          <form action={generateOrders} data-guide-form="courses-create">
            <button
              type="submit"
              className="btn-ghost"
              data-guide-action="courses-create"
            >
              Actualiser
            </button>
          </form>
        ) : (
          <>
            <form action={completeShoppingListAction}>
              <button
                type="submit"
                className="btn-lime"
                data-guide-action="courses-do"
              >
                Marquer comme fait
              </button>
            </form>
            <form action={generateOrders} data-guide-form="courses-create">
              <button
                type="submit"
                className="btn-ghost"
                data-guide-action="courses-create"
              >
                Actualiser
              </button>
            </form>
            {external ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="wa-pill wa-send-btn"
              >
                <span className="wa-dot" />
                <WaSendLabel kind="list" />
              </a>
            ) : (
              <Link
                href={href}
                className="wa-pill wa-send-btn"
                title="Ajoutez votre numéro WhatsApp dans Réglages"
              >
                <span className="wa-dot" />
                <WaSendLabel kind="list" />
              </Link>
            )}
          </>
        )}
      </div>
    </article>
  );
}

function OrdersHistory({ orders }: { orders: OrderRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const done = orders.filter((o) => isDone(o.status));
    const last = done[0];
    return { done, last };
  }, [orders]);

  if (!orders.length) {
    return (
      <div className="dash-card dash-card--light">
        <p className="text-[14px] text-[var(--text-secondary-light)]">
          Pas encore d’historique.
        </p>
      </div>
    );
  }

  return (
    <div className="dash-card dash-card--light orders-history">
      {stats.last ? (
        <p className="orders-history__lead">
          Dernière course ·{" "}
          {formatDayFull(stats.last.doneAt || stats.last.proposedAt)}
        </p>
      ) : null}
      <ol className="orders-history__timeline">
        {orders.map((order) => {
          const done = isDone(order.status);
          const when = order.doneAt || order.proposedAt;
          const expanded = openId === order.id;
          return (
            <li key={order.id} className="orders-history__item">
              <button
                type="button"
                className="orders-history__row"
                onClick={() => setOpenId(expanded ? null : order.id)}
                aria-expanded={expanded}
              >
                <span
                  className={`orders-history__dot ${
                    done
                      ? "orders-history__dot--done"
                      : "orders-history__dot--cancel"
                  }`}
                />
                <span className="orders-history__when">
                  {formatDay(when)}
                </span>
                <span className="orders-history__main">
                  <strong>
                    {done ? "Course faite" : "Liste annulée"}
                  </strong>
                  <span>
                    {order.lineCount} produit
                    {order.lineCount > 1 ? "s" : ""}
                    {order.amountLabel ? ` · ${order.amountLabel}` : ""}
                  </span>
                </span>
              </button>
              {expanded ? (
                <div className="orders-history__detail">
                  <p>{order.linesLabel || "—"}</p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Courses : une liste unique + historique. */
export function OrderSplitPanel({
  lines,
  orders,
  restaurantName,
  whatsappTo,
  primaryActionsInInk,
}: {
  lines: ShoppingLine[];
  orders: OrderRow[];
  restaurantName: string;
  whatsappTo: string | null;
  primaryActionsInInk?: boolean;
}) {
  const history = orders.filter((o) => isHistory(o.status));
  const [tab, setTab] = useState<"todo" | "history">(
    lines.length || !history.length ? "todo" : "history"
  );

  return (
    <div className="orders-workspace">
      <SegmentedControl
        value={tab}
        onChange={(v) => setTab(v as "todo" | "history")}
        options={[
          {
            value: "todo",
            label: `Liste${lines.length ? ` (${lines.length})` : ""}`,
          },
          {
            value: "history",
            label: `Historique${history.length ? ` (${history.length})` : ""}`,
          },
        ]}
      />

      {tab === "todo" ? (
        <div className="mt-4">
          <ShoppingListCard
            lines={lines}
            restaurantName={restaurantName}
            whatsappTo={whatsappTo}
            primaryActionsInInk={primaryActionsInInk}
          />
        </div>
      ) : (
        <div className="mt-4">
          <OrdersHistory orders={history} />
        </div>
      )}
    </div>
  );
}
