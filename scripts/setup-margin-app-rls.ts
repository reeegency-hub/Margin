/**
 * Crée le rôle `margin_app` (sans BYPASSRLS), grants, applique prisma/rls.sql.
 *
 * Usage: npx tsx scripts/setup-margin-app-rls.ts
 *
 * Ne change PAS DATABASE_URL (cutover dangereux tant que withTenantRls
 * n’est pas généralisé). Écrit l’URL cutover dans `.margin-app-url.local`
 * (gitignored) — ne l’affiche pas en clair dans les logs.
 */
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

/** Split SQL on `;` hors commentaires et hors blocs dollar-quoted (`$$` / `$tag$`). */
function splitSql(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let i = 0;
  let inLineComment = false;
  let dollarTag: string | null = null;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      buf += ch;
      if (ch === "\n") inLineComment = false;
      i += 1;
      continue;
    }

    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        buf += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      buf += ch;
      i += 1;
      continue;
    }

    if (ch === "-" && next === "-") {
      inLineComment = true;
      buf += ch;
      i += 1;
      continue;
    }

    if (ch === "$") {
      const m = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) {
        dollarTag = m[0];
        buf += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }

    if (ch === ";") {
      const stmt = buf.trim();
      if (
        stmt &&
        !stmt.split("\n").every((l) => !l.trim() || l.trim().startsWith("--"))
      ) {
        out.push(stmt.endsWith(";") ? stmt : `${stmt};`);
      }
      buf = "";
      i += 1;
      continue;
    }

    buf += ch;
    i += 1;
  }

  const tail = buf.trim();
  if (
    tail &&
    !tail.split("\n").every((l) => !l.trim() || l.trim().startsWith("--"))
  ) {
    out.push(tail.endsWith(";") ? tail : `${tail};`);
  }
  return out;
}

function buildAppUrl(password: string, role: string): string {
  const raw = process.env.DATABASE_URL || "";
  let host = "HOST";
  let db = "neondb";
  let qs = "?sslmode=require";
  try {
    const u = new URL(raw);
    host = u.host;
    db = u.pathname.replace(/^\//, "") || "neondb";
    qs = u.search || "?sslmode=require";
  } catch {
    /* fallback host/db above */
  }
  return `postgresql://${role}:${encodeURIComponent(password)}@${host}/${db}${qs.startsWith("?") ? qs : `?${qs}`}`;
}

async function main() {
  const prisma = new PrismaClient();
  const password =
    process.env.MARGIN_APP_PASSWORD?.trim() ||
    randomBytes(24).toString("base64url");
  const role = "margin_app";
  const pwdSql = password.replace(/'/g, "''");

  try {
    const before = await prisma.$queryRawUnsafe<
      { u: string; bypass: boolean }[]
    >(
      `SELECT current_user as u,
              (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) as bypass`
    );
    console.log("[rls] connected as", before[0]);

    // Neon: neondb_owner n’est pas SUPERUSER — ne pas toucher à SUPERUSER.
    await prisma.$executeRawUnsafe(`
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
    CREATE ROLE ${role} LOGIN PASSWORD '${pwdSql}'
      NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  ELSE
    ALTER ROLE ${role} WITH LOGIN PASSWORD '${pwdSql}'
      NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;
`);

    for (const stmt of [
      `GRANT USAGE ON SCHEMA public TO ${role}`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`,
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`,
    ]) {
      await prisma.$executeRawUnsafe(stmt);
    }

    const sqlPath = resolve(process.cwd(), "prisma/rls.sql");
    const statements = splitSql(readFileSync(sqlPath, "utf8"));
    let applied = 0;
    let skipped = 0;
    for (const stmt of statements) {
      const trimmed = stmt.trim().replace(/;$/, "");
      if (/^(BEGIN|COMMIT)$/i.test(trimmed)) continue;
      try {
        await prisma.$executeRawUnsafe(stmt);
        applied += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Ne PAS ROLLBACK : chaque statement est auto-commit ; un ROLLBACK
        // annulait CREATE FUNCTION / ENABLE RLS déjà appliqués.
        if (/does not exist|already exists/i.test(msg)) {
          skipped += 1;
          console.warn("[rls] skip:", msg.slice(0, 160).replace(/\s+/g, " "));
          continue;
        }
        throw err;
      }
    }
    console.log(`[rls] statements applied=${applied} skipped=${skipped}`);

    const sample = await prisma.$queryRawUnsafe<
      { t: string; rls: boolean }[]
    >(
      `SELECT c.relname as t, c.relrowsecurity as rls
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r'
         AND c.relname IN ('User','Sale','Alert','Restaurant','Ingredient','Dish','RecipeIngredient')
       ORDER BY 1`
    );
    console.log("[rls] table flags", sample);

    const enabled = sample.filter((r) => r.rls).length;
    if (enabled < sample.length) {
      throw new Error(
        `[rls] expected RLS on sample tables, got ${enabled}/${sample.length}`
      );
    }

    const roleInfo = await prisma.$queryRawUnsafe<
      { rolname: string; bypass: boolean; canlogin: boolean }[]
    >(
      `SELECT rolname, rolbypassrls as bypass, rolcanlogin as canlogin
       FROM pg_roles WHERE rolname = '${role}'`
    );
    console.log("[rls] role", roleInfo[0]);

    const cutoverUrl = buildAppUrl(password, role);
    const outPath = resolve(process.cwd(), ".margin-app-url.local");
    writeFileSync(
      outPath,
      `# Cutover futur — NE PAS poser tant que withTenantRls incomplet\nDATABASE_URL=${cutoverUrl}\n`,
      { mode: 0o600 }
    );

    console.log(
      "\n[rls] OK — policies ON (owner bypass encore actif → app inchangée)."
    );
    console.log(`[rls] cutover URL écrite dans ${outPath} (gitignored)`);
    console.log(
      "[rls] pwd fingerprint:",
      createHash("sha256").update(password).digest("hex").slice(0, 12)
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
