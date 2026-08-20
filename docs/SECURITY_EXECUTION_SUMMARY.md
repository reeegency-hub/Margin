# Sécurité MarginShop — résumé d’exécution

Date : 2026-08-20 (refresh live audit)  
Plan initial : `plan-securite-marginshop.md` · Audit live : canvas `margin-security-live-audit`

## Chantier 1 — Tenant scoping
**Fichiers** : `whatsapp/batch.ts`, `stock-engine.ts`, `actions.ts` (resend WA), `whatsapp-bot.ts`, `catalog/issues.ts`, `api/stripe/checkout`, `lib/db/tenant-scoped.ts`, `lib/tenant.ts`, `security/tenant-isolation.test.ts`, `actions/README.md`
**Tests** : `tsx src/lib/security/tenant-isolation.test.ts` + `npm run test:tenant`
**Reste ⚠️** : updates by id après find scoped (TOCTOU) — à migrer progressivement vers `updateMany` + restaurantId  
**Ops P0** : confirmer `DATABASE_URL` = rôle sans BYPASSRLS (`prisma/rls.sql`)

## Chantier 2 — Webhooks
**Déjà en place** : Stripe raw body + `constructEvent` + idempotency ; Twilio `validateRequest` ; POS HMAC/`timingSafeEqual` (v1)
**Durci 2026-08-20** : Twilio **status** fail-closed en prod (signature obligatoire, miroir inbound WA)
**Tests** : `src/lib/security/webhook-signatures.test.ts`

## Chantier 3 — Crons
**Déjà en place** : `assertCronAuthorized` sur les 4 routes
**Durci 2026-08-20** : **Bearer only** — `?secret=` retiré (`cron-auth.ts`, `ops/pos-health`)
**Tests** : rejet 401 sans Bearer + rejet query secret
**Ops** : vérifier `CRON_SECRET` 32+ chars ; maj jobs Vercel/cron → header Authorization

## Chantier 4 — Fallback LLM
**Fichiers** : `lib/llm/platform-quota.ts`, `lib/llm/router.ts`, modèle `PlatformLlmUsage`, cron stock-alerts anomaly check
**Flag** : toujours env-only `MARGIN_PLATFORM_LLM` (pas de toggle tenant)
**Tests** : `platform-llm-fallback.test.ts`

## Chantier 5 — Rôles admin
**Schema** : `UserRole`, `User.role`, `AdminAuditLog`
**Code** : `lib/auth/require-role.ts`, `admin/layout.tsx`, `requireAdminSession` via rôle + fallback email
**Backfill** : `npm run db:backfill-founder`
**Tests** : `admin-roles.test.ts`
**Transition** : `FOUNDER_EMAIL` / `isAdminEmail` encore utilisés en fallback — retirer après backfill prod vérifié

## Chantier 6 — Auth surface (2026-08-20)
- OTP signup **obligatoire en production** (`mustVerifySignupOtp`) ; fail-closed si Resend/Twilio absents
- Rate limit **login** + **partner login** (IP + email, fenêtre 15 min)
- Secrets : refuse fallbacks `*-dev` en prod (`lib/security/prod-secrets.ts`)
- `check:prod-env` : RESEND_API_KEY erreur en prod ; warn RLS

## Deploy checklist
- [ ] Confirmer jobs cron Vercel envoient `Authorization: Bearer $CRON_SECRET` (plus de `?secret=`)
- [ ] `RESEND_API_KEY` présent en prod (OTP)
- [ ] `NEXTAUTH_SECRET` / `PARTNER_AUTH_SECRET` posés (pas de fallback)
- [ ] Confirmer rôle DB sans BYPASSRLS + `rls.sql` appliqué
- [ ] `npm run db:backfill-founder` si pas déjà fait
- [ ] `DEMO_AUTO_LOGIN≠1`
