#!/usr/bin/env bash
# Génère les secrets prod (ne touche pas Twilio / Stripe / DB).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/.env.production.local}"

NEXTAUTH_SECRET="$(openssl rand -base64 32)"
CRON_SECRET="$(openssl rand -hex 24)"
CREDENTIALS_ENCRYPTION_KEY="$(openssl rand -hex 32)"

cat > "$OUT" <<EOF
# Margin Shop — secrets générés $(date -u +%Y-%m-%dT%H:%MZ)
# Coller aussi dans Vercel → Settings → Environment Variables (Production)

# --- À remplir (Supabase) ---
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"

# --- Secrets (générés) ---
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
CRON_SECRET="${CRON_SECRET}"
CREDENTIALS_ENCRYPTION_KEY="${CREDENTIALS_ENCRYPTION_KEY}"

# --- URL publique (après 1er deploy Vercel) ---
NEXTAUTH_URL="https://VOTRE-DOMAINE"
WEBHOOK_BASE_URL="https://VOTRE-DOMAINE"

# --- Ops ---
ADMIN_EMAILS="ops@votredomaine.com"
DEMO_AUTO_LOGIN="0"

# --- Twilio WhatsApp (à coller depuis console Twilio) ---
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+33
TWILIO_WA_TEMPLATE_STOCK_RECAP=
TWILIO_WA_TEMPLATE_STOCK_ALERT=
TWILIO_WA_TEMPLATE_BILLING_DUNNING=
TWILIO_WA_TEMPLATE_TEST=
WHATSAPP_REQUIRE_TEMPLATES=1
WHATSAPP_BATCH_MINUTES=15
WHATSAPP_DAILY_LIMIT_PER_TENANT=20

# --- Stripe (test puis live) ---
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_COMMERCE_MONTHLY=
STRIPE_PRICE_COMMERCE_YEARLY=
STRIPE_PRICE_RESEAU_MONTHLY=
STRIPE_PRICE_RESEAU_YEARLY=
STRIPE_GRACE_DAYS=7

# --- Optionnel ---
OPS_SLACK_WEBHOOK_URL=
OPENAI_API_KEY=
EOF

echo "Écrit : $OUT"
echo "Secrets générés — à coller dans Vercel (ne pas committer)."
