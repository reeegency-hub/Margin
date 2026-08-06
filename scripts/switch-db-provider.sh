#!/usr/bin/env bash
# Bascule Prisma entre sqlite (local) et postgresql (prod).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCHEMA="$ROOT/prisma/schema.prisma"
MODE="${1:-}"

if [[ "$MODE" != "sqlite" && "$MODE" != "postgresql" ]]; then
  echo "Usage: $0 sqlite|postgresql"
  exit 1
fi

if [[ "$MODE" == "postgresql" ]]; then
  # Remplace le bloc datasource (sqlite → postgres + directUrl)
  perl -i -0pe 's/datasource db \{\n  provider = "sqlite"\n  url\s+= env\("DATABASE_URL"\)\n\}/datasource db {\n  provider  = "postgresql"\n  url       = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")\n}/s' "$SCHEMA"
  # Si déjà postgres, no-op ok
  if ! grep -q 'provider  = "postgresql"' "$SCHEMA" && ! grep -q 'provider = "postgresql"' "$SCHEMA"; then
    # Variante sans double espace
    perl -i -0pe 's/datasource db \{\n  provider = "sqlite"\n  url      = env\("DATABASE_URL"\)\n\}/datasource db {\n  provider  = "postgresql"\n  url       = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")\n}/s' "$SCHEMA"
  fi
  echo "Prisma → postgresql (+ DIRECT_URL)"
else
  perl -i -0pe 's/datasource db \{\n  provider\s+= "postgresql"\n  url\s+= env\("DATABASE_URL"\)\n  directUrl = env\("DIRECT_URL"\)\n\}/datasource db {\n  provider = "sqlite"\n  url      = env("DATABASE_URL")\n}/s' "$SCHEMA"
  echo "Prisma → sqlite"
fi

grep -A5 'datasource db' "$SCHEMA" | head -8
