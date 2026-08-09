#!/bin/bash
# Répare le local quand Internal Server Error / EMFILE
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== Stop anciens serveurs Next (3020–3110) ==="
for p in $(seq 3020 3110); do
  pids=$(lsof -tiTCP:$p -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "${pids}" ]]; then
    echo "  kill port $p → $pids"
    kill -9 $pids 2>/dev/null || true
  fi
done

echo "=== ulimit fichiers ==="
ulimit -n 10240 || true
echo "  soft=$(ulimit -n)"

echo "=== Clean .next ==="
rm -rf .next

echo "=== Dev server :3020 ==="
exec npm run dev -- -p 3020
