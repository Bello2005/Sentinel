"""Genera los archivos de los escenarios de prueba obligatorios (punto 12 de la actividad).

Uso (desde sistema-web/):  python pruebas/generar_pruebas.py
Parte de shared/data/prediccion_2023.csv y novedades_2022.csv (ml-service/app/preparar_datos.py) y aplica a cada
escenario un cambio controlado. Lo que se espera de cada archivo está en pruebas/README.md.
"""
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parent
DATOS = RAIZ.parent / "shared" / "data"
TEXTO = {"codigo": str, "departamento_cod": str, "municipio_cod": str}

base = pd.read_csv(DATOS / "prediccion_2023.csv", dtype=TEXTO)
choco = base[base.departamento_cod == "27"].reset_index(drop=True)
# Compatible sin advertencias: unidades con 10 o más estudiantes (las pequeñas generan una advertencia)
grandes = choco[choco.estudiantes_ultimo >= 10].reset_index(drop=True)


def guardar(df, nombre):
    df.to_csv(RAIZ / nombre, index=False)
    print(f"{nombre}: {len(df)} filas, {len(df.columns)} columnas")


# 1. Completamente compatible
guardar(grandes, "01_compatible.csv")

# 2. Falta una variable obligatoria (predictora)
guardar(grandes.drop(columns="promedio_3"), "02_falta_variable.csv")

# 3. Tipo de dato incompatible: texto en una variable numérica
d = grandes.astype({"puntaje_ultimo": object}).copy()
d.loc[[3, 10, 25], "puntaje_ultimo"] = ["doscientos", "N/A", "210,5"]
guardar(d, "03_tipo_incompatible.csv")

# 4. Valores faltantes en una variable necesaria para la predicción
d = grandes.copy()
d.loc[[0, 7, 8, 40], "puntaje_anterior"] = None
guardar(d, "04_faltantes.csv")

# 5. Categoría no contemplada durante el entrenamiento
d = grandes.copy()
d.loc[[2, 5], "tipo_unidad"] = "departamento"
guardar(d, "05_categoria_nueva.csv")

# 6. Columnas adicionales que el modelo no usa (y unidades pequeñas: también advierte)
d = choco.copy()
d["observaciones"] = "sin novedad"
d["rector"] = "N.N."
guardar(d, "06_columnas_adicionales.csv")

# 7. No sirve para predecir, pero sí para el EDA: le faltan varias variables y trae valores fuera de rango
d = choco[["codigo", "nombre", "tipo_unidad", "municipio_cod", "puntaje_ultimo", "estudiantes_ultimo", "pct_internet",
           "pct_rural", "pct_oficial"]].copy()
d.loc[[1, 4], "puntaje_ultimo"] = [650, -12]
d.loc[[6], "pct_internet"] = 87  # porcentaje escrito como 0-100 en vez de proporción
guardar(d, "07_solo_eda.csv")

# 8. Nuevos datos etiquetados (con el valor real) para actualizar el modelo
guardar(pd.read_csv(DATOS / "novedades_2022.csv", dtype=TEXTO), "08_novedades_2022_etiquetadas.csv")

# Extra: regla de dominio y regla cruzada incumplidas (puntaje fuera de rango, gap incoherente, duplicado)
d = grandes.copy()
d.loc[[1], "puntaje_grupo"] = 520
d.loc[[2], "anios_desde_ultimo"] = 3
d = pd.concat([d, d.iloc[[0]]])
guardar(d, "09_reglas_de_dominio.csv")
