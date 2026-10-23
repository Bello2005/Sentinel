// Reportes que se guardan en shared/reportes/<id>/ y se descargan por la API.
#pragma once

#include <filesystem>
#include <nlohmann/json.hpp>
#include <string>
#include <vector>

using json = nlohmann::json;

std::string nuevo_id();                 // 20261022-183015-a3f9: fecha, hora y sufijo aleatorio
std::string ahora_iso();
std::string escapar_csv(const std::string& s);

// Escribe compatibilidad.json y compatibilidad.html a partir del reporte de validación (ya en JSON)
void guardar_compatibilidad(const std::filesystem::path& carpeta, const json& reporte);
// Escribe <prefijo>.json y <prefijo>.html (reporte interactivo con los datos incrustados; ver reporte_eda.cpp)
void guardar_eda(const std::filesystem::path& carpeta, const json& reporte, const std::string& prefijo = "eda");
// Escribe predicciones.csv (una fila por registro) y predicciones_resumen.json
void guardar_predicciones(const std::filesystem::path& carpeta, const json& filas, const json& resumen);
