"""Rutas y parámetros compartidos del servicio de ML."""
import json
import os
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]          # sistema-web/
SHARED = RAIZ / "shared"
MODELOS = SHARED / "models"
DATOS = SHARED / "data"
REGLAS = SHARED / "config" / "reglas_dominio.json"
REPORTES = RAIZ / "ml-service" / "reportes"

ENTRENAMIENTO_CSV = DATOS / "entrenamiento.csv"     # conjunto de entrenamiento vigente
PRUEBA_CSV = DATOS / "prueba.csv"                   # conjunto fijo de prueba, nunca se entrena con él

CROW_URL = os.getenv("CROW_URL", "http://localhost:8080")
SEMILLA = 42

REPORTES.mkdir(parents=True, exist_ok=True)


def cargar_reglas() -> dict:
    return json.loads(REGLAS.read_text(encoding="utf-8"))
