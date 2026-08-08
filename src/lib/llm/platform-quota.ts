/**
 * Quota + journal pour le fallback LLM plateforme (MARGIN_PLATFORM_LLM=1).
 * Jamais de clé API dans les logs.
 */
import { prisma } from "@/lib/db";

export class PlatformQuotaExceededError extends Error {
  constructor(public tenantId: string) {
    super(`Quota fallback LLM plateforme dépassé pour le tenant ${tenantId}`);
    this.name = "PlatformQuotaExceededError";
  }
}

const DAILY_FALLBACK_LIMIT = Number(
  process.env.MARGIN_PLATFORM_LLM_DAILY_LIMIT || "50"
);
const GLOBAL_DAILY_ALERT_THRESHOLD = Number(
  process.env.MARGIN_PLATFORM_LLM_GLOBAL_ALERT || "500"
);

function startOfUtcDay(d = new Date()): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

export async function logPlatformFallbackUsed(opts: {
  tenantId: string;
  estimatedTokens?: number;
}): Promise<void> {
  console.info(
    JSON.stringify({
      type: "platform_fallback_used",
      tenantId: opts.tenantId,
      estimatedTokens: opts.estimatedTokens ?? null,
      ts: new Date().toISOString(),
    })
  );
}

export async function incrementPlatformFallbackUsage(
  tenantId: string
): Promise<number> {
  const date = startOfUtcDay();
  const usage = await prisma.platformLlmUsage.upsert({
    where: { tenantId_date: { tenantId, date } },
    create: { tenantId, date, count: 1 },
    update: { count: { increment: 1 } },
  });

  if (usage.count > DAILY_FALLBACK_LIMIT) {
    console.warn(
      JSON.stringify({
        type: "platform_fallback_quota_exceeded",
        tenantId,
        count: usage.count,
        limit: DAILY_FALLBACK_LIMIT,
      })
    );
    throw new PlatformQuotaExceededError(tenantId);
  }

  return usage.count;
}

/** Alerte ops si usage global journalier anormal (à appeler depuis un cron). */
export async function checkPlatformFallbackAnomaly(): Promise<{
  total: number;
  alerted: boolean;
}> {
  const date = startOfUtcDay();
  const agg = await prisma.platformLlmUsage.aggregate({
    where: { date },
    _sum: { count: true },
  });
  const total = agg._sum.count ?? 0;
  if (total > GLOBAL_DAILY_ALERT_THRESHOLD) {
    console.warn(
      JSON.stringify({
        type: "platform_fallback_global_anomaly",
        total,
        threshold: GLOBAL_DAILY_ALERT_THRESHOLD,
      })
    );
    return { total, alerted: true };
  }
  return { total, alerted: false };
}

export function estimateTokensRough(
  messages: Array<{ content?: string | null }>
): number {
  const chars = messages.reduce(
    (n, m) => n + (typeof m.content === "string" ? m.content.length : 0),
    0
  );
  return Math.max(1, Math.ceil(chars / 4));
}
