#!/usr/bin/env bash
# Descarga las dependencias de C++ en vendor/ (no van a git): ONNX Runtime, Crow, Asio, nlohmann/json y rapidcsv.
# Detecta el sistema (Linux o macOS) y la arquitectura (x86_64 o arm64). Es idempotente: lo que ya está no se baja.
#
# Uso: scripts/descargar_dependencias.sh
set -euo pipefail

ORT_VERSION="1.22.0"
CROW_VERSION="1.2.1"
ASIO_VERSION="1-30-2"
JSON_VERSION="3.11.3"
RAPIDCSV_VERSION="8.84"

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$RAIZ/vendor"
mkdir -p "$VENDOR/descargas" "$VENDOR/include/nlohmann"

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)          ORT_PAQUETE="onnxruntime-linux-x64-$ORT_VERSION" ;;
  Linux-aarch64)         ORT_PAQUETE="onnxruntime-linux-aarch64-$ORT_VERSION" ;;
  Darwin-arm64)          ORT_PAQUETE="onnxruntime-osx-arm64-$ORT_VERSION" ;;
  Darwin-x86_64)         ORT_PAQUETE="onnxruntime-osx-x86_64-$ORT_VERSION" ;;
  *) echo "Sistema no soportado: $(uname -s) $(uname -m)" >&2; exit 1 ;;
esac

bajar() {  # bajar <url> <archivo destino>
  if [ -s "$2" ]; then echo "  ya está: $(basename "$2")"; return; fi
  echo "  descargando $(basename "$2")…"
  curl -fsSL --retry 3 -o "$2.part" "$1" && mv "$2.part" "$2"
}
extraer() {  # extraer <tar.gz> <carpeta destino>
  if [ -d "$2" ] && [ -n "$(ls -A "$2" 2>/dev/null)" ]; then return; fi
  mkdir -p "$2" && tar -xzf "$1" -C "$2" --strip-components=1
}

echo "Dependencias de C++ en $VENDOR"
D="$VENDOR/descargas"
bajar "https://github.com/microsoft/onnxruntime/releases/download/v$ORT_VERSION/$ORT_PAQUETE.tgz" "$D/$ORT_PAQUETE.tgz"
bajar "https://github.com/CrowCpp/Crow/archive/refs/tags/v$CROW_VERSION.tar.gz" "$D/crow-$CROW_VERSION.tar.gz"
bajar "https://github.com/chriskohlhoff/asio/archive/refs/tags/asio-$ASIO_VERSION.tar.gz" "$D/asio-$ASIO_VERSION.tar.gz"
bajar "https://github.com/nlohmann/json/releases/download/v$JSON_VERSION/json.hpp" "$VENDOR/include/nlohmann/json.hpp"
bajar "https://raw.githubusercontent.com/d99kris/rapidcsv/v$RAPIDCSV_VERSION/src/rapidcsv.h" "$VENDOR/include/rapidcsv.h"

extraer "$D/$ORT_PAQUETE.tgz" "$VENDOR/onnxruntime"
extraer "$D/crow-$CROW_VERSION.tar.gz" "$VENDOR/crow"
extraer "$D/asio-$ASIO_VERSION.tar.gz" "$VENDOR/asio"

# macOS marca lo descargado como "en cuarentena"; se quita para que la librería cargue
if [ "$(uname -s)" = "Darwin" ]; then xattr -r -d com.apple.quarantine "$VENDOR/onnxruntime" 2>/dev/null || true; fi

echo "Listo: ONNX Runtime $ORT_VERSION ($ORT_PAQUETE), Crow $CROW_VERSION, Asio $ASIO_VERSION, json $JSON_VERSION, rapidcsv $RAPIDCSV_VERSION"
