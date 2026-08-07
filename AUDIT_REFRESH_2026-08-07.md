# Audit MarginShop — refresh 2026-08-07

**Verdict :** Pilote Ops **GO** · Self-serve public **NO-GO** · Scale 60+ **NO-GO**

Canvas : `marginshop-audit-refresh.canvas.tsx`

---

## Manque (priorisé)

| Prio | Manque | Qui |
|------|--------|-----|
| **P0** | Domaine Resend `marginshop.app` réellement accepté → from `contact@` | Toi |
| **P0** | Parcours UI `/signup` → OTP → Checkout 4242 → onboarding → app | Toi + agent |
| **P0** | `WHATSAPP_REQUIRE_TEMPLATES=1` sans SIDs Meta → poser SIDs **ou** remettre `0` | Toi |
| **P1** | Stripe **live** (`sk_live` / `pk_live` + prices + webhook) | Toi + agent |
| **P1** | Confirmer `NEXTAUTH_URL` / `WEBHOOK_BASE_URL` = URL publique sur Vercel (fichier local périmé) | Agent |
| **P2** | Templates Meta WA (stock + dunning) | Toi |
| **P2** | Neon PITR / backups > 6h | Toi |
| **P2** | Preuve RLS 2-tenants + `assertCanAddStore` branché | Agent |

---

## Déjà OK (depuis le dernier audit)

- Stripe test : 4 prices, webhook, coupon affiliation −20 %
- `hasAppAccess` / grâce / dunning non silencieux
- Calendly live sur `/welcome#demo`
- Resend API key posée (from temporaire `onboarding@resend.dev`)
- Caisse pilote + stock smoke
- Portal facturation Settings
- `maxProducts`, DEAD soft replay, `CRON_SECRET`, `DEMO_AUTO_LOGIN=0`

---

## Modes

| Mode | Statut |
|------|--------|
| `/admin` + Calendly | **GO** demain commercial |
| `/signup` public | **NO-GO** tant que Resend domaine + OTP UI |
| Annoncer signup + Stripe live | **NO-GO** |
