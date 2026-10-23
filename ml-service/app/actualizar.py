"""Actualización controlada: integra registros etiquetados, entrena una versión CANDIDATA y la compara con la activa.

Uso (lo llama Crow desde POST /api/actualizar, después de validar el lote en modo entrenamiento):
    python -m app.actualizar --lote shared/data/lotes/<id>.csv --salida shared/reportes/<id>

Pasos:
    1. Revisa de nuevo el lote (columnas del modelo y objetivo sin vacíos): Python no confía en que alguien lo
       llame sin pasar por Crow.
    2. Une el conjunto de entrenamiento de la versión ACTIVA con el lote. Si un registro (tipo_unidad, codigo,
       anio_objetivo) ya existía, gana el del lote. El resultado se guarda aparte (shared/data/versiones/<id>.csv):
       el conjunto de la versión activa no se modifica.
    3. Reentrena con la misma estrategia de validación temporal y registra la versión como CANDIDATA. Nunca la activa.
    4. Compara con la activa con la misma métrica principal (MAE en Chocó) y métricas secundarias, y escribe
       actualizacion.json y actualizacion.html en --salida. La decisión la toma una persona (app.decidir).

Imprime en stdout el JSON del resultado (Crow lo lee).
"""
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from . import registry
from .config import SHARED, cargar_reglas
from .entrenar import COD_DEPTO, entrenar, esquema, leer
from .reporte_actualizacion import escribir_reporte

TOLERANCIA = 0.05  # la candidata se recomienda si su MAE principal no es más de 5 % peor que el de la activa
CLAVE = ["tipo_unidad", "codigo", "anio_objetivo"]


def mae(pred, real):
    return round(float(np.mean(np.abs(np.asarray(pred) - np.asarray(real)))), 2) if len(real) else None


