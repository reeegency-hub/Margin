/**
 * Applique le DDL sécurité (UserRole, AdminAuditLog, PlatformLlmUsage, whatsappTo unique)
 * via le client Prisma connecté (utile quand `prisma db push` ne passe pas sur l’URL pooler).
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const statements = [
    `DO $$ BEGIN
      CREATE TYPE "UserRole" AS ENUM ('MEMBER', 'MANAGER', 'FOUNDER');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'MEMBER';`,
    `CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
      "id" TEXT PRIMARY KEY,
      "actorId" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "targetId" TEXT,
      "metadata" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS "AdminAuditLog_actorId_idx" ON "AdminAuditLog"("actorId");`,
    `CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");`,
    `CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");`,
    `DO $$ BEGIN
      ALTER TABLE "AdminAuditLog"
        ADD CONSTRAINT "AdminAuditLog_actorId_fkey"
        FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;`,
    `CREATE TABLE IF NOT EXISTS "PlatformLlmUsage" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "date" TIMESTAMP(3) NOT NULL,
      "count" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PlatformLlmUsage_tenantId_date_key"
      ON "PlatformLlmUsage"("tenantId", "date");`,
    `CREATE INDEX IF NOT EXISTS "PlatformLlmUsage_date_idx" ON "PlatformLlmUsage"("date");`,
  ];

  for (const sql of statements) {
    await p.$executeRawUnsafe(sql);
  }

  // Unique whatsappTo — après check doublons (script parent)
  await p.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Restaurant_whatsappTo_key" ON "Restaurant"("whatsappTo");`
  );

  console.log(JSON.stringify({ ok: true, step: "ddl" }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
