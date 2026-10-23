# SENTINEL · Predictive Governance Platform

Plataforma web para analizar, validar, usar y **gobernar** un modelo predictivo: estima el puntaje global promedio de
Saber 11 que sacará el año siguiente cada municipio y cada colegio (foco en Chocó), con un intervalo "más o menos".

Lo que la distingue: **ningún modelo llega a producción sin aprobación humana**. Cada reentrenamiento produce una
versión *candidata* que se compara con la *activa* con la misma métrica, y solo una persona, con responsable y
justificación escrita, puede activarla o rechazarla.

## Arquitectura

```
Navegador ── Nginx ──┬── Angular (frontend/)               interfaz: validación, EDA, predicción, gobierno
                     └── /api → Crow / C++ (crow-service/)  API REST, validación, EDA, reportes, coordinación
                                   ├── ONNX Runtime (C++)    inferencia con el modelo activo
                                   └── Python (ml-service/)  entrenamiento, candidatas, comparación, decisión
                     shared/                                 reglas, datos, modelos ONNX y registro de versiones
```

| Carpeta | Qué contiene |
|---|---|
| `crow-service/` | API en C++ (Crow + ONNX Runtime): `/api/validar`, `/api/predecir`, `/api/eda`, `/api/actualizar`, `/api/modelo`, `/api/modelo/decision`, `/api/reportes/...` |
| `ml-service/` | Python + scikit-learn: preparación de datos, entrenamiento con validación temporal, exportación a ONNX, actualización y decisión |
| `frontend/` | Angular 20 (Signals, NgRx Signals, Material 3, ApexCharts) |
| `shared/config/reglas_dominio.json` | Esquema y reglas de validación: una sola fuente para Crow y Python |
| `shared/models/` | Una carpeta por versión (`modelo.onnx`, `pipeline.joblib`, `metadata.json`, `validacion.csv`) y `registry.json` (activo, candidatos, históricos, decisiones) |
| `shared/data/` | Tablas de entrada: `entrenamiento.csv`, `novedades_2022.csv` (datos nuevos etiquetados) y `prediccion_2023.csv` |
| `pruebas/` | Archivos de los escenarios de prueba obligatorios y lo que debe dar cada uno |
| `docs/` | Justificación del modelo |

## El modelo

Regresión anclada en el promedio de los últimos 3 años (Ridge sin intercepto sobre el residuo). En validación temporal
(cada año se predice solo con los anteriores) se equivoca en promedio **9,75 puntos** en Chocó, frente a 9,83 del
promedio de 3 años y 11,06 de repetir el último año. Detalles, alternativas descartadas y limitaciones en
[`docs/justificacion_modelo.md`](docs/justificacion_modelo.md).

## Cómo ejecutarlo (desarrollo)

Requisitos: Python 3.12+, Node 22, CMake 3.20+, un compilador C++17, y en `vendor/` (no está en git):
`onnxruntime/` (ONNX Runtime 1.22 para su sistema), `crow/` (Crow 1.2.1), `asio/` (Asio 1.30.2) e
`include/` con `nlohmann/json.hpp` y `rapidcsv.h`.

```bash
# 1. Python
python -m venv .venv && .venv/bin/pip install -r ml-service/requirements.txt

# 2. Backend Crow
cmake -S crow-service -B crow-service/build && cmake --build crow-service/build -j
crow-service/build/saber11_api --shared shared --puerto 8080 --python .venv/bin/python --ml-service ml-service

# 3. Frontend (en otra terminal)
cd frontend && npm install && npx ng serve     # http://localhost:4200, /api va a Crow por proxy.conf.json
```

Prueba completa: en la interfaz, *Validación → Cargar ejemplo* recorre los escenarios de `pruebas/`;
*Laboratorio → Cargar ejemplo → Novedades 2022* entrena la candidata v2; *Comparación* y *Centro de decisión*
completan el flujo. Los mismos escenarios por `curl` están en [`pruebas/README.md`](pruebas/README.md).

Para regenerar los datos y el modelo desde los microdatos (`../datos/saber11_limpio.parquet` del proyecto de análisis):

```bash
cd ml-service && python -m app.preparar_datos && python -m app.entrenar --activar
```

## Datos y licencia

Los datos provienen de *Resultados únicos Saber 11* del **ICFES** ([datos.gov.co](https://www.datos.gov.co/d/kgxf-xxbe)),
publicados con licencia **CC BY-SA 4.0**. Los archivos de `shared/data/` y `pruebas/` son agregados por municipio y
colegio (no contienen datos de estudiantes) y se comparten con la misma licencia. Fuente: ICFES.
