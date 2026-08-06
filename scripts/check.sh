#!/usr/bin/env bash
# Check anti-casse complet : types + unitaires + inventaire produit.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Évite les fuites d’env stress / vercel pull [SENSITIVE]
unset STRESS_CLEAN STRESS_SKIP_SEED STRESS_SEED_ONLY STRESS_WA STRESS_WA_TO STRESS_CONCURRENCY || true
for k in WHATSAPP_BATCH_MINUTES WHATSAPP_DAILY_LIMIT_PER_TENANT WHATSAPP_COST_CENTS_PER_MSG; do
  eval "v=\${$k:-}"
  if [[ "$v" == "[SENSITIVE]" || "$v" == *"SENSITIVE"* ]]; then
    unset "$k" || true
  fi
done

echo "▶ Typecheck"
npx tsc --noEmit -p tsconfig.json

echo "▶ Tests unitaires"
npm run test:unit

echo "▶ Inventaire anti-casse"
npx tsx scripts/anti-casse.ts

echo ""
echo "✅ Check anti-casse OK"

# Check anti-casse complet : types + unitaires + inventaire produit.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Évite les fuites d’env stress / vercel pull [SENSITIVE]
unset STRESS_CLEAN STRESS_SKIP_SEED STRESS_SEED_ONLY STRESS_WA STRESS_WA_TO STRESS_CONCURRENCY || true
for k in WHATSAPP_BATCH_MINUTES WHATSAPP_DAILY_LIMIT_PER_TENANT WHATSAPP_COST_CENTS_PER_MSG; do
  eval "v=\${$k:-}"
  if [[ "$v" == "[SENSITIVE]" || "$v" == *"SENSITIVE"* ]]; then
    unset "$k" || true
  fi
done

echo "▶ Typecheck"
npx tsc --noEmit -p tsconfig.json

echo "▶ Tests unitaires"
npm run test:unit

echo "▶ Inventaire anti-casse"
npx tsx scripts/anti-casse.ts

echo ""
echo "✅ Check anti-casse OK"

# Check anti-casse complet : types + unitaires + inventaire produit.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Évite les fuites d’env stress / vercel pull [SENSITIVE]
unset STRESS_CLEAN STRESS_SKIP_SEED STRESS_SEED_ONLY STRESS_WA STRESS_WA_TO STRESS_CONCURRENCY || true
for k in WHATSAPP_BATCH_MINUTES WHATSAPP_DAILY_LIMIT_PER_TENANT WHATSAPP_COST_CENTS_PER_MSG; do
  eval "v=\${$k:-}"
  if [[ "$v" == "[SENSITIVE]" || "$v" == *"SENSITIVE"* ]]; then
    unset "$k" || true
  fi
done

echo "▶ Typecheck"
npx tsc --noEmit -p tsconfig.json

echo "▶ Tests unitaires"
npm run test:unit

echo "▶ Inventaire anti-casse"
npx tsx scripts/anti-casse.ts

echo ""
echo "✅ Check anti-casse OK"

# Check anti-casse complet : types + unitaires + inventaire produit.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Évite les fuites d’env stress / vercel pull [SENSITIVE]
unset STRESS_CLEAN STRESS_SKIP_SEED STRESS_SEED_ONLY STRESS_WA STRESS_WA_TO STRESS_CONCURRENCY || true
for k in WHATSAPP_BATCH_MINUTES WHATSAPP_DAILY_LIMIT_PER_TENANT WHATSAPP_COST_CENTS_PER_MSG; do
  eval "v=\${$k:-}"
  if [[ "$v" == "[SENSITIVE]" || "$v" == *"SENSITIVE"* ]]; then
    unset "$k" || true
  fi
done

echo "▶ Typecheck"
npx tsc --noEmit -p tsconfig.json

echo "▶ Tests unitaires"
npm run test:unit

echo "▶ Inventaire anti-casse"
npx tsx scripts/anti-casse.ts

echo ""
echo "✅ Check anti-casse OK"
