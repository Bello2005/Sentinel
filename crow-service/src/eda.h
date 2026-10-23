// EDA automático: analiza cualquier CSV (aunque sea incompatible con el modelo) según los tipos que encuentra.
//
// No es una plantilla fija: primero clasifica cada columna (numérica, discreta, categórica, temporal, identificador o
// texto) y según eso decide qué estadísticas calcular y qué gráficas proponer. Devuelve JSON con los datos listos
// para dibujar (histogramas, cajas, barras, líneas, dispersión y mapa de correlaciones); Angular y el reporte HTML
// los dibujan de forma interactiva.
//
// Criterios (documentados también en la respuesta, campo "criterios"):
//   numérica       al menos 95 % de los valores no vacíos son números
//   discreta       numérica entera con 10 valores distintos o menos (se grafica con barras)
//   temporal       años (enteros entre 1990 y 2100 en una columna cuyo nombre dice anio/año/fecha) o fechas AAAA-MM-DD
//   identificador  nombre tipo codigo/id/*_cod/*_id, o texto con un valor distinto por fila
//   categórica     texto con 50 valores distintos o menos (o menos del 5 % de las filas)
//   texto          el resto (por ejemplo, nombres)
//   atípicos       regla de Tukey: fuera de [Q1 − 1,5·RIC, Q3 + 1,5·RIC]
//   relaciones     correlación de Pearson entre numéricas (|r| ≥ 0,3) y eta² entre categóricas y numéricas (≥ 0,06).
//                  Son asociaciones, no causas.
#pragma once

#include <nlohmann/json.hpp>

#include "tabla.h"

using json = nlohmann::json;

json analizar(const Tabla& t);
