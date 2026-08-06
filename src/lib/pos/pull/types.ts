import type { PosVendor } from "../types";

export type PosPulledOrder = {
  id: string;
  status?: string;
  createdAt?: string;
  total?: number;
  raw: unknown;
};

export type PosPullFetchOpts = {
  apiKey: string;
  from: Date;
  to: Date;
  /** Square location_id, Lightspeed account_id, etc. */
  merchantExternalId?: string | null;
  /** Override base URL (connexion ou env) */
  apiBaseUrl?: string | null;
};

export type PosPullResult =
  | { ok: true; orders: PosPulledOrder[] }
  | { ok: false; error: string };

export type PosPullClient = {
  vendor: PosVendor;
  label: string;
  /** Affiché dans l’UI clé API */
  apiKeyLabel: string;
  merchantIdLabel?: string;
  fetchOrders(opts: PosPullFetchOpts): Promise<PosPullResult>;
  /** Corps webhook synthétique pour réutiliser l’adapter */
  toWebhookBody(order: PosPulledOrder): unknown;
};

export type PosApiCapability = {
  supportsPull: boolean;
  apiKeyLabel: string;
  merchantIdLabel?: string;
};

export const POS_API_CAPABILITY: Record<PosVendor, PosApiCapability> = {
  zelty: {
    supportsPull: true,
    apiKeyLabel: "Clé API marketplace Zelty",
  },
  cashpad: {
    supportsPull: true,
    apiKeyLabel: "Clé API Cashpad",
  },
  tiller: {
    supportsPull: true,
    apiKeyLabel: "Token API SumUp / Tiller",
  },
  laddition: {
    supportsPull: true,
    apiKeyLabel: "Clé API L'Addition",
  },
  lightspeed: {
    supportsPull: true,
    apiKeyLabel: "Token API Lightspeed",
    merchantIdLabel: "Account ID Lightspeed",
  },
  square: {
    supportsPull: true,
    apiKeyLabel: "Access token Square",
    merchantIdLabel: "Location ID Square",
  },
  custom: {
    supportsPull: true,
    apiKeyLabel: "Clé / token API",
    merchantIdLabel: "Merchant / location ID (si requis)",
  },
  other: {
    supportsPull: true,
    apiKeyLabel: "Clé / token API",
  },
  csv: {
    supportsPull: false,
    apiKeyLabel: "",
  },
};

export function vendorSupportsApiPull(vendor: string): boolean {
  return POS_API_CAPABILITY[vendor as PosVendor]?.supportsPull === true;
}
