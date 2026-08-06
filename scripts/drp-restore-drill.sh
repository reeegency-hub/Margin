#!/usr/bin/env bash
# DRP drill — backup SQLite + restauration testée (mesure RTO réelle).
# Usage: bash scripts/drp-restore-drill.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/backups" "$ROOT/backups/drills"
STAMP="$(date +%Y%m%d-%H%M%S)"
SRC="$ROOT/prisma/dev.db"
BACKUP="$ROOT/backups/dev-drill-$STAMP.db"
RESTORE_DIR="$ROOT/backups/drills/restore-$STAMP"
REPORT="$ROOT/backups/drills/drill-report-$STAMP.md"

if [[ ! -f "$SRC" ]]; then
  echo "Pas de $SRC — impossible de tester."
  exit 1
fi

echo "═══ DRP restore drill ═══"
START_BACKUP=$(date +%s)
cp "$SRC" "$BACKUP"
END_BACKUP=$(date +%s)
BACKUP_SEC=$((END_BACKUP - START_BACKUP))
SIZE=$(ls -lh "$BACKUP" | awk '{print $5}')
echo "Backup OK → $BACKUP ($SIZE) in ${BACKUP_SEC}s"

START_RESTORE=$(date +%s)
mkdir -p "$RESTORE_DIR"
cp "$BACKUP" "$RESTORE_DIR/dev.db"
# Vérification intégrité SQLite
if command -v sqlite3 >/dev/null 2>&1; then
  INTEGRITY=$(sqlite3 "$RESTORE_DIR/dev.db" "PRAGMA integrity_check;" 2>&1 | head -1)
  TABLES=$(sqlite3 "$RESTORE_DIR/dev.db" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>&1)
  RESTAURANTS=$(sqlite3 "$RESTORE_DIR/dev.db" "SELECT COUNT(*) FROM Restaurant;" 2>&1 || echo "n/a")
  POS_EVENTS=$(sqlite3 "$RESTORE_DIR/dev.db" "SELECT COUNT(*) FROM PosWebhookEvent;" 2>&1 || echo "n/a")
else
  INTEGRITY="sqlite3 not installed — file copy only"
  TABLES="n/a"
  RESTAURANTS="n/a"
  POS_EVENTS="n/a"
fi
END_RESTORE=$(date +%s)
RESTORE_SEC=$((END_RESTORE - START_RESTORE))

cat > "$REPORT" <<EOF
# DRP restore drill — $STAMP

| Étape | Résultat |
|---|---|
| Source | \`$SRC\` |
| Backup | \`$BACKUP\` ($SIZE) |
| Durée backup | **${BACKUP_SEC}s** |
| Restauration vers | \`$RESTORE_DIR/dev.db\` |
| Durée restore + check | **${RESTORE_SEC}s** |
| integrity_check | $INTEGRITY |
| Tables | $TABLES |
| Restaurant count | $RESTAURANTS |
| PosWebhookEvent count | $POS_EVENTS |

## Objectifs stade actuel (60 clients / an)

| Objectif | Valeur proposée |
|---|---|
| **RPO** | ≤ 24 h (backup quotidien) — idéal ≤ 1 h une fois Postgres + PITR Supabase |
| **RTO** | ≤ 4 h (restore manuel documenté) — cible ≤ 30 min avec runbook automatisé |

## Constat

- Drill exécuté le $(date -u +%Y-%m-%dT%H:%M:%SZ)
- Backup local SQLite : **manuel** (\`npm run db:backup\`) — pas de cron
- Prod cible Supabase : activer **Point-in-Time Recovery** + snapshot quotidien

## Prochaine action

1. Planifier \`npm run db:backup\` quotidien (cron laptop / CI) tant que SQLite local
2. En prod : vérifier backups Supabase + tester restore projet staging
3. Relancer ce drill après bascule Postgres
EOF

echo "Restore OK in ${RESTORE_SEC}s — integrity=$INTEGRITY"
echo "Report → $REPORT"
cat "$REPORT"
