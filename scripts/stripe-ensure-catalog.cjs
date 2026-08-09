#!/usr/bin/env node
/**
 * Crée / réconcilie le catalogue Stripe Margin (Commerce + Réseau) + webhook prod.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_… node scripts/stripe-ensure-catalog.mjs
 *   STRIPE_SECRET_KEY=sk_test_… node scripts/stripe-ensure-catalog.mjs
 *
 * Options:
 *   --dry-run
 *   --webhook-url=https://margin-shop.vercel.app/api/stripe/webhook
 */
const fs = require("fs");
const path = require("path");

const DRY = process.argv.includes("--dry-run");
const webhookArg = process.argv.find((a) => a.startsWith("--webhook-url="));
const WEBHOOK_URL =
  (webhookArg && webhookArg.split("=")[1]) ||
  "https://margin-shop.vercel.app/api/stripe/webhook";

function loadKey() {
  if (process.env.STRIPE_SECRET_KEY?.trim()) return process.env.STRIPE_SECRET_KEY.trim();
  for (const file of [".env.stripe.live", ".env.production.local", ".env.local"]) {
    const p = path.join(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    const line = fs
      .readFileSync(p, "utf8")
      .split("\n")
      .find((l) => l.startsWith("STRIPE_SECRET_KEY="));
    if (!line) continue;
    const v = line.slice("STRIPE_SECRET_KEY=".length).trim().replace(/^"|"$/g, "");
    if (v) return v;
  }
  return null;
}

async function stripe(key, method, apiPath, body) {
  const res = await fetch(`https://api.stripe.com/v1${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  const json = await res.json();
  if (json.error) {
    const err = new Error(json.error.message || "Stripe error");
    err.code = json.error.code;
    err.raw = json.error;
    throw err;
  }
  return json;
}

async function listAll(key, apiPath) {
  const out = [];
  let starting_after;
  for (;;) {
    const q = new URLSearchParams({ limit: "100" });
    if (starting_after) q.set("starting_after", starting_after);
    const page = await stripe(key, "GET", `${apiPath}?${q}`);
    out.push(...(page.data || []));
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return out;
}

const CATALOG = [
  {
    plan: "commerce",
    name: "Margin Commerce",
    description: "Starter — un commerce, stock + alertes + Copilote",
    monthly: 8900,
    yearly: 85400, // ~15% off vs 89*12
  },
  {
    plan: "reseau",
    name: "Margin Réseau",
    description: "Pro / franchise — jusqu’à 3 commerces, setup caisse inclus",
    monthly: 24900,
    yearly: 239000,
  },
];

const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
  "invoice.payment_succeeded",
];

async function ensureProduct(key, item, products) {
  let product = products.find(
    (p) => p.metadata?.margin_plan === item.plan || p.name === item.name
  );
  if (!product) {
    if (DRY) {
      console.log("[dry] create product", item.name);
      return { id: `dry_prod_${item.plan}` };
    }
    product = await stripe(key, "POST", "/products", {
      name: item.name,
      description: item.description,
      "metadata[margin_plan]": item.plan,
      // Requis sur comptes Live avec Managed Payments (SaaS)
      tax_code: "txcd_10103001",
    });
    console.log("created product", product.id, item.name);
  } else {
    console.log("reuse product", product.id, item.name);
  }
  return product;
}

async function ensurePrice(key, productId, plan, interval, amount, prices) {
  const existing = prices.find(
    (p) =>
      p.product === productId &&
      p.active !== false &&
      p.recurring?.interval === interval &&
      p.unit_amount === amount &&
      p.currency === "eur"
  );
  if (existing) {
    console.log("reuse price", existing.id, plan, interval, amount);
    return existing;
  }
  if (DRY) {
    console.log("[dry] create price", plan, interval, amount);
    return { id: `dry_price_${plan}_${interval}` };
  }
  const price = await stripe(key, "POST", "/prices", {
    product: productId,
    currency: "eur",
    unit_amount: String(amount),
    "recurring[interval]": interval,
    "metadata[margin_plan]": plan,
    "metadata[billing_period]": interval === "month" ? "monthly" : "yearly",
  });
  console.log("created price", price.id, plan, interval, amount);
  return price;
}

async function ensureWebhook(key) {
  const hooks = await listAll(key, "/webhook_endpoints");
  let hook = hooks.find((h) => h.url === WEBHOOK_URL);
  if (!hook) {
    if (DRY) {
      console.log("[dry] create webhook", WEBHOOK_URL);
      return { id: "dry_wh", secret: "whsec_dry" };
    }
    const body = {
      url: WEBHOOK_URL,
      "metadata[app]": "marginshop",
    };
    WEBHOOK_EVENTS.forEach((e, i) => {
      body[`enabled_events[${i}]`] = e;
    });
    hook = await stripe(key, "POST", "/webhook_endpoints", body);
    console.log("created webhook", hook.id);
  } else {
    console.log("reuse webhook", hook.id, hook.status);
    // Stripe does not return secret again on retrieve — only at creation
  }
  return hook;
}

async function main() {
  const key = loadKey();
  if (!key) {
    console.error(
      "Missing STRIPE_SECRET_KEY. Put sk_live_… in .env.stripe.live or export it."
    );
    process.exit(1);
  }
  const mode = key.startsWith("sk_live")
    ? "LIVE"
    : key.startsWith("sk_test")
      ? "TEST"
      : "UNKNOWN";
  console.log("Stripe mode:", mode);

  const products = await listAll(key, "/products");
  const prices = await listAll(key, "/prices");

  const out = {};
  for (const item of CATALOG) {
    const product = await ensureProduct(key, item, products);
    const monthly = await ensurePrice(
      key,
      product.id,
      item.plan,
      "month",
      item.monthly,
      prices
    );
    const yearly = await ensurePrice(
      key,
      product.id,
      item.plan,
      "year",
      item.yearly,
      prices
    );
    if (item.plan === "commerce") {
      out.STRIPE_PRICE_COMMERCE_MONTHLY = monthly.id;
      out.STRIPE_PRICE_COMMERCE_YEARLY = yearly.id;
    } else {
      out.STRIPE_PRICE_RESEAU_MONTHLY = monthly.id;
      out.STRIPE_PRICE_RESEAU_YEARLY = yearly.id;
    }
  }

  const hook = await ensureWebhook(key);

  console.log("\n=== Env à mettre sur Vercel Production ===");
  for (const [k, v] of Object.entries(out)) console.log(`${k}=${v}`);
  if (hook.secret) {
    console.log(`STRIPE_WEBHOOK_SECRET=${hook.secret}`);
    console.log(
      "(secret webhook visible uniquement à la création — copie-le maintenant)"
    );
  } else {
    console.log(
      "STRIPE_WEBHOOK_SECRET=… (déjà créé — récupère le whsec_ dans Dashboard → Webhooks → Reveal)"
    );
  }
  console.log(`# mode=${mode} webhook=${WEBHOOK_URL} id=${hook.id}`);

  const reportPath = path.join(process.cwd(), "stripe-catalog-report.json");
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ mode, webhookUrl: WEBHOOK_URL, hookId: hook.id, prices: out, hasNewSecret: Boolean(hook.secret) }, null, 2)
  );
  console.log("wrote", reportPath);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
