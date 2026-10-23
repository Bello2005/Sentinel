# Archivos de prueba (punto 12 de la actividad)

Se generan con `python pruebas/generar_pruebas.py` (desde `sistema-web/`) a partir de `shared/data/`.
Cada archivo aplica un cambio controlado a filas reales de Chocó (pronóstico 2023).

| # | Archivo | Escenario | Resultado esperado (verificado con la API) |
|---|---|---|---|
| 1 | `01_compatible.csv` | Completamente compatible (155 unidades con 10 o más estudiantes) | `compatible`; `/api/predecir` genera 155 predicciones |
| 2 | `02_falta_variable.csv` | Falta `promedio_3` | `incompatible`: error de esquema, columna faltante |
| 3 | `03_tipo_incompatible.csv` | Texto en `puntaje_ultimo` ("doscientos", "N/A", "210,5") | `incompatible`: error de tipo, esperado `numerico`, filas 5, 12 y 27 |
| 4 | `04_faltantes.csv` | Vacíos en `puntaje_anterior` | `incompatible`: 4 vacíos, filas 2, 9, 10 y 42; no se rellenan |
| 5 | `05_categoria_nueva.csv` | `tipo_unidad = departamento` | `incompatible`: categoría no vista (válidas: colegio, municipio), filas 4 y 7 |
| 6 | `06_columnas_adicionales.csv` | Columnas `observaciones` y `rector` + unidades pequeñas | `compatible_con_advertencias`: 2 columnas ignoradas y 52 filas con menos de 10 estudiantes; sí predice |
| 7 | `07_solo_eda.csv` | Solo 9 columnas, puntajes 650 y −12, `pct_internet = 87` | `incompatible` (9 errores): no predice; `/api/eda` sí lo analiza y marca como atípicos 650, −12 y 87 |
| 8 | `08_novedades_2022_etiquetadas.csv` | Datos nuevos con el valor real (`puntaje_real`) de 2022 | `modo=entrenamiento`: `compatible_con_advertencias`. `/api/actualizar` entrena la candidata v2 (MAE 9,47 frente a 9,75; en los mismos años 9,75 y 9,75) y sugiere activarla |
| extra | `09_reglas_de_dominio.csv` | `puntaje_grupo = 520`, `anios_desde_ultimo` incoherente y una fila duplicada | `incompatible`: 1 error de dominio y 2 de reglas cruzadas |

Las filas se cuentan como en Excel: el encabezado es la fila 1.

## Probarlos contra la API

```bash
curl -F "archivo=@pruebas/01_compatible.csv" http://localhost:8080/api/validar
curl -F "archivo=@pruebas/01_compatible.csv" http://localhost:8080/api/predecir
curl -F "archivo=@pruebas/04_faltantes.csv"  http://localhost:8080/api/predecir     # HTTP 409, sin predicciones
curl -F "archivo=@pruebas/08_novedades_2022_etiquetadas.csv" "http://localhost:8080/api/validar?modo=entrenamiento"
curl -F "archivo=@pruebas/07_solo_eda.csv" http://localhost:8080/api/eda              # EDA aunque sea incompatible
curl -F "archivo=@pruebas/08_novedades_2022_etiquetadas.csv" http://localhost:8080/api/actualizar   # crea la candidata v2
curl -X POST -d '{"version":"v2","accion":"activar","justificacion":"Incorpora 2022 y no empeora en los mismos años"}' http://localhost:8080/api/modelo/decision
```

Si se usa `01_compatible.csv` en `/api/actualizar`, responde HTTP 409: no trae `puntaje_real` y no se entrena nada.

Cada respuesta trae `descargas` con los enlaces al reporte de compatibilidad (HTML y JSON) y, si predijo, a
`predicciones.csv` y `predicciones_resumen.json`.
