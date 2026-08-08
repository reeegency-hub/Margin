-- BYOK LLM + Setup Agent drafts (tables absentes de l'init prod)
-- Safe: CREATE IF NOT EXISTS pattern via Prisma migration

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlatformLlmUsage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformLlmUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LlmProviderCredential" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedKey" TEXT,
    "encryptionIv" TEXT,
    "keyFingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'untested',
    "lastValidatedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlmProviderCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LlmProviderCredentialEvent" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmProviderCredentialEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AssistantDraft" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sourceFileName" TEXT,
    "sourceFileId" TEXT,
    "payloadJson" TEXT NOT NULL,
    "flagsJson" TEXT NOT NULL DEFAULT '[]',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "committedAt" TIMESTAMP(3),
    "commitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AssistantCommit" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "resultJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantCommit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminAuditLog_actorId_idx" ON "AdminAuditLog"("actorId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformLlmUsage_tenantId_date_key" ON "PlatformLlmUsage"("tenantId", "date");
CREATE INDEX IF NOT EXISTS "PlatformLlmUsage_date_idx" ON "PlatformLlmUsage"("date");

CREATE UNIQUE INDEX IF NOT EXISTS "LlmProviderCredential_restaurantId_provider_key" ON "LlmProviderCredential"("restaurantId", "provider");
CREATE INDEX IF NOT EXISTS "LlmProviderCredential_restaurantId_status_idx" ON "LlmProviderCredential"("restaurantId", "status");

CREATE INDEX IF NOT EXISTS "LlmProviderCredentialEvent_credentialId_createdAt_idx" ON "LlmProviderCredentialEvent"("credentialId", "createdAt");

CREATE INDEX IF NOT EXISTS "AssistantDraft_restaurantId_status_createdAt_idx" ON "AssistantDraft"("restaurantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "AssistantDraft_expiresAt_idx" ON "AssistantDraft"("expiresAt");

CREATE INDEX IF NOT EXISTS "AssistantCommit_restaurantId_createdAt_idx" ON "AssistantCommit"("restaurantId", "createdAt");
CREATE INDEX IF NOT EXISTS "AssistantCommit_draftId_idx" ON "AssistantCommit"("draftId");

-- AddForeignKey (ignore if already present)
DO $$ BEGIN
  ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LlmProviderCredential" ADD CONSTRAINT "LlmProviderCredential_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LlmProviderCredentialEvent" ADD CONSTRAINT "LlmProviderCredentialEvent_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "LlmProviderCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AssistantDraft" ADD CONSTRAINT "AssistantDraft_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AssistantCommit" ADD CONSTRAINT "AssistantCommit_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
