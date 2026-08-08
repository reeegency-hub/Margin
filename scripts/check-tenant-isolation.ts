/**
 * Auto-check isolation multi-tenant (shared schema + restaurantId).
 *
 * Usage: npm run test:tenant
 *
 * Vérifie :
 * 1. Chaque model Prisma avec restaurantId est listé dans TENANT_SCOPED_MODELS
 * 2. Requêtes prisma dangereuses sans filtre restaurantId (heuristique)
 * 3. Nouveaux models enfants documentés
 *
 * À lancer après chaque feature (et dans test:unit).
 */
import fs from "node:fs";
import path from "node:path";
import {
  TENANT_CHILD_MODELS,
  TENANT_SCOPED_MODELS,
} from "../src/lib/tenant";

const ROOT = path.resolve(__dirname, "..");
const SCHEMA = path.join(ROOT, "prisma", "schema.prisma");
const SRC = path.join(ROOT, "src");

type Finding = { file: string; line: number; message: string; severity: "error" | "warn" };

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function parseSchemaModels(schema: string): {
  withTenant: string[];
  withoutTenant: string[];
  all: string[];
} {
  const blocks = schema.split(/(?=^model\s+)/m);
  const withTenant: string[] = [];
  const withoutTenant: string[] = [];
  const all: string[] = [];

  for (const block of blocks) {
    const m = block.match(/^model\s+(\w+)/);
    if (!m) continue;
    const name = m[1];
    all.push(name);
    if (name === "Restaurant") continue;
    if (/restaurantId\s+String/.test(block)) withTenant.push(name);
    else withoutTenant.push(name);
  }
  return { withTenant, withoutTenant, all };
}

/** Paths where unscoped / cross-tenant access is intentional. */
const ALLOW_PATH_RE =
  /(\/admin\/|seed|demo-login|stripe\/|cron\/|ops\/|scripts\/|tenant\.ts|check-tenant|pos\/health|whatsapp\/|webhooks\/|newsletter\.ts|llm\/|catalog\/)/;

const DANGEROUS_OPS = [
  "findMany",
  "findFirst",
  "findUnique",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
  "create",
  "createMany",
  "count",
  "aggregate",
  "groupBy",
] as const;

function prismaModelToClient(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function scanFile(
  file: string,
  tenantModels: string[]
): Finding[] {
  const findings: Finding[] = [];
  const rel = path.relative(ROOT, file);
  if (ALLOW_PATH_RE.test(rel.replace(/\\/g, "/"))) return findings;

  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");

  const clientNames = tenantModels.map(prismaModelToClient);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const model of clientNames) {
      for (const op of DANGEROUS_OPS) {
        const re = new RegExp(`prisma\\.${model}\\.${op}\\s*\\(`);
        if (!re.test(line)) continue;

        // Fenêtre : 8 lignes avant + 14 après (contexte restaurantId)
        const window = lines
          .slice(Math.max(0, i - 8), Math.min(lines.length, i + 14))
          .join("\n");
        const hasTenant =
          /restaurantId/.test(window) ||
          /tenantWhere\(/.test(window) ||
          /withTenantWhere\(/.test(window) ||
          /withTenantRls\(/.test(window);

        // Auth globale : email unique (signup / login) — pas un leak tenant
        if (
          model === "user" &&
          (op === "findUnique" || op === "findFirst") &&
          /email/.test(window)
        ) {
          continue;
        }

        // Webhook delivery : lookup par secret (auth) puis scope restaurantId
        if (
          model === "deliveryPlatformConnection" &&
          (op === "findFirst" || op === "findUnique") &&
          /webhookSecret/.test(window)
        ) {
          continue;
        }

        // create({ data: { restaurantId } }) — ok
        // findUnique({ where: { id } }) sans restaurantId — danger
        const isIdOnlyUnique =
          op === "findUnique" &&
          /where\s*:\s*\{\s*id\s*:/.test(window) &&
          !/restaurantId/.test(window);

        if (op === "create" || op === "createMany") {
          if (!hasTenant) {
            findings.push({
              file: rel,
              line: i + 1,
              severity: "error",
              message: `prisma.${model}.${op} sans restaurantId — risque cross-tenant`,
            });
          }
          continue;
        }

        if (!hasTenant || isIdOnlyUnique) {
          findings.push({
            file: rel,
            line: i + 1,
            severity: isIdOnlyUnique ? "warn" : "error",
            message: isIdOnlyUnique
              ? `prisma.${model}.${op} par id seul — vérifier assertSameTenant / where restaurantId`
              : `prisma.${model}.${op} sans filtre restaurantId visible`,
          });
        }
      }
    }
  }

  return findings;
}

function main() {
  const schema = fs.readFileSync(SCHEMA, "utf8");
  const { withTenant, withoutTenant } = parseSchemaModels(schema);
  const findings: Finding[] = [];

  // 1. Registry sync
  for (const m of withTenant) {
    if (!TENANT_SCOPED_MODELS.has(m)) {
      findings.push({
        file: "src/lib/tenant.ts",
        line: 1,
        severity: "error",
        message: `Model Prisma "${m}" a restaurantId mais n’est pas dans TENANT_SCOPED_MODELS — ajoute-le`,
      });
    }
  }
  for (const m of TENANT_SCOPED_MODELS) {
    if (!withTenant.includes(m)) {
      findings.push({
        file: "src/lib/tenant.ts",
        line: 1,
        severity: "error",
        message: `TENANT_SCOPED_MODELS contient "${m}" absent du schema (ou sans restaurantId)`,
      });
    }
  }

  for (const m of withoutTenant) {
    if (m === "Restaurant") continue;
    if (!TENANT_CHILD_MODELS.has(m) && !TENANT_SCOPED_MODELS.has(m)) {
      findings.push({
        file: "src/lib/tenant.ts",
        line: 1,
        severity: "warn",
        message: `Model "${m}" sans restaurantId — ajouter à TENANT_CHILD_MODELS (isolation via parent) ou scoper`,
      });
    }
  }

  // 2. Scan source
  for (const file of walk(SRC)) {
    findings.push(...scanFile(file, withTenant));
  }

  // 3. RLS file exists
  const rls = path.join(ROOT, "prisma", "rls.sql");
  if (!fs.existsSync(rls)) {
    findings.push({
      file: "prisma/rls.sql",
      line: 1,
      severity: "error",
      message: "Fichier RLS manquant",
    });
  }

  const errors = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warn");

  console.log("═══ Tenant isolation check ═══");
  console.log(`Models tenant-scopés (schema): ${withTenant.length}`);
  console.log(`Findings: ${errors.length} error(s), ${warns.length} warn(s)`);

  for (const f of [...errors, ...warns]) {
    const tag = f.severity === "error" ? "ERROR" : "WARN ";
    console.log(`${tag} ${f.file}:${f.line} — ${f.message}`);
  }

  if (errors.length) {
    console.log("\nÉchec : corrige l’isolation tenant avant de merger la feature.");
    process.exit(1);
  }

  console.log("\nOK — isolation tenant (heuristique) verte.");
  process.exit(0);
}

main();
