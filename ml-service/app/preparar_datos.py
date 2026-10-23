"""Arma las tablas de entrada del modelo a partir de los microdatos de Saber 11 (paso offline).

Uso (desde sistema-web/ml-service):
    python -m app.preparar_datos                       # lee ../../datos/saber11_limpio.parquet
    python -m app.preparar_datos --parquet otra/ruta.parquet

Cada fila es una UNIDAD (municipio o colegio) y el AÑO QUE SE QUIERE PREDECIR (`anio_objetivo`). Las columnas
resumen lo que se sabía de la unidad antes de ese año; `puntaje_real` es lo que realmente sacó (variable objetivo).
Es el mismo formato que la aplicación recibe en un CSV, así que el validador, el EDA y el modelo ven lo mismo.

Escribe en shared/data/:
    entrenamiento.csv       filas con objetivo hasta el penúltimo año completo (hoy, 2015-2020): versión inicial
    novedades_<año>.csv     filas con objetivo del último año completo (hoy, 2022): para la demo de actualización
    prediccion_<año>.csv    filas del año siguiente, sin objetivo (hoy, 2023): para predecir

Años faltantes: se usa el último año con datos antes de `anio_objetivo` y `anios_desde_ultimo` dice cuántos años
pasaron. 2018 y 2021 no están completos en datos.gov.co; si se agregan al parquet, se detectan solos (un año con más
de 100.000 estudiantes cuenta como completo).
"""
import argparse
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

from .config import DATOS

PARQUET = Path(__file__).resolve().parents[3] / "datos" / "saber11_limpio.parquet"
MIN_ESTUDIANTES_ANIO = 100_000
MAX_GAP = 4
COVARIABLES = ["pct_internet", "pct_madre_superior", "pct_extraedad", "pct_rural", "pct_oficial"]
COLUMNAS = ["codigo", "nombre", "tipo_unidad", "departamento_cod", "municipio_cod", "anio_objetivo", "anio_ultimo",
            "anios_desde_ultimo", "puntaje_ultimo", "puntaje_anterior", "promedio_3", "puntaje_grupo",
            "estudiantes_ultimo"] + COVARIABLES + ["puntaje_real"]


def panel(parquet):
    """Puntaje promedio y composición por (unidad, año), solo calendario A y años completos."""
    con = duckdb.connect()
    con.sql(f"""CREATE TABLE e AS
        SELECT anio, depto_cod, mcpio_cod, mcpio_nombre, cole_cod_dane_establecimiento AS colegio,
               cole_nombre_establecimiento AS colegio_nombre, punt_global AS y,
               tiene_internet::INT AS internet,
               CASE WHEN fami_educacion_madre_nivel IS NOT NULL THEN
                    (fami_educacion_madre_nivel IN ('4. Técnica o tecnológica', '5. Profesional o posgrado'))::INT END AS madre_sup,
               (edad >= 19)::INT AS extraedad, (cole_area = 'RURAL')::INT AS rural, (cole_naturaleza = 'OFICIAL')::INT AS oficial
        FROM '{parquet}'
        WHERE anio >= 2014 AND valido_publicar AND punt_global IS NOT NULL AND right(periodo::VARCHAR, 1) <> '1'
          AND mcpio_cod IS NOT NULL""")
    completos = con.sql(f"SELECT anio FROM e GROUP BY 1 HAVING count(*) > {MIN_ESTUDIANTES_ANIO} ORDER BY 1").df().anio.tolist()
    agregados = """count(*) AS n, avg(y) AS y, avg(internet) AS pct_internet, avg(madre_sup) AS pct_madre_superior,
                   avg(extraedad) AS pct_extraedad, avg(rural) AS pct_rural, avg(oficial) AS pct_oficial"""
    mun = con.sql(f"""SELECT anio, mcpio_cod AS codigo, any_value(depto_cod) AS departamento_cod, mcpio_cod AS municipio_cod,
                             mode(mcpio_nombre) AS nombre, {agregados} FROM e GROUP BY 1, 2""").df()
    col = con.sql(f"""SELECT anio, colegio AS codigo, mode(depto_cod) AS departamento_cod, mode(mcpio_cod) AS municipio_cod,
                             mode(colegio_nombre) AS nombre, {agregados} FROM e WHERE colegio IS NOT NULL GROUP BY 1, 2""").df()
    # Grupo de referencia de cada unidad: el departamento para los municipios y el municipio para los colegios
    dep = con.sql("SELECT anio, depto_cod AS departamento_cod, avg(y) AS grupo FROM e GROUP BY 1, 2").df()
    mun = mun.merge(dep, on=["anio", "departamento_cod"])
    col = col.merge(mun[["anio", "codigo", "y"]].rename(columns={"codigo": "municipio_cod", "y": "grupo"}),
                    on=["anio", "municipio_cod"])
    datos = pd.concat([mun.assign(tipo_unidad="municipio"), col.assign(tipo_unidad="colegio")])
    return datos[datos.anio.isin(completos)], completos


