/**
 * Load test — pipeline ingest POS (SKU strict) sur SQLite local.
 *
 * Usage:
 *   npx tsx scripts/load-test-pos.ts
 *   TENANTS=60 EVENTS_PER=20 CONCURRENCY=10 npx tsx scripts/load-test-pos.ts
 *
 * Scénario : weekend soldes — N tenants × M ventes simultanées.
 * Mesure : throughput, latence p50/p95/p99, erreurs, backlog théorique cron (50/min).
 */
import { prisma } from "../src/lib/db";
import { ingestPosWebhook } from "../src/lib/pos/ingest";
import { generateWebhookSecret } from "../src/lib/credentials";

const TENANTS = Number(process.env.TENANTS || 60);
const EVENTS_PER = Number(process.env.EVENTS_PER || 20);
const CONCURRENCY = Number(process.env.CONCURRENCY || 10);
const CRON_CAPACITY_PER_MIN = 50;

type Sample = { ms: number; ok: boolean; status?: string };

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

async function ensureFixtures(tenantCount: number) {
  const connections: {
    restaurantId: string;
    connectionId: string;
    vendor: string;
    tenantIndex: number;
  }[] = [];

  for (let i = 0; i < tenantCount; i++) {
    const email = `loadtest-t${i}@marginshop.load`;
    let user = await prisma.user.findUnique({ where: { email } });
    let restaurantId: string;

    if (!user) {
      const r = await prisma.restaurant.create({
        data: {
          name: `LoadTest Magasin ${i + 1}`,
          active: true,
          plan: "commerce",
        },
      });
      restaurantId = r.id;
      const bcrypt = await import("bcryptjs");
      await prisma.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash("loadtest", 8),
          name: `LT ${i}`,
          restaurantId,
        },
      });
      const dish = await prisma.product.create({
        data: {
          restaurantId,
          name: `Produit LT ${i}`,
          salePrice: 2.5,
          externalSku: `LT-SKU-${i}`,
          active: true,
        },
      });
      const ing = await prisma.stockUnit.create({
        data: {
          restaurantId,
          name: `Stock LT ${i}`,
          unit: "u",
          stockTheoretical: 10_000,
          criticalThreshold: 10,
          reorderQty: 100,
        },
      });
      await prisma.productStock.create({
        data: {
          productId: dish.id,
          stockUnitId: ing.id,
          quantity: 1,
          unit: "u",
        },
      });
    } else {
      restaurantId = user.restaurantId;
      await prisma.product.updateMany({
        where: { restaurantId, externalSku: `LT-SKU-${i}` },
        data: { active: true },
      });
      const hasDish = await prisma.product.findFirst({
        where: { restaurantId, externalSku: `LT-SKU-${i}` },
      });
      if (!hasDish) {
        const dish = await prisma.product.create({
          data: {
            restaurantId,
            name: `Produit LT ${i}`,
            salePrice: 2.5,
            externalSku: `LT-SKU-${i}`,
            active: true,
          },
        });
        let ing = await prisma.stockUnit.findFirst({
          where: { restaurantId, name: `Stock LT ${i}` },
        });
        if (!ing) {
          ing = await prisma.stockUnit.create({
            data: {
              restaurantId,
              name: `Stock LT ${i}`,
              unit: "u",
              stockTheoretical: 10_000,
              criticalThreshold: 10,
              reorderQty: 100,
            },
          });
        }
        await prisma.productStock.create({
          data: {
            productId: dish.id,
            stockUnitId: ing.id,
            quantity: 1,
            unit: "u",
          },
        });
      }
    }

    let conn = await prisma.externalPosConnection.findFirst({
      where: { restaurantId, vendor: "zelty", name: "LoadTest Zelty" },
    });
    if (!conn) {
      conn = await prisma.externalPosConnection.create({
        data: {
          restaurantId,
          name: "LoadTest Zelty",
          vendor: "zelty",
          webhookSecret: generateWebhookSecret(),
          status: "CONNECTED",
        },
      });
    }
    connections.push({
      restaurantId,
      connectionId: conn.id,
      vendor: "zelty",
      tenantIndex: i,
    });
  }

  return connections;
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<Sample>
): Promise<Sample[]> {
  const results: Sample[] = new Array(items.length);
  let next = 0;

  async function runner() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runner())
  );
  return results;
}

