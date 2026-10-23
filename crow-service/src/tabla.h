// Tabla en memoria leída de un CSV: todo como texto, para que el validador decida los tipos.
#pragma once

#include <optional>
#include <string>
#include <vector>

struct Tabla {
    std::vector<std::string> columnas;
    std::vector<std::vector<std::string>> filas;  // filas[i][j] = celda de la fila i (0 = primera de datos), columna j

    // Índice de la columna o -1 si no está
    int indice(const std::string& nombre) const;
    // Valor de la celda; "" si la fila es más corta que el encabezado
    const std::string& celda(size_t fila, int col) const;
};

// Lee un CSV desde texto. Detecta el separador (',' o ';'), quita el BOM y los espacios de los encabezados.
// Lanza std::runtime_error con un mensaje para el usuario si el archivo no se puede leer como CSV.
Tabla leer_csv(const std::string& texto);

// Conversión estricta: nullopt si el texto (sin espacios) no es un número completo. "" también da nullopt.
std::optional<double> a_numero(const std::string& texto);
std::string recortar(const std::string& s);