def filas(p, t):
    """Una fila por unidad con historia antes de t; `puntaje_real` queda vacío si la unidad no tiene datos en t."""
    hist = p[p.anio < t].sort_values(["tipo_unidad", "codigo", "anio"])
    g = hist.groupby(["tipo_unidad", "codigo"])
    ult = g.tail(1).set_index(["tipo_unidad", "codigo"])
    x = ult[["nombre", "departamento_cod", "municipio_cod"]].copy()
    x["anio_objetivo"] = t
    x["anio_ultimo"] = ult.anio
    x["anios_desde_ultimo"] = t - ult.anio
    x["puntaje_ultimo"] = ult.y
    # Con un solo año de historia, el año anterior es el mismo último año
    x["puntaje_anterior"] = g.nth(-2).set_index(["tipo_unidad", "codigo"]).y.reindex(x.index).fillna(ult.y)
    x["promedio_3"] = g.tail(3).groupby(["tipo_unidad", "codigo"]).y.mean()
    x["puntaje_grupo"] = ult.grupo
    x["estudiantes_ultimo"] = ult.n
    for c in COVARIABLES:   # último valor conocido (2020-2 no trae la edad, por ejemplo)
        x[c] = g[c].last()
    x["puntaje_real"] = p[p.anio == t].set_index(["tipo_unidad", "codigo"]).y.reindex(x.index)
    # Unidades que llevan más de MAX_GAP años sin datos (colegios cerrados o que reaparecen) quedan fuera:
    # su último dato ya no describe a la unidad. El mismo límite está en reglas_dominio.json.
    x = x[x.anios_desde_ultimo <= MAX_GAP]
    return x.reset_index()[COLUMNAS]


def guardar(df, nombre):
    df = df.copy()
    num = df.select_dtypes("float").columns
    df[num] = df[num].round(4)
    df.to_csv(DATOS / nombre, index=False)
    print(f"  {nombre}: {len(df):,} filas ({(df.tipo_unidad == 'municipio').sum():,} municipios, "
          f"{(df.tipo_unidad == 'colegio').sum():,} colegios)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--parquet", type=Path, default=PARQUET)
    args = ap.parse_args()
    DATOS.mkdir(parents=True, exist_ok=True)
    p, anios = panel(args.parquet)
    print(f"Años completos: {anios}")
    etiquetadas = pd.concat([filas(p, t) for t in anios[1:]]).dropna(subset=["puntaje_real"])
    # Las unidades sin historia previa no tienen fila (no hay con qué predecir); las que faltan alguna covariable,
    # tampoco: el modelo exige todas las variables y no se rellenan en silencio.
    etiquetadas = etiquetadas.dropna(subset=["puntaje_anterior", "promedio_3"] + COVARIABLES)
    ultimo = anios[-1]
    guardar(etiquetadas[etiquetadas.anio_objetivo < ultimo], "entrenamiento.csv")
    guardar(etiquetadas[etiquetadas.anio_objetivo == ultimo], f"novedades_{ultimo}.csv")
    nuevas = filas(p, ultimo + 1).dropna(subset=COVARIABLES).drop(columns="puntaje_real")
    guardar(nuevas, f"prediccion_{ultimo + 1}.csv")


if __name__ == "__main__":
    main()