def revisar_lote(lote, base, reglas):
    obligatorias = [v["nombre"] for v in reglas["variables"] if v.get("obligatoria", True)] + [reglas["objetivo"]["nombre"]]
    faltan = [c for c in obligatorias if c not in lote.columns]
    if faltan:
        raise ValueError(f"Al lote le faltan columnas: {', '.join(faltan)}")
    if lote[reglas["objetivo"]["nombre"]].isna().any():
        raise ValueError("Hay registros sin puntaje_real: no se pueden usar para entrenar.")
    if lote.empty:
        raise ValueError("El lote no tiene registros.")
    return lote[base.columns.intersection(lote.columns)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lote", type=Path, required=True)
    ap.add_argument("--salida", type=Path, required=True)
    ap.add_argument("--nombre", help="nombre original del archivo subido (para el reporte)")
    a = ap.parse_args()
    a.salida.mkdir(parents=True, exist_ok=True)

    reglas = cargar_reglas()
    cat, num = esquema(reglas)
    reg = registry.leer()
    if not reg["activo"]:
        raise ValueError("No hay un modelo activo con el cual comparar.")
    activa = registry.buscar(reg, reg["activo"])
    base = leer(SHARED / activa["datos"])
    lote = revisar_lote(leer(a.lote), base, reglas)

    # 2. Conjunto actualizado (el del lote reemplaza registros repetidos)
    claves_base = set(map(tuple, base[CLAVE].astype(str).to_numpy()))
    repetidos = sum(tuple(k) in claves_base for k in lote[CLAVE].astype(str).to_numpy())
    actualizado = pd.concat([base, lote]).drop_duplicates(CLAVE, keep="last").sort_values(["anio_objetivo", "tipo_unidad", "codigo"])
    vid = registry.siguiente_id(reg)
    ruta_datos = SHARED / "data" / "versiones" / f"{vid}.csv"
    ruta_datos.parent.mkdir(parents=True, exist_ok=True)
    actualizado.to_csv(ruta_datos, index=False)

    # 3. Candidata
    anios_lote = sorted(int(x) for x in lote.anio_objetivo.unique())
    meta_c = entrenar(ruta_datos, activar=False,
                      notas=f"Candidata: {activa['id']} + lote {a.nombre or a.lote.name} ({len(lote)} registros, años {anios_lote})")
    meta_a = json.loads((SHARED / activa["ruta"] / "metadata.json").read_text(encoding="utf-8"))

    # 4. Comparación
    lote_choco = lote[lote.departamento_cod == COD_DEPTO]
    pipe_a = joblib.load(SHARED / activa["ruta"] / "pipeline.joblib")
    val_c = pd.read_csv(SHARED / "models" / vid / "validacion.csv")
    val_a = pd.read_csv(SHARED / activa["ruta"] / "validacion.csv")
    sel = lambda v, anios: v[(v.region == "choco") & (v.tipo_unidad == "todos") & v.anio_objetivo.isin(anios)].mae_prediccion.mean()
    anios_a = sorted(val_a.anio_objetivo.unique())
    anios_nuevos = [t for t in anios_lote if t > max(meta_a["datos"]["anios_objetivo"])]
    principal = {"metrica": "MAE en Chocó (puntos), validación temporal, promedio de los años",
                 "activa": meta_a["validacion"]["mae_choco"], "candidata": meta_c["validacion"]["mae_choco"]}
    secundarias = [
        {"metrica": "MAE en Chocó en los mismos años que validó la activa", "activa": round(float(sel(val_a, anios_a)), 2),
         "candidata": round(float(sel(val_c, anios_a)), 2),
         "nota": "Mismos años para las dos: muestra si agregar datos cambió el desempeño en el pasado."},
        {"metrica": "MAE en Chocó con los datos nuevos (la activa nunca los vio)",
         "activa": mae(pipe_a.predict(lote_choco[num]), lote_choco.puntaje_real) if len(lote_choco) else None,
         "candidata": round(float(sel(val_c, anios_nuevos)), 2) if anios_nuevos else None,
         "nota": "Candidata: predicción fuera de muestra del año nuevo en su validación temporal (entrenada sin ese año)."
                 if anios_nuevos else "El lote no trae años nuevos: la candidata ya vio esos años."},
        {"metrica": "Líneas base con los datos nuevos (Chocó): persistencia / promedio_3",
         "activa": mae(lote_choco.puntaje_ultimo, lote_choco.puntaje_real), "candidata": mae(lote_choco.promedio_3, lote_choco.puntaje_real),
         "nota": "Referencia: lo que lograría una regla simple con los datos nuevos (columna activa = persistencia, candidata = promedio_3)."},
        {"metrica": "MAE en el país, validación temporal", "activa": meta_a["validacion"]["mae_pais"], "candidata": meta_c["validacion"]["mae_pais"]},
        {"metrica": "Registros de entrenamiento", "activa": meta_a["datos"]["registros"], "candidata": meta_c["datos"]["registros"]},
    ]
    lb = meta_c["validacion"]["lineas_base"]
    vence_bases = meta_c["validacion"]["mae_choco"] <= min(lb["persistencia_mae_choco"], lb["promedio_3_mae_choco"])
    no_empeora = principal["candidata"] <= principal["activa"] * (1 + TOLERANCIA)
    recomendacion = {
        "accion_sugerida": "activar" if vence_bases and no_empeora else "revisar",
        "criterio": f"Se sugiere activar si la candidata le gana a las dos líneas base y su MAE principal no es más de "
                    f"{TOLERANCIA:.0%} peor que el de la activa (con más años de validación el MAE puede subir sin que el modelo sea peor).",
        "vence_lineas_base": vence_bases, "no_empeora": no_empeora,
        "nota": "Es una sugerencia: la decisión y su justificación las registra una persona.",
    }
    resultado = {
        "id_actualizacion": a.salida.name, "fecha": datetime.now().isoformat(timespec="seconds"),
        "lote": {"archivo": a.nombre or a.lote.name, "guardado_como": str(a.lote.resolve().relative_to(SHARED.resolve())), "registros": len(lote), "nuevos": len(lote) - repetidos, "reemplazados": repetidos,
                 "anios_objetivo": anios_lote, "por_tipo": lote.tipo_unidad.value_counts().to_dict(),
                 "choco": len(lote_choco), "puntaje_real_promedio": round(float(lote.puntaje_real.mean()), 2)},
        "conjunto_actualizado": {"archivo": str(ruta_datos.relative_to(SHARED)), "registros": len(actualizado),
                                 "anios_objetivo": sorted(int(x) for x in actualizado.anio_objetivo.unique())},
        "activa": {"version": meta_a["version"], "fecha": meta_a["fecha_entrenamiento"], "coeficientes": meta_a["configuracion"]["coeficientes"]},
        "candidata": {"version": vid, "fecha": meta_c["fecha_entrenamiento"], "coeficientes": meta_c["configuracion"]["coeficientes"],
                      "estado": "candidato"},
        "comparacion": {"principal": principal, "secundarias": secundarias},
        "recomendacion": recomendacion,
        "decision": None,
    }
    # Para que la decisión encuentre este reporte
    reg = registry.leer()
    registry.buscar(reg, vid)["reporte_actualizacion"] = str(a.salida.resolve())
    registry.guardar(reg)
    escribir_reporte(a.salida, resultado)
    print(json.dumps(resultado, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # mensaje claro para Crow, sin traza
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)
