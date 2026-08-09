#!/bin/bash
# Pointe le domaine public vers un deploy Vercel précis.
# Usage:
#   bash scripts/alias-prod.sh margin-shop-q8jn66pz9-reeegency-1970s-projects.vercel.app
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="${1:-}"
if [[ -z "$SRC" ]]; then
  echo "Usage: bash scripts/alias-prod.sh <url-deploy-vercel>"
  echo "Exemple:"
  echo "  bash scripts/alias-prod.sh margin-shop-q8jn66pz9-reeegency-1970s-projects.vercel.app"
  exit 1
fi

# Accepte URL complète ou hostname seul
SRC="${SRC#https://}"
SRC="${SRC%%/*}"

echo "=== Alias Production ==="
echo "Source : $SRC"
echo "Cible  : margin-shop.vercel.app"
npx vercel alias set "$SRC" margin-shop.vercel.app
echo
echo "OK → https://margin-shop.vercel.app/welcome#demo"
echo "Test : https://margin-shop.vercel.app/welcome/details"
