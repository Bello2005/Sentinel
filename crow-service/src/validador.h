// Validación de un archivo contra shared/config/reglas_dominio.json y el metadata.json del modelo activo.
//
// Niveles (en este orden): esquema, tipo, contenido, dominio y reglas cruzadas. Cada problema es un error (bloquea
// la predicción) o una advertencia (se informa). El estado final es:
//   compatible                    sin errores ni advertencias
//   compatible_con_advertencias   sin errores, con advertencias
//   incompatible                  al menos un error: no se generan predicciones
// El validador nunca corrige los datos: solo dice qué variable, qué se esperaba, qué se encontró y en qué filas.
#pragma once

#include <nlohmann/json.hpp>
#include <string>
#include <vector>

#include "tabla.h"

using json = nlohmann::json;

enum class Modo { Prediccion, Entrenamiento };  // Entrenamiento = archivo con la variable objetivo, para actualizar

struct Problema {
    std::string nivel;      // "error" | "advertencia"
    std::string categoria;  // "esquema" | "tipo" | "contenido" | "dominio" | "regla"
    std::string variable;   // columna afectada ("" si es del archivo completo)
    std::string mensaje;    // explicación para el usuario
    std::string esperado;
    std::string encontrado;
    size_t filas_afectadas = 0;
    std::vector<size_t> ejemplo_filas;  // número de fila en el CSV (el encabezado es la fila 1)
};

struct ReporteValidacion {
    std::string estado;
    Modo modo = Modo::Prediccion;
    size_t filas = 0;
    std::vector<std::string> recibidas, esperadas, faltantes, adicionales;
    json tipos = json::array();  // [{variable, esperado, detectado}]
    std::vector<Problema> problemas;
    // filas_invalidas[i] = true si la fila i tiene algún error (para el EDA y el reporte)
    std::vector<bool> filas_invalidas;

    size_t errores() const;
    size_t advertencias() const;
    json a_json() const;
};

ReporteValidacion validar(const Tabla& t, const json& reglas, const json& metadata, Modo modo);
