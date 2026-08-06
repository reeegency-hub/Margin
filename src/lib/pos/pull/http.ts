import { asRecord, pickNumber, pickString } from "@/lib/pos/helpers";
import type { PosPulledOrder, PosPullResult } from "./types";

export function normalizeOrdersList(json: unknown): PosPulledOrder[] {
  const root = asRecord(json) ?? {};
  const saleNode = root.Sale ?? root.sale;
  const list =
    (Array.isArray(json) && json) ||
    (Array.isArray(root.orders) && root.orders) ||
    (Array.isArray(root.data) && root.data) ||
    (Array.isArray(root.transactions) && root.transactions) ||
    (Array.isArray(root.items) && root.items) ||
    (Array.isArray(root.tickets) && root.tickets) ||
    (Array.isArray(root.Sales) && root.Sales) ||
    (Array.isArray(root.sales) && root.sales) ||
    (Array.isArray(saleNode) && saleNode) ||
    (saleNode && typeof saleNode === "object" ? [saleNode] : []) ||
    [];

  const out: PosPulledOrder[] = [];
  for (const item of list) {
    const r = asRecord(item) ?? asRecord(asRecord(item)?.Sale) ?? null;
    if (!r) continue;
    const id = pickString(
      r.id,
      r.order_id,
      r.orderId,
      r.transaction_id,
      r.transactionId,
      r.saleID,
      r.ticket_id,
      r.uid
    );
    if (!id) continue;
    out.push({
      id,
      status: pickString(r.status, r.state, r.event, r.payment_status),
      createdAt: pickString(
        r.created_at,
        r.createdAt,
        r.date,
        r.ordered_at,
        r.timestamp,
        r.update_time,
        r.completed_at
      ),
      total: pickNumber(
        r.total,
        r.price,
        r.amount,
        r.total_amount,
        asRecord(r.total_money)?.amount,
        asRecord(r.amount_money)?.amount
      ),
      raw: item,
    });
  }
  return out;
}

export function orderToGenericWebhook(order: PosPulledOrder): unknown {
  const raw = asRecord(order.raw) ?? {};
  if (
    raw.order ||
    raw.ticket ||
    raw.Sale ||
    raw.dishs ||
    raw.dishes ||
    raw.items ||
    raw.line_items ||
    raw.data
  ) {
    return order.raw;
  }
  return {
    id: order.id,
    status: order.status,
    created_at: order.createdAt,
    order: {
      id: order.id,
      created_at: order.createdAt,
      status: order.status,
      ...raw,
    },
  };
}

export async function bearerGetJson(opts: {
  url: string;
  apiKey: string;
  headers?: Record<string, string>;
}): Promise<PosPullResult> {
  let res: Response;
  try {
    res = await fetch(opts.url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        Accept: "application/json",
        ...opts.headers,
      },
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
  }
  try {
    const json = await res.json();
    return { ok: true, orders: normalizeOrdersList(json) };
  } catch {
    return { ok: false, error: "Réponse JSON invalide" };
  }
}

export async function bearerPostJson(opts: {
  url: string;
  apiKey: string;
  body: unknown;
  headers?: Record<string, string>;
}): Promise<PosPullResult> {
  let res: Response;
  try {
    res = await fetch(opts.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...opts.headers,
      },
      body: JSON.stringify(opts.body),
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
  }
  try {
    const json = await res.json();
    return { ok: true, orders: normalizeOrdersList(json) };
  } catch {
    return { ok: false, error: "Réponse JSON invalide" };
  }
}

/** Pull générique style Zelty : GET base/path?from&to */
export async function fetchGenericOrdersList(opts: {
  apiKey: string;
  from: Date;
  to: Date;
  defaultBase: string;
  defaultPath: string;
  envBaseKey: string;
  envPathKey: string;
  apiBaseUrl?: string | null;
}): Promise<PosPullResult> {
  const base = (
    opts.apiBaseUrl ||
    process.env[opts.envBaseKey] ||
    opts.defaultBase
  ).replace(/\/$/, "");
  const pathRaw = process.env[opts.envPathKey] || opts.defaultPath;
  const path = pathRaw.startsWith("/") ? pathRaw : `/${pathRaw}`;
  const url = new URL(`${base}${path}`);
  url.searchParams.set("from", Math.floor(opts.from.getTime() / 1000).toString());
  url.searchParams.set("to", Math.floor(opts.to.getTime() / 1000).toString());
  url.searchParams.set("start", opts.from.toISOString());
  url.searchParams.set("end", opts.to.toISOString());
  return bearerGetJson({ url: url.toString(), apiKey: opts.apiKey });
}
