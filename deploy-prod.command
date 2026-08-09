#!/bin/bash
cd "$(dirname "$0")"
echo "=== Deploy MarginShop → Vercel production ==="
npx vercel --prod --yes
echo
echo "Si le domaine public n’est pas à jour, alias manuellement :"
echo "  bash scripts/alias-prod.sh <url-Production-affichée>"
echo
echo "Test desktop : https://margin-shop.vercel.app/welcome#demo"
echo "Test details : https://margin-shop.vercel.app/welcome/details"
echo "Test mobile  : https://margin-shop.vercel.app/welcome?mobile=1"
read -r -p "Appuie sur Entrée pour fermer…"
