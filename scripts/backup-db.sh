#!/usr/bin/env bash
# Backup SQLite avant / pendant le pilote client (ne jamais db:seed pendant 1 semaine)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
SRC="$ROOT/prisma/dev.db"
DST="$ROOT/backups/dev-$STAMP.db"
if [[ ! -f "$SRC" ]]; then
  echo "Pas de $SRC"
  exit 1
fi
cp "$SRC" "$DST"
echo "Backup OK → $DST"
ls -lh "$DST"
