# Sécurité MarginShop — résumé d’exécution

Date : 2026-08-20 (refresh post-ship)  
Plan initial : `plan-securite-marginshop.md` · Audit live : canvas `margin-security-live-audit`

## Chantier 1 — Tenant scoping
**Fichiers** : `whatsapp/batch.ts`, `stock-engine.ts`, `actions.ts`, `whatsapp-bot.ts`, `catalog/issues.ts`, `api/stripe/checkout`, `lib/db/tenant-scoped.ts`, `lib/tenant.ts`, tests tenant
**Tests** : `tsx src/lib/security/tenant-isolation.test.ts` + `npm run test:tenant` (vert)
**TOCTOU** : passes 1–3 (catalog/inventory/assistant/channels/delivery, thresholds/pos/retail/LLM, catalogIssue/POS connection/WA outbound)
**RLS Neon** : policies ENABLE sur tables tenant + rôle `margin_app` (NOBYPASSRLS) via `scripts/setup-margin-app-rls.ts`
**Reste** : app tourne encore en `neondb_owner` (bypass) — cutover `DATABASE_URL`→`margin_app` **après** généralisation `withTenantRls` / client admin séparé

## Chantier 2 — Webhooks
**OK** : Stripe raw body + `constructEvent` + idempotency ; Twilio inbound + **status** fail-closed en prod ; POS HMAC ; delivery timing-safe + HMAC `x-margin-signature`
**Tests** : `src/lib/security/webhook-signatures.test.ts`

## Chantier 3 — Crons
**OK** : `assertCronAuthorized` Bearer only (`?secret=` retiré) sur stock-alerts / pos-process / pos-recon / stripe-sync + ops/pos-health
**Ops** : Vercel Cron envoie automatiquement `Authorization: Bearer $CRON_SECRET` si la var est définie (présente en prod)

## Chantier 4 — Fallback LLM
**OK** : `MARGIN_PLATFORM_LLM` env-only + quota `PlatformLlmUsage`
**Tests** : `platform-llm-fallback.test.ts`

## Chantier 5 — Rôles admin
**OK** : `UserRole`, `require-role`, layout admin
**Ops** : `npm run db:backfill-founder` — retirer fallback `FOUNDER_EMAIL` / `isAdminEmail` après vérif prod

## Chantier 6 — Auth surface
- OTP signup obligatoire en prod (`mustVerifySignupOtp`)
- Rate limit login + partner (mémoire ; Upstash si `UPSTASH_REDIS_REST_*`)
- Secrets : refuse fallbacks `*-dev` en prod
- `PARTNER_AUTH_SECRET` optionnel (fallback `NEXTAUTH_SECRET`)

## Chantier 7 — P2
- Headers CSP / XFO / nosniff / referrer / Permissions-Policy ; `poweredByHeader: false`
- Uploads magic bytes ; `User.sessionVersion` ; POS v1 GET réduit

## Deploy checklist
- [x] Crons Bearer (`CRON_SECRET` en prod + Vercel Cron auto-header)
- [x] `RESEND_API_KEY` présent en prod (OTP)
- [x] `NEXTAUTH_SECRET` posé (`PARTNER_AUTH_SECRET` optionnel)
- [x] `setup-margin-app-rls.ts` exécuté (policies + rôle) — **sans** cutover URL
- [x] `DEMO_AUTO_LOGIN=0` en prod
- [x] `npm run db:backfill-founder` vérifié
- [ ] Optionnel : Upstash Redis rate limit multi-instance
- [ ] Cutover `margin_app` **après** généralisation `withTenantRls`
