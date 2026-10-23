#!/usr/bin/env bash
# Inicia SENTINEL: Crow sirve la API (/api) y la interfaz Angular compilada en un solo puerto.
#
# Uso: scripts/iniciar.sh                         → http://0.0.0.0:8090
#      PUERTO=9000 SABER_HOST=127.0.0.1 scripts/iniciar.sh
# Variables: PUERTO (8090), SABER_HOST (0.0.0.0; use 127.0.0.1 detrás de Nginx)
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
API="$RAIZ/crow-service/build/saber11_api"
WEB="$RAIZ/frontend/dist/frontend/browser"
[ -x "$API" ] || { echo "No está compilado el backend: ejecute scripts/instalar.sh" >&2; exit 1; }
[ -f "$WEB/index.html" ] || { echo "No está compilada la interfaz: ejecute scripts/instalar.sh" >&2; exit 1; }

exec "$API" --shared "$RAIZ/shared" --ml-service "$RAIZ/ml-service" --python "$RAIZ/.venv/bin/python" \
            --web "$WEB" --puerto "${PUERTO:-8090}" --host "${SABER_HOST:-0.0.0.0}"
