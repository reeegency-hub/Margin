import type { PosPullClient, PosPullFetchOpts, PosPulledOrder } from "./types";
import {
  bearerGetJson,
  bearerPostJson,
  fetchGenericOrdersList,
  orderToGenericWebhook,
} from "./http";
import { asRecord } from "@/lib/pos/helpers";

const zeltyClient: PosPullClient = {
  vendor: "zelty",
  label: "Zelty",
  apiKeyLabel: "Clé API marketplace Zelty",
  async fetchOrders(opts) {
    return fetchGenericOrdersList({
      apiKey: opts.apiKey,
      from: opts.from,
      to: opts.to,
      apiBaseUrl: opts.apiBaseUrl,
      defaultBase: "https://api.zelty.fr/2.0",
      defaultPath: "/orders",
      envBaseKey: "ZELTY_API_BASE",
      envPathKey: "ZELTY_ORDERS_PATH",
    });
  },
  toWebhookBody: orderToGenericWebhook,
};

const cashpadClient: PosPullClient = {
  vendor: "cashpad",
  label: "Cashpad",
  apiKeyLabel: "Clé API Cashpad",
  async fetchOrders(opts) {
    return fetchGenericOrdersList({
      apiKey: opts.apiKey,
      from: opts.from,
      to: opts.to,
      apiBaseUrl: opts.apiBaseUrl,
      defaultBase: "https://api.cashpad.fr",
      defaultPath: "/v1/tickets",
      envBaseKey: "CASHPAD_API_BASE",
      envPathKey: "CASHPAD_ORDERS_PATH",
    });
  },
  toWebhookBody(order) {
    const raw = asRecord(order.raw) ?? {};
    if (raw.ticket || raw.items || raw.lines) return order.raw;
    return {
      ticket: {
        id: order.id,
        created_at: order.createdAt,
        status: order.status,
        ...raw,
      },
    };
  },
};

const tillerClient: PosPullClient = {
  vendor: "tiller",
  label: "Tiller / SumUp",
  apiKeyLabel: "Token API SumUp / Tiller",
  async fetchOrders(opts: PosPullFetchOpts) {
    const base = (
      opts.apiBaseUrl ||
      process.env.SUMUP_API_BASE ||
      "https://api.sumup.com/v0.1"
    ).replace(/\/$/, "");
    const path = process.env.SUMUP_ORDERS_PATH || "/me/transactions/history";
    const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
    url.searchParams.set("oldest_time", opts.from.toISOString());
    url.searchParams.set("newest_time", opts.to.toISOString());
    url.searchParams.set("limit", "1000");
    return bearerGetJson({ url: url.toString(), apiKey: opts.apiKey });
  },
  toWebhookBody(order) {
    const raw = asRecord(order.raw) ?? {};
    if (raw.data || raw.order_items || raw.items) return order.raw;
    return {
      data: {
        id: order.id,
        created_at: order.createdAt,
        status: order.status,
        items: Array.isArray(raw.items) ? raw.items : [],
        ...raw,
      },
    };
  },
};

const ladditionClient: PosPullClient = {
  vendor: "laddition",
  label: "L'Addition",
  apiKeyLabel: "Clé API L'Addition",
  async fetchOrders(opts) {
    return fetchGenericOrdersList({
      apiKey: opts.apiKey,
      from: opts.from,
      to: opts.to,
      apiBaseUrl: opts.apiBaseUrl,
      defaultBase: "https://api.laddition.com",
      defaultPath: "/v1/tickets",
      envBaseKey: "LADDITION_API_BASE",
      envPathKey: "LADDITION_ORDERS_PATH",
    });
  },
  toWebhookBody(order) {
    const raw = asRecord(order.raw) ?? {};
    if (raw.ticket || raw.addition || raw.articles) return order.raw;
    return {
      ticket: {
        id: order.id,
        created_at: order.createdAt,
        status: order.status,
        articles: Array.isArray(raw.articles) ? raw.articles : [],
        ...raw,
      },
    };
  },
};

