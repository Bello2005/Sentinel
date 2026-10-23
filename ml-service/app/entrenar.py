"""Entrena el pipeline, lo valida año a año, lo exporta a ONNX y registra la versión.

Uso (desde sistema-web/ml-service):
    python -m app.entrenar                         # usa shared/data/entrenamiento.csv; activa si no hay modelo activo
    python -m app.entrenar --datos otra.csv --activar

Validación (la de la Actividad 5): temporal. Para cada año objetivo t (desde el segundo), se entrena con las filas de
años anteriores a t y se predice t. Métrica principal: error absoluto medio (MAE, en puntos) en las unidades de Chocó,
promediado sobre los años. Se compara siempre con dos líneas base: persistencia (puntaje_ultimo) y promedio_3.

Cada versión queda en shared/models/<id>/:
    modelo.onnx      lo que carga el backend en C++ (ONNX Runtime). Una entrada float32 [n, 1] por variable
                     predictora, con su nombre y en el orden de metadata.json. Salida: `variable` [n, 1].
    pipeline.joblib  el mismo pipeline en scikit-learn (para reentrenar, comparar y el EDA en Python)
    metadata.json    esquema, categorías aprendidas, métricas, intervalos y configuración
"""
import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import onnxruntime as ort
import pandas as pd
from skl2onnx import to_onnx
from skl2onnx.common.data_types import FloatTensorType, StringTensorType
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

from . import registry
from .config import ENTRENAMIENTO_CSV, MODELOS, SHARED, cargar_reglas
from .modelo import COLUMNAS, AnclaPromedio3

COD_DEPTO = "27"
COBERTURA = 0.80
ALPHA = 10.0
TIPOS_TEXTO = {"codigo": str, "departamento_cod": str, "municipio_cod": str, "nombre": str}


def esquema(reglas):
    """Variables que entran al modelo (rol `predictora`), separadas en categóricas y numéricas."""
    pred = [v for v in reglas["variables"] if v["rol"] == "predictora"]
    cat = [v["nombre"] for v in pred if v["tipo"] == "categorica"]
    num = [v["nombre"] for v in pred if v["tipo"] != "categorica"]
    assert not cat and num == COLUMNAS, "reglas_dominio.json y modelo.COLUMNAS deben listar las mismas predictoras"
    return cat, num


def ruta_relativa(ruta):
    """Ruta del conjunto de entrenamiento relativa a shared/ (así queda en el registro)."""
    try:
        return str(Path(ruta).resolve().relative_to(SHARED.resolve()))
    except ValueError:
        return str(ruta)


def leer(ruta):
    return pd.read_csv(ruta, dtype=TIPOS_TEXTO)


def crear_pipeline(cat, num):
    # El preprocesamiento solo selecciona y ordena las columnas: el modelo trabaja en puntos, sin escalar,
    # porque sus coeficientes se leen directamente ("cuánto pesa cada año").
    pre = ColumnTransformer([("puntajes", "passthrough", num)])
    return Pipeline([("preprocesamiento", pre), ("modelo", AnclaPromedio3(alpha=ALPHA))])


def entradas(df, cat, num):
    """Diccionario columna -> arreglo [n, 1], en el formato que espera el modelo ONNX."""
    d = {c: df[[c]].to_numpy(dtype=object).astype(str) for c in cat}
    d.update({c: df[[c]].to_numpy(dtype=np.float32) for c in num})
    return d


def validacion_temporal(df, cat, num):
    """Predice cada año con los anteriores. Devuelve las predicciones fuera de muestra y las métricas por año."""
    anios = sorted(df.anio_objetivo.unique())
    preds = []
    for t in anios[1:]:
        tr, te = df[df.anio_objetivo < t], df[df.anio_objetivo == t].copy()
        te["prediccion"] = crear_pipeline(cat, num).fit(tr[cat + num], tr.puntaje_real).predict(te[cat + num])
        preds.append(te)
    p = pd.concat(preds)
    p["persistencia"], p["prom3"] = p.puntaje_ultimo, p.promedio_3
    filas = []
    for (t, region), g in [((t, r), g) for t, gt in p.groupby("anio_objetivo")
                           for r, g in [("choco", gt[gt.departamento_cod == COD_DEPTO]), ("pais", gt)]]:
        for tipo, gg in [("todos", g)] + list(g.groupby("tipo_unidad")):
            fila = {"anio_objetivo": int(t), "region": region, "tipo_unidad": tipo, "filas": len(gg)}
            for m in ["prediccion", "persistencia", "prom3"]:
                e = gg[m] - gg.puntaje_real
                fila[f"mae_{m}"], fila[f"rmse_{m}"], fila[f"sesgo_{m}"] = e.abs().mean(), np.sqrt((e ** 2).mean()), e.mean()
            filas.append(fila)
    return p, pd.DataFrame(filas)


def intervalos(p):
    """± puntos que cubren el 80 % de los errores en Chocó, por tipo de unidad y tamaño."""
    c = p[p.departamento_cod == COD_DEPTO]
    tam = pd.cut(c.estudiantes_ultimo, [0, 10, 30, np.inf], right=False, labels=["<10", "10-29", ">=30"])
    q = (c.prediccion - c.puntaje_real).abs().groupby([c.tipo_unidad, tam], observed=True).quantile(COBERTURA)
    return {tipo: {str(k): round(float(v), 1) for k, v in s.droplevel(0).items()} for tipo, s in q.groupby(level=0)}


