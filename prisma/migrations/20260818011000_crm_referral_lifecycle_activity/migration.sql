-- Ambassador: type + lifecycle status (distinct de User.role)
ALTER TABLE "Ambassador" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'apporteur_affaires';
ALTER TABLE "Ambassador" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'actif';

UPDATE "Ambassador"
SET "status" = CASE WHEN "active" = true THEN 'actif' ELSE 'inactif' END
WHERE "status" IS NULL OR "status" = '';

UPDATE "Ambassador"
SET "type" = 'apporteur_affaires'
WHERE "type" IS NULL OR "type" = '';

UPDATE "Ambassador"
SET "type" = 'apporteur_affaires', "status" = 'actif'
WHERE email = 'reeegency+farel@gmail.com';

-- Referral lifecycle (table physique AmbassadorReferral, modèle Prisma Referral)
ALTER TABLE "AmbassadorReferral" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'signed_up';
ALTER TABLE "AmbassadorReferral" ADD COLUMN IF NOT EXISTS "signedUpAt" TIMESTAMP(3);
ALTER TABLE "AmbassadorReferral" ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3);
ALTER TABLE "AmbassadorReferral" ADD COLUMN IF NOT EXISTS "churnedAt" TIMESTAMP(3);
ALTER TABLE "AmbassadorReferral" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "AmbassadorReferral"
SET
  "status" = 'signed_up',
  "signedUpAt" = COALESCE("signedUpAt", "createdAt"),
  "updatedAt" = COALESCE("updatedAt", "createdAt")
WHERE "status" IS NULL OR "status" = '';

CREATE INDEX IF NOT EXISTS "AmbassadorReferral_ambassadorId_status_idx"
  ON "AmbassadorReferral"("ambassadorId", "status");

-- ActivityLog — timeline unifiée
CREATE TABLE IF NOT EXISTS "ActivityLog" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "restaurantId" TEXT,
  "ambassadorId" TEXT,
  "referralId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ActivityLog_restaurantId_createdAt_idx"
  ON "ActivityLog"("restaurantId", "createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_ambassadorId_createdAt_idx"
  ON "ActivityLog"("ambassadorId", "createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_kind_createdAt_idx"
  ON "ActivityLog"("kind", "createdAt");

DO $$ BEGIN
  ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_ambassadorId_fkey"
    FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
