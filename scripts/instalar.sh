#!/usr/bin/env bash
# Instalación completa de SENTINEL en la carpeta del repositorio, sin sudo.
#
#   1. Entorno de Python (.venv) con las dependencias del servicio de entrenamiento y CMake
#   2. Dependencias de C++ en vendor/ (scripts/descargar_dependencias.sh)
#   3. Compilación del backend Crow (crow-service/build/saber11_api)
#   4. Compilación de la interfaz Angular (frontend/dist/frontend/browser)
#
# Requisitos previos: git, curl, un compilador C++17 (g++ o clang++), Python 3.12+ y Node.js 20+ con npm.
# Si Python no trae pip/venv (Ubuntu sin python3-venv), se usa uv (https://docs.astral.sh/uv/) instalado en ~/.local/bin.
#
# Uso: scripts/instalar.sh            (desde la raíz del repositorio o desde cualquier carpeta)
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RAIZ"
paso() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
falla() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

paso "Revisando requisitos"
command -v git >/dev/null || falla "Falta git"
command -v curl >/dev/null || falla "Falta curl"
CXX_BIN="$(command -v g++ || command -v clang++ || true)"; [ -n "$CXX_BIN" ] || falla "Falta un compilador C++ (g++ o clang++)"
printf '#include <sqlite3.h>\nint main(){return 0;}\n' | "$CXX_BIN" -x c++ - -lsqlite3 -o /dev/null 2>/dev/null ||
  falla "Falta SQLite3 de desarrollo (en Debian/Ubuntu: sudo apt install libsqlite3-dev)"
command -v python3 >/dev/null || falla "Falta Python 3"
command -v node >/dev/null || falla "Falta Node.js 20 o superior"
NODE_MAYOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAYOR" -ge 20 ] || falla "Node.js $NODE_MAYOR es muy viejo: se necesita 20 o superior"
echo "  compilador: $CXX_BIN · $(python3 --version) · Node $(node --version)"

paso "Entorno de Python (.venv)"
if [ ! -x .venv/bin/python ]; then
  if python3 -c 'import ensurepip, venv' 2>/dev/null; then
    python3 -m venv .venv
    .venv/bin/python -m pip install -q --upgrade pip
    PIP=(.venv/bin/python -m pip install -q)
  else
    echo "  Python no trae pip/venv: se usa uv"
    command -v uv >/dev/null || [ -x "$HOME/.local/bin/uv" ] || curl -LsSf https://astral.sh/uv/install.sh | sh
    UV="$(command -v uv || echo "$HOME/.local/bin/uv")"
    "$UV" venv -q --python python3 .venv
    PIP=("$UV" pip install -q --python .venv/bin/python)
  fi
else
  if .venv/bin/python -m pip --version >/dev/null 2>&1; then PIP=(.venv/bin/python -m pip install -q)
  else UV="$(command -v uv || echo "$HOME/.local/bin/uv")"; PIP=("$UV" pip install -q --python .venv/bin/python); fi
fi
"${PIP[@]}" -r ml-service/requirements.txt
command -v cmake >/dev/null || "${PIP[@]}" "cmake>=3.20"
CMAKE="$(command -v cmake || echo "$RAIZ/.venv/bin/cmake")"
echo "  $(.venv/bin/python -c 'import sklearn, onnxruntime; print(f"scikit-learn {sklearn.__version__} · onnxruntime {onnxruntime.__version__}")')"

paso "Dependencias de C++"
scripts/descargar_dependencias.sh

paso "Compilando el backend Crow"
"$CMAKE" -S crow-service -B crow-service/build -DCMAKE_BUILD_TYPE=Release >/dev/null
"$CMAKE" --build crow-service/build -j "$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 2)" --target saber11_api
echo "  crow-service/build/saber11_api"

paso "Compilando la interfaz Angular"
( cd frontend && npm ci --no-audit --no-fund --loglevel=error && npx ng build --configuration production )
echo "  frontend/dist/frontend/browser"

printf '\n\033[1;32m✔ SENTINEL instalado.\033[0m  Inicie con:  scripts/iniciar.sh   (puerto 8090 por defecto)\n'
