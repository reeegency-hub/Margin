# Sécurité MarginShop — résumé d’exécution

Date : 2026-08-08  
Plan : `plan-securite-marginshop.md`

## Chantier 1 — Tenant scoping
**Fichiers** : `whatsapp/batch.ts`, `stock-engine.ts`, `actions.ts` (resend WA), `whatsapp-bot.ts`, `catalog/issues.ts`, `api/stripe/checkout`, `lib/db/tenant-scoped.ts`, `lib/tenant.ts`, `security/tenant-isolation.test.ts`, `actions/README.md`
**Tests** : `tsx src/lib/security/tenant-isolation.test.ts` + `npm run test:tenant`
**Reste ⚠️** : updates by id après find scoped (TOCTOU) — à migrer progressivement vers `updateMany` + restaurantId

## Chantier 2 — Webhooks
**Déjà en place** : Stripe raw body + `constructEvent` + idempotency ; Twilio `validateRequest` ; POS HMAC/`timingSafeEqual` (v1)
**Durci** : POS `[connectionId]` → `authenticatePosWebhook` ; WhatsApp prod refuse sans signature ; GET POS réduit (id/status only)
**Tests** : `src/lib/security/webhook-signatures.test.ts`

## Chantier 3 — Crons
**Déjà en place** : `assertCronAuthorized` sur les 4 routes
**Tests** : rejet 401 sans Bearer dans `webhook-signatures.test.ts`
**Ops** : vérifier `CRON_SECRET` 32+ chars distinct par env Vercel

## Chantier 4 — Fallback LLM
**Fichiers** : `lib/llm/platform-quota.ts`, `lib/llm/router.ts`, modèle `PlatformLlmUsage`, cron stock-alerts anomaly check
**Flag** : toujours env-only `MARGIN_PLATFORM_LLM` (pas de toggle tenant)
**Tests** : `platform-llm-fallback.test.ts`
**Deploy** : `prisma db push` / migrate pour `PlatformLlmUsage`

## Chantier 5 — Rôles admin
**Schema** : `UserRole`, `User.role`, `AdminAuditLog`
**Code** : `lib/auth/require-role.ts`, `admin/layout.tsx`, `requireAdminSession` via rôle + fallback email
**Backfill** : `npm run db:backfill-founder`
**Tests** : `admin-roles.test.ts`
**Transition** : `FOUNDER_EMAIL` / `isAdminEmail` encore utilisés en fallback — retirer après backfill prod vérifié

## Deploy checklist
- [ ] `npx prisma db push` (ou migrate) en prod
- [ ] `npm run db:backfill-founder`
- [ ] Confirmer `CRON_SECRET`, `STRIPE_WEBHOOK_SECRET`, `TWILIO_AUTH_TOKEN`, `WEBHOOK_BASE_URL`
- [ ] `MARGIN_PLATFORM_LLM` volontairement off sauf besoin Ops
