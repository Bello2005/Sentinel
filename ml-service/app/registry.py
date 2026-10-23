"""Registro de versiones del modelo (shared/models/registry.json).

Estados posibles: activo | candidato | historico | rechazado.
Crow lee este archivo para saber qué versión servir.
"""
import json
import os
import tempfile
from datetime import datetime

from .config import MODELOS

RUTA = MODELOS / "registry.json"


def leer() -> dict:
    if not RUTA.exists():
        return {"activo": None, "versiones": []}
    return json.loads(RUTA.read_text(encoding="utf-8"))


def guardar(reg: dict) -> None:
    # Escritura atómica: Crow nunca lee un archivo a medio escribir.
    MODELOS.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=MODELOS, suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(reg, f, ensure_ascii=False, indent=2)
    os.replace(tmp, RUTA)


def siguiente_id(reg: dict) -> str:
    return f"v{len(reg['versiones']) + 1}"


def buscar(reg: dict, version_id: str) -> dict:
    for v in reg["versiones"]:
        if v["id"] == version_id:
            return v
    raise KeyError(version_id)


def registrar(entrada: dict, activar: bool = False) -> dict:
    reg = leer()
    entrada["estado"] = "activo" if activar else "candidato"
    reg["versiones"].append(entrada)
    if activar:
        reg["activo"] = entrada["id"]
    guardar(reg)
    return reg


def decidir(version_id: str, accion: str, justificacion: str) -> dict:
    """accion = 'activar' (candidato pasa a activo, el anterior a histórico) o 'rechazar'."""
    reg = leer()
    cand = buscar(reg, version_id)
    if cand["estado"] != "candidato":
        raise ValueError(f"La versión {version_id} no es candidata (estado: {cand['estado']}).")
    decision = {"accion": accion, "justificacion": justificacion,
                "fecha": datetime.now().isoformat(timespec="seconds"),
                "activo_previo": reg["activo"]}
    if accion == "activar":
        if reg["activo"]:
            buscar(reg, reg["activo"])["estado"] = "historico"
        cand["estado"] = "activo"
        reg["activo"] = version_id
    elif accion == "rechazar":
        cand["estado"] = "rechazado"
    else:
        raise ValueError("accion debe ser 'activar' o 'rechazar'")
    cand["decision"] = decision
    guardar(reg)
    return reg
