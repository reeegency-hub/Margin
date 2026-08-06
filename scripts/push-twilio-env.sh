#!/usr/bin/env bash
# Pousse .env.twilio vers Vercel (production + preview) puis redeploy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="${1:-$ROOT/.env.twilio}"

if [[ ! -f "$FILE" ]]; then
  echo "Manque $FILE — vois TWILIO_SETUP.md"
  exit 1
fi

push() {
  local key="$1" val="$2" env="$3"
  [[ -z "$val" ]] && return 0
  npx vercel env rm "$key" "$env" --yes >/dev/null 2>&1 || true
  printf '%s' "$val" | npx vercel env add "$key" "$env" --yes >/dev/null
  echo "OK $key ($env)"
}

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^# ]] && continue
  [[ -z "$line" ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  val="${val%\"}"
  val="${val#\"}"
  case "$key" in
    TWILIO_ACCOUNT_SID|TWILIO_AUTH_TOKEN|TWILIO_WHATSAPP_FROM|\
    TWILIO_WA_TEMPLATE_STOCK_RECAP|TWILIO_WA_TEMPLATE_STOCK_ALERT|\
    TWILIO_WA_TEMPLATE_BILLING_DUNNING|TWILIO_WA_TEMPLATE_TEST)
      push "$key" "$val" production
      push "$key" "$val" preview
      ;;
  esac
done < "$FILE"

# Assouplir templates tant que Meta n'a pas approuvé (sauf si forcé dans le fichier)
if ! grep -q '^WHATSAPP_REQUIRE_TEMPLATES=' "$FILE"; then
  push WHATSAPP_REQUIRE_TEMPLATES "0" production
  push WHATSAPP_REQUIRE_TEMPLATES "0" preview
fi

echo "Redeploy…"
npx vercel --prod --yes
echo "Done. Test : numéro gérant dans Réglages + alerte stock."

# Pousse .env.twilio vers Vercel (production + preview) puis redeploy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="${1:-$ROOT/.env.twilio}"

if [[ ! -f "$FILE" ]]; then
  echo "Manque $FILE — vois TWILIO_SETUP.md"
  exit 1
fi

push() {
  local key="$1" val="$2" env="$3"
  [[ -z "$val" ]] && return 0
  npx vercel env rm "$key" "$env" --yes >/dev/null 2>&1 || true
  printf '%s' "$val" | npx vercel env add "$key" "$env" --yes >/dev/null
  echo "OK $key ($env)"
}

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^# ]] && continue
  [[ -z "$line" ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  val="${val%\"}"
  val="${val#\"}"
  case "$key" in
    TWILIO_ACCOUNT_SID|TWILIO_AUTH_TOKEN|TWILIO_WHATSAPP_FROM|\
    TWILIO_WA_TEMPLATE_STOCK_RECAP|TWILIO_WA_TEMPLATE_STOCK_ALERT|\
    TWILIO_WA_TEMPLATE_BILLING_DUNNING|TWILIO_WA_TEMPLATE_TEST)
      push "$key" "$val" production
      push "$key" "$val" preview
      ;;
  esac
done < "$FILE"

# Assouplir templates tant que Meta n'a pas approuvé (sauf si forcé dans le fichier)
if ! grep -q '^WHATSAPP_REQUIRE_TEMPLATES=' "$FILE"; then
  push WHATSAPP_REQUIRE_TEMPLATES "0" production
  push WHATSAPP_REQUIRE_TEMPLATES "0" preview
fi

echo "Redeploy…"
npx vercel --prod --yes
echo "Done. Test : numéro gérant dans Réglages + alerte stock."

# Pousse .env.twilio vers Vercel (production + preview) puis redeploy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="${1:-$ROOT/.env.twilio}"

if [[ ! -f "$FILE" ]]; then
  echo "Manque $FILE — vois TWILIO_SETUP.md"
  exit 1
fi

push() {
  local key="$1" val="$2" env="$3"
  [[ -z "$val" ]] && return 0
  npx vercel env rm "$key" "$env" --yes >/dev/null 2>&1 || true
  printf '%s' "$val" | npx vercel env add "$key" "$env" --yes >/dev/null
  echo "OK $key ($env)"
}

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^# ]] && continue
  [[ -z "$line" ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  val="${val%\"}"
  val="${val#\"}"
  case "$key" in
    TWILIO_ACCOUNT_SID|TWILIO_AUTH_TOKEN|TWILIO_WHATSAPP_FROM|\
    TWILIO_WA_TEMPLATE_STOCK_RECAP|TWILIO_WA_TEMPLATE_STOCK_ALERT|\
    TWILIO_WA_TEMPLATE_BILLING_DUNNING|TWILIO_WA_TEMPLATE_TEST)
      push "$key" "$val" production
      push "$key" "$val" preview
      ;;
  esac
done < "$FILE"

# Assouplir templates tant que Meta n'a pas approuvé (sauf si forcé dans le fichier)
if ! grep -q '^WHATSAPP_REQUIRE_TEMPLATES=' "$FILE"; then
  push WHATSAPP_REQUIRE_TEMPLATES "0" production
  push WHATSAPP_REQUIRE_TEMPLATES "0" preview
fi

echo "Redeploy…"
npx vercel --prod --yes
echo "Done. Test : numéro gérant dans Réglages + alerte stock."

# Pousse .env.twilio vers Vercel (production + preview) puis redeploy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="${1:-$ROOT/.env.twilio}"

if [[ ! -f "$FILE" ]]; then
  echo "Manque $FILE — vois TWILIO_SETUP.md"
  exit 1
fi

push() {
  local key="$1" val="$2" env="$3"
  [[ -z "$val" ]] && return 0
  npx vercel env rm "$key" "$env" --yes >/dev/null 2>&1 || true
  printf '%s' "$val" | npx vercel env add "$key" "$env" --yes >/dev/null
  echo "OK $key ($env)"
}

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^# ]] && continue
  [[ -z "$line" ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  val="${val%\"}"
  val="${val#\"}"
  case "$key" in
    TWILIO_ACCOUNT_SID|TWILIO_AUTH_TOKEN|TWILIO_WHATSAPP_FROM|\
    TWILIO_WA_TEMPLATE_STOCK_RECAP|TWILIO_WA_TEMPLATE_STOCK_ALERT|\
    TWILIO_WA_TEMPLATE_BILLING_DUNNING|TWILIO_WA_TEMPLATE_TEST)
      push "$key" "$val" production
      push "$key" "$val" preview
      ;;
  esac
done < "$FILE"

# Assouplir templates tant que Meta n'a pas approuvé (sauf si forcé dans le fichier)
if ! grep -q '^WHATSAPP_REQUIRE_TEMPLATES=' "$FILE"; then
  push WHATSAPP_REQUIRE_TEMPLATES "0" production
  push WHATSAPP_REQUIRE_TEMPLATES "0" preview
fi

echo "Redeploy…"
npx vercel --prod --yes
echo "Done. Test : numéro gérant dans Réglages + alerte stock."