async function main() {
  console.log("═══ Load test POS webhook pipeline ═══");
  console.log(
    JSON.stringify({ TENANTS, EVENTS_PER, CONCURRENCY, total: TENANTS * EVENTS_PER })
  );

  const t0setup = Date.now();
  const connections = await ensureFixtures(TENANTS);
  console.log(`Fixtures OK in ${Date.now() - t0setup}ms (${connections.length} tenants)`);

  const jobs: { conn: (typeof connections)[0]; eventIdx: number }[] = [];
  for (const conn of connections) {
    for (let e = 0; e < EVENTS_PER; e++) {
      jobs.push({ conn, eventIdx: e });
    }
  }

  const stamp = Date.now();
  const t0 = Date.now();
  const samples = await runPool(jobs, CONCURRENCY, async ({ conn, eventIdx }) => {
    const start = Date.now();
    try {
      const result = await ingestPosWebhook({
        restaurantId: conn.restaurantId,
        connectionId: conn.connectionId,
        vendor: conn.vendor,
        body: {
          order: {
            id: `lt-${stamp}-${conn.connectionId.slice(-6)}-${eventIdx}`,
            created_at: new Date().toISOString(),
            dishs: [
              {
                id: `LT-SKU-${conn.tenantIndex}`,
                name: "Produit LT",
                quantity: 1,
                price: 2.5,
              },
            ],
          },
        },
      });
      return {
        ms: Date.now() - start,
        ok: Boolean(
          result.status === "APPLIED" ||
            result.duplicate ||
            result.status === "IGNORED_DUP"
        ),
        status: result.status,
      };
    } catch (err) {
      return {
        ms: Date.now() - start,
        ok: false,
        status: err instanceof Error ? err.message.slice(0, 80) : "error",
      };
    }
  });

  const elapsed = Date.now() - t0;
  const latencies = samples.map((s) => s.ms).sort((a, b) => a - b);
  const ok = samples.filter((s) => s.ok).length;
  const fail = samples.length - ok;
  const throughput = (samples.length / elapsed) * 1000;

  const byStatus = new Map<string, number>();
  for (const s of samples) {
    const k = s.status || (s.ok ? "ok" : "fail");
    byStatus.set(k, (byStatus.get(k) || 0) + 1);
  }

  const report = {
    scenario: "weekend_soldes_60_tenants",
    tenants: TENANTS,
    eventsPerTenant: EVENTS_PER,
    concurrency: CONCURRENCY,
    totalEvents: samples.length,
    elapsedMs: elapsed,
    throughputPerSec: Math.round(throughput * 10) / 10,
    success: ok,
    failed: fail,
    latencyMs: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      max: latencies[latencies.length - 1] || 0,
    },
    statusBreakdown: Object.fromEntries(byStatus),
    cronCapacity: {
      retriesPerMinute: CRON_CAPACITY_PER_MIN,
      // Si tout le trafic live échoue et retombe en retry :
      minutesToDrainFullBurst: Math.ceil(samples.length / CRON_CAPACITY_PER_MIN),
      note: "Live path is sync-in-request; cron only drains FAILED/RECEIVED/DEFERRED",
    },
    saturationHints: {
      sqliteWriteLock: "SQLite serializes writers — concurrency>1 shows contention",
      vercelConnectionLimit: "Prod Supabase pooler connection_limit=1 per serverless instance",
      recommendedFor60:
        throughput > 30
          ? "Live sync OK for ~60 tenants if peak < 30 req/s sustained"
          : "Consider async ACK + worker scale before public self-serve",
    },
  };

  console.log(JSON.stringify(report, null, 2));

  const outPath = `scripts/load-test-pos-results-${stamp}.json`;
  const fs = await import("node:fs");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Wrote ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
