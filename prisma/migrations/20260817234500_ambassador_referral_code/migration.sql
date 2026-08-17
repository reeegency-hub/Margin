-- AlterTable
ALTER TABLE "Ambassador" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Ambassador_referralCode_key" ON "Ambassador"("referralCode");

-- Farel = premier ambassadeur
UPDATE "Ambassador"
SET "referralCode" = 'AMB-FAREL'
WHERE email = 'reeegency+farel@gmail.com'
  AND ("referralCode" IS NULL OR "referralCode" = '');
