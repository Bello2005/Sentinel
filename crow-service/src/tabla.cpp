#include "tabla.h"

#include <rapidcsv.h>

#include <cmath>
#include <cstdlib>
#include <sstream>
#include <stdexcept>

std::string recortar(const std::string& s) {
    const auto ini = s.find_first_not_of(" \t\r\n");
    if (ini == std::string::npos) return "";
    const auto fin = s.find_last_not_of(" \t\r\n");
    return s.substr(ini, fin - ini + 1);
}

std::optional<double> a_numero(const std::string& texto) {
    const std::string s = recortar(texto);
    if (s.empty()) return std::nullopt;
    char* fin = nullptr;
    const double v = std::strtod(s.c_str(), &fin);
    if (fin != s.c_str() + s.size() || !std::isfinite(v)) return std::nullopt;
    return v;
}

int Tabla::indice(const std::string& nombre) const {
    for (size_t j = 0; j < columnas.size(); ++j)
        if (columnas[j] == nombre) return static_cast<int>(j);
    return -1;
}

const std::string& Tabla::celda(size_t fila, int col) const {
    static const std::string vacio;
    const auto& f = filas[fila];
    return col >= 0 && static_cast<size_t>(col) < f.size() ? f[col] : vacio;
}

Tabla leer_csv(const std::string& texto_original) {
    std::string texto = texto_original;
    if (texto.rfind("\xEF\xBB\xBF", 0) == 0) texto.erase(0, 3);  // BOM de Excel
    if (recortar(texto).empty()) throw std::runtime_error("El archivo está vacío.");

    // Separador: el que más aparece en la primera línea (Excel en español guarda con ';')
    const std::string primera = texto.substr(0, texto.find('\n'));
    const char sep = std::count(primera.begin(), primera.end(), ';') > std::count(primera.begin(), primera.end(), ',') ? ';' : ',';

    Tabla t;
    try {
        std::istringstream in(texto);
        rapidcsv::Document doc(in, rapidcsv::LabelParams(0, -1), rapidcsv::SeparatorParams(sep, false, true, true, true));
        for (auto& c : doc.GetColumnNames()) t.columnas.push_back(recortar(c));
        for (size_t i = 0; i < doc.GetRowCount(); ++i) {
            auto fila = doc.GetRow<std::string>(i);
            bool vacia = true;
            for (auto& c : fila) vacia = vacia && recortar(c).empty();
            if (!vacia) t.filas.push_back(std::move(fila));  // ignora líneas en blanco al final
        }
    } catch (const std::exception&) {
        throw std::runtime_error("No se pudo leer el archivo como CSV. Revise que sea texto separado por comas o punto y coma.");
    }
    if (t.columnas.empty()) throw std::runtime_error("El archivo no tiene encabezados.");
    return t;
}
