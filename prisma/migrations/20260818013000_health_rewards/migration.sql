-- User login tracking (score santé engagement)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

-- RewardEvent — ledger commissions ambassadeur par facture
CREATE TABLE IF NOT EXISTS "RewardEvent" (
  "id" TEXT NOT NULL,
  "ambassadorId" TEXT NOT NULL,
  "referralId" TEXT NOT NULL,
  "referredRestaurantId" TEXT NOT NULL,
  "stripeInvoiceId" TEXT,
  "invoiceAmountCents" INTEGER NOT NULL,
  "commissionPercent" INTEGER NOT NULL,
  "commissionCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'validated',
  "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RewardEvent_stripeInvoiceId_key"
  ON "RewardEvent"("stripeInvoiceId");
CREATE INDEX IF NOT EXISTS "RewardEvent_ambassadorId_earnedAt_idx"
  ON "RewardEvent"("ambassadorId", "earnedAt");
CREATE INDEX IF NOT EXISTS "RewardEvent_referralId_earnedAt_idx"
  ON "RewardEvent"("referralId", "earnedAt");
CREATE INDEX IF NOT EXISTS "RewardEvent_status_earnedAt_idx"
  ON "RewardEvent"("status", "earnedAt");

DO $$ BEGIN
  ALTER TABLE "RewardEvent" ADD CONSTRAINT "RewardEvent_ambassadorId_fkey"
    FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RewardEvent" ADD CONSTRAINT "RewardEvent_referralId_fkey"
    FOREIGN KEY ("referralId") REFERENCES "AmbassadorReferral"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RewardEvent" ADD CONSTRAINT "RewardEvent_referredRestaurantId_fkey"
    FOREIGN KEY ("referredRestaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
