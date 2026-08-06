/**
 * Garde-fous prod vs CI locale.
 * Usage: npm run check:prod-env
 *
 * Échoue en CI si DATABASE_URL pointe encore vers SQLite alors que
 * VERCEL_ENV=production, ou si CRON_SECRET est vide en prod.
 */
const url = process.env.DATABASE_URL || "";
const cron = process.env.CRON_SECRET || "";
const vercelEnv = process.env.VERCEL_ENV || "";
const nodeEnv = process.env.NODE_ENV || "";
const pretendProd =
  process.env.CHECK_AS_PROD === "1" ||
  vercelEnv === "production" ||
  (nodeEnv === "production" && !process.env.ALLOW_SQLITE_PROD);

const errors: string[] = [];
const warns: string[] = [];

const isSqlite =
  url.startsWith("file:") ||
  url.includes("sqlite") ||
  url.endsWith(".db");

if (pretendProd) {
  if (isSqlite || !url) {
    errors.push(
      "DATABASE_URL doit être Postgres en production (SQLite / vide interdit)."
    );
  }
  if (!cron) {
    errors.push("CRON_SECRET obligatoire en production (crons sinon ouverts).");
  }
} else {
  if (isSqlite) {
    warns.push(
      "DATABASE_URL = SQLite — OK en local ; prod Vercel doit être Postgres."
    );
  }
  if (!cron) {
    warns.push("CRON_SECRET vide — OK en local ; requis dès le déploiement.");
  }
}

for (const w of warns) console.warn("[check:prod-env]", w);
if (errors.length) {
  for (const e of errors) console.error("[check:prod-env]", e);
  process.exit(1);
}

console.log("[check:prod-env] ok");
