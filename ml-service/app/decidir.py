"""Registra la decisión sobre una versión candidata: activarla (la activa pasa a histórico) o rechazarla.

Uso (lo llama Crow desde POST /api/modelo/decision):
    python -m app.decidir --solicitud ruta/solicitud.json
con solicitud.json = {"version": "v2", "accion": "activar" | "rechazar", "justificacion": "...", "responsable": "..."}.
La justificación llega en un archivo y no como argumento, para que el texto del usuario nunca pase por la línea de
comandos. Actualiza registry.json y el reporte de actualización de esa candidata. Imprime el registro en stdout.
"""
import argparse
import json
import sys
from pathlib import Path

from . import registry
from .reporte_actualizacion import escribir_reporte

MIN_JUSTIFICACION = 15
MIN_RESPONSABLE = 3


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--solicitud", type=Path, required=True)
    s = json.loads(ap.parse_args().solicitud.read_text(encoding="utf-8"))
    version, accion, justificacion = s.get("version"), s.get("accion"), (s.get("justificacion") or "").strip()
    if accion not in ("activar", "rechazar"):
        raise ValueError("La acción debe ser 'activar' o 'rechazar'.")
    responsable = (s.get("responsable") or "").strip()
    if len(responsable) < MIN_RESPONSABLE:
        raise ValueError("Indique quién toma la decisión (responsable).")
    if len(justificacion) < MIN_JUSTIFICACION:
        raise ValueError(f"Escriba una justificación de al menos {MIN_JUSTIFICACION} caracteres.")
    try:
        reg = registry.decidir(version, accion, justificacion)
    except KeyError:
        raise ValueError(f"No existe la versión {version}.")
    v = registry.buscar(reg, version)
    v["decision"]["responsable"] = responsable
    registry.guardar(reg)
    carpeta = Path(v.get("reporte_actualizacion", ""))
    if v.get("reporte_actualizacion") and (carpeta / "actualizacion.json").exists():
        r = json.loads((carpeta / "actualizacion.json").read_text(encoding="utf-8"))
        r["decision"] = v["decision"]
        r["candidata"]["estado"] = v["estado"]
        escribir_reporte(carpeta, r)
    print(json.dumps(reg, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # mensaje claro para Crow, sin traza
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)
