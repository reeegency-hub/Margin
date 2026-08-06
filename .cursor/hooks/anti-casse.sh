#!/usr/bin/env bash
# Hook Cursor (stop) — relance le check anti-casse après une session agent.
# Entrée JSON stdin (ignorée) ; sortie JSON avec followup si échec.
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 0

# Lire stdin pour ne pas bloquer le pipe Cursor
cat >/dev/null || true

export PATH="/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin:${PATH:-}"

LOG="$(mktemp -t margin-anti-casse.XXXXXX)"
set +e
npx tsx scripts/anti-casse.ts >"$LOG" 2>&1
CODE=$?
set -e

if [[ "$CODE" -ne 0 ]]; then
  # Extraire les lignes d'échec pour le follow-up
  FAILS=$(grep -E '✗|ÉCHEC|Manquant' "$LOG" | head -12 | tr '\n' ' ' | sed 's/"/\\"/g')
  rm -f "$LOG"
  printf '%s\n' "{\"followup_message\":\"Anti-casse en échec. Corrige puis relance: npm run check:quick — ${FAILS}\"}"
  exit 0
fi

rm -f "$LOG"
printf '%s\n' '{}'
exit 0
