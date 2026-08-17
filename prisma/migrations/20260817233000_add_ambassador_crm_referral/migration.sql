-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "lastInvoiceAmountCents" INTEGER;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "lastInvoiceAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Ambassador" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ambassador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Prospect" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "city" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "nextFollowUpAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AmbassadorReferral" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "commissionPercent" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmbassadorReferral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Ambassador_email_key" ON "Ambassador"("email");
CREATE INDEX IF NOT EXISTS "Prospect_ambassadorId_status_idx" ON "Prospect"("ambassadorId", "status");
CREATE INDEX IF NOT EXISTS "Prospect_ambassadorId_nextFollowUpAt_idx" ON "Prospect"("ambassadorId", "nextFollowUpAt");
CREATE UNIQUE INDEX IF NOT EXISTS "AmbassadorReferral_restaurantId_key" ON "AmbassadorReferral"("restaurantId");
CREATE INDEX IF NOT EXISTS "AmbassadorReferral_ambassadorId_idx" ON "AmbassadorReferral"("ambassadorId");

DO $$ BEGIN
  ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AmbassadorReferral" ADD CONSTRAINT "AmbassadorReferral_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AmbassadorReferral" ADD CONSTRAINT "AmbassadorReferral_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