const lightspeedClient: PosPullClient = {
  vendor: "lightspeed",
  label: "Lightspeed",
  apiKeyLabel: "Token API Lightspeed",
  merchantIdLabel: "Account ID Lightspeed",
  async fetchOrders(opts) {
    const accountId =
      opts.merchantExternalId || process.env.LIGHTSPEED_ACCOUNT_ID || "";
    if (!accountId) {
      return {
        ok: false,
        error: "Account ID Lightspeed requis (merchantExternalId)",
      };
    }
    const base = (
      opts.apiBaseUrl ||
      process.env.LIGHTSPEED_API_BASE ||
      "https://api.lightspeedapp.com/API/Account"
    ).replace(/\/$/, "");
    const url = new URL(
      `${base}/${encodeURIComponent(accountId)}/Sale.json`
    );
    url.searchParams.set(
      "timeStamp",
      `><,${opts.from.toISOString()},${opts.to.toISOString()}`
    );
    url.searchParams.set("limit", "100");
    return bearerGetJson({ url: url.toString(), apiKey: opts.apiKey });
  },
  toWebhookBody(order) {
    const raw = asRecord(order.raw) ?? {};
    if (raw.Sale || raw.sale) return order.raw;
    return {
      Sale: {
        saleID: order.id,
        createTime: order.createdAt,
        ...raw,
      },
    };
  },
};

const squareClient: PosPullClient = {
  vendor: "square",
  label: "Square",
  apiKeyLabel: "Access token Square",
  merchantIdLabel: "Location ID Square",
  async fetchOrders(opts) {
    const locationId =
      opts.merchantExternalId || process.env.SQUARE_LOCATION_ID || "";
    if (!locationId) {
      return {
        ok: false,
        error: "Location ID Square requis (merchantExternalId)",
      };
    }
    const base = (
      opts.apiBaseUrl ||
      process.env.SQUARE_API_BASE ||
      "https://connect.squareup.com/v2"
    ).replace(/\/$/, "");
    const result = await bearerPostJson({
      url: `${base}/orders/search`,
      apiKey: opts.apiKey,
      headers: {
        "Square-Version":
          process.env.SQUARE_API_VERSION || "2024-10-17",
      },
      body: {
        location_ids: [locationId],
        query: {
          filter: {
            date_time_filter: {
              created_at: {
                start_at: opts.from.toISOString(),
                end_at: opts.to.toISOString(),
              },
            },
          },
        },
        limit: 100,
      },
    });
    return result;
  },
  toWebhookBody(order: PosPulledOrder) {
    const raw = asRecord(order.raw) ?? {};
    if (raw.data || raw.order || raw.line_items) return order.raw;
    return {
      type: "order.updated",
      data: {
        object: {
          order: {
            id: order.id,
            created_at: order.createdAt,
            state: order.status,
            ...raw,
          },
        },
      },
    };
  },
};

const customClient: PosPullClient = {
  vendor: "custom",
  label: "Autre caisse",
  apiKeyLabel: "Clé / token API",
  merchantIdLabel: "Merchant / location ID (si requis)",
  async fetchOrders(opts) {
    const base =
      opts.apiBaseUrl ||
      process.env.CUSTOM_POS_API_BASE ||
      "";
    if (!base) {
      return {
        ok: false,
        error:
          "apiBaseUrl requis pour une caisse custom (ou CUSTOM_POS_API_BASE)",
      };
    }
    return fetchGenericOrdersList({
      apiKey: opts.apiKey,
      from: opts.from,
      to: opts.to,
      apiBaseUrl: base,
      defaultBase: base,
      defaultPath: "/orders",
      envBaseKey: "CUSTOM_POS_API_BASE",
      envPathKey: "CUSTOM_POS_ORDERS_PATH",
    });
  },
  toWebhookBody: orderToGenericWebhook,
};

const CLIENTS: Partial<Record<string, PosPullClient>> = {
  zelty: zeltyClient,
  cashpad: cashpadClient,
  tiller: tillerClient,
  laddition: ladditionClient,
  lightspeed: lightspeedClient,
  square: squareClient,
  custom: customClient,
  other: { ...customClient, vendor: "other", label: "Autre" },
};

export function getPosPullClient(vendor: string): PosPullClient | null {
  return CLIENTS[vendor] ?? null;
}

export function listPosPullClients(): PosPullClient[] {
  return Object.values(CLIENTS).filter(Boolean) as PosPullClient[];
}