def exportar_onnx(pipe, df, cat, num, destino):
    tipos = [(c, StringTensorType([None, 1])) for c in cat] + [(c, FloatTensorType([None, 1])) for c in num]
    onx = to_onnx(pipe, initial_types=tipos, target_opset=17)
    destino.write_bytes(onx.SerializeToString())
    muestra = df.sample(min(2000, len(df)), random_state=0)
    salida = ort.InferenceSession(str(destino)).run(None, entradas(muestra, cat, num))[0].ravel()
    dif = float(np.abs(salida - pipe.predict(muestra[cat + num])).max())
    assert dif < 0.01, f"ONNX y scikit-learn difieren en {dif:.4f} puntos"
    return dif


def entrenar(ruta_datos, activar=None, notas=""):
    reglas = cargar_reglas()
    cat, num = esquema(reglas)
    df = leer(ruta_datos)
    pred, met = validacion_temporal(df, cat, num)
    resumen = met.groupby(["region", "tipo_unidad"])[[c for c in met if c.startswith(("mae_", "rmse_"))]].mean()

    pipe = crear_pipeline(cat, num).fit(df[cat + num], df.puntaje_real)
    reg = registry.leer()
    vid = registry.siguiente_id(reg)
    carpeta = MODELOS / vid
    carpeta.mkdir(parents=True, exist_ok=True)
    dif = exportar_onnx(pipe, df, cat, num, carpeta / "modelo.onnx")
    joblib.dump(pipe, carpeta / "pipeline.joblib")
    met.round(3).to_csv(carpeta / "validacion.csv", index=False)

    categoricas = [v["nombre"] for v in reglas["variables"] if v["tipo"] == "categorica"]
    coef = dict(zip(num, pipe.named_steps["modelo"].coef_.round(4).tolist()))
    mae = lambda r, t, m="prediccion": round(float(resumen.loc[(r, t), f"mae_{m}"]), 2)
    meta = {
        "version": vid,
        "fecha_entrenamiento": datetime.now().isoformat(timespec="seconds"),
        "algoritmo": "Regresión anclada en promedio_3: Ridge sin intercepto sobre el residuo (app/modelo.py)",
        "configuracion": {"alpha": ALPHA, "intercepto": 0, "coeficientes": coef,
                          "formula": " + ".join(f"{v}·{k}" for k, v in coef.items())},
        "datos": {"archivo": ruta_datos.name, "registros": len(df), "sha256": hashlib.sha256(ruta_datos.read_bytes()).hexdigest(),
                  "anios_objetivo": sorted(int(a) for a in df.anio_objetivo.unique()),
                  "por_tipo": df.tipo_unidad.value_counts().to_dict()},
        "variables_predictoras": cat + num,
        "variables_categoricas": cat,
        "variables_auxiliares": [v["nombre"] for v in reglas["variables"] if v["rol"] == "auxiliar"],
        "categorias_validas": {c: sorted(df[c].dropna().astype(str).unique().tolist()) for c in categoricas},
        "objetivo": reglas["objetivo"],
        "no_enviar_al_modelo": reglas["identificadores"] + [reglas["objetivo"]["nombre"]],
        "reglas": "shared/config/reglas_dominio.json",
        "onnx": {"archivo": "modelo.onnx", "entradas": {c: "string [n,1]" for c in cat} | {c: "float32 [n,1]" for c in num},
                 "salida": "variable float32 [n,1] (puntaje predicho)", "diferencia_max_vs_sklearn": round(dif, 6)},
        "validacion": {
            "estrategia": "temporal: entrena con años objetivo < t y predice t, para cada t desde el segundo año",
            "metrica_principal": "mae_choco (error absoluto medio en puntos, unidades de Chocó, promedio de los años)",
            "mae_choco": mae("choco", "todos"), "mae_choco_municipios": mae("choco", "municipio"),
            "mae_choco_colegios": mae("choco", "colegio"), "mae_pais": mae("pais", "todos"),
            "lineas_base": {"persistencia_mae_choco": mae("choco", "todos", "persistencia"),
                            "promedio_3_mae_choco": mae("choco", "todos", "prom3")},
            "por_anio": "validacion.csv",
        },
        "intervalo_80": intervalos(pred),
        "notas": notas,
    }
    (carpeta / "metadata.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    if activar is None:
        activar = reg["activo"] is None
    registry.registrar({"id": vid, "fecha": meta["fecha_entrenamiento"], "registros": len(df),
                        "variables": cat + num, "algoritmo": meta["algoritmo"], "metricas": meta["validacion"],
                        "ruta": f"models/{vid}/", "datos": ruta_relativa(ruta_datos)}, activar=activar)
    return meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--datos", type=Path, default=ENTRENAMIENTO_CSV)
    ap.add_argument("--activar", action="store_true")
    ap.add_argument("--notas", default="")
    a = ap.parse_args()
    meta = entrenar(a.datos, activar=True if a.activar else None, notas=a.notas)
    v = meta["validacion"]
    print(f"Versión {meta['version']}: {meta['datos']['registros']:,} registros, años {meta['datos']['anios_objetivo']}")
    print(f"  MAE Chocó: {v['mae_choco']} (municipios {v['mae_choco_municipios']}, colegios {v['mae_choco_colegios']}) | país {v['mae_pais']}")
    print(f"  Líneas base Chocó: persistencia {v['lineas_base']['persistencia_mae_choco']}, promedio_3 {v['lineas_base']['promedio_3_mae_choco']}")
    print(f"  Intervalo 80 %: {meta['intervalo_80']}")
    print(f"  ONNX vs scikit-learn: {meta['onnx']['diferencia_max_vs_sklearn']}")


if __name__ == "__main__":
    main()
