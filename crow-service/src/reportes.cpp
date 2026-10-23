#include "reportes.h"

#include <chrono>
#include <ctime>
#include <fstream>
#include <iomanip>
#include <random>
#include <sstream>

namespace {

std::string html(const std::string& s) {
    std::string r;
    for (char c : s) {
        switch (c) {
            case '<': r += "&lt;"; break;
            case '>': r += "&gt;"; break;
            case '&': r += "&amp;"; break;
            case '"': r += "&quot;"; break;
            default: r += c;
        }
    }
    return r;
}

std::string texto(const json& v) { return v.is_string() ? v.get<std::string>() : v.dump(); }

void escribir(const std::filesystem::path& ruta, const std::string& contenido) {
    std::ofstream f(ruta, std::ios::binary);
    f << contenido;
}

}  // namespace

std::string ahora_iso() {
    auto t = std::chrono::system_clock::to_time_t(std::chrono::system_clock::now());
    std::ostringstream o;
    o << std::put_time(std::localtime(&t), "%Y-%m-%dT%H:%M:%S");
    return o.str();
}

std::string nuevo_id() {
    auto t = std::chrono::system_clock::to_time_t(std::chrono::system_clock::now());
    static thread_local std::mt19937 gen{std::random_device{}()};
    std::ostringstream o;
    o << std::put_time(std::localtime(&t), "%Y%m%d-%H%M%S") << "-" << std::hex << std::setw(4) << std::setfill('0')
      << (gen() & 0xffff);
    return o.str();
}

std::string escapar_csv(const std::string& s) {
    if (s.find_first_of(",\"\n;") == std::string::npos) return s;
    std::string r = "\"";
    for (char c : s) r += c == '"' ? std::string("\"\"") : std::string(1, c);
    return r + "\"";
}

void guardar_compatibilidad(const std::filesystem::path& carpeta, const json& rep) {
    std::filesystem::create_directories(carpeta);
    escribir(carpeta / "compatibilidad.json", rep.dump(2));

    const std::string estado = rep["estado"];
    const std::string color = estado == "compatible" ? "#1a7f37" : estado == "incompatible" ? "#cf222e" : "#9a6700";
    std::ostringstream h;
    h << "<!doctype html><html lang='es'><head><meta charset='utf-8'><title>Reporte de compatibilidad</title><style>"
         ":root{color-scheme:light}body{font-family:system-ui,sans-serif;max-width:1000px;margin:2rem auto;padding:0 1rem;color:#1f2328;background:#fff}"
         "table{border-collapse:collapse;width:100%;margin:1rem 0;font-size:14px}th,td{border:1px solid #d0d7de;padding:6px 8px;"
         "text-align:left;vertical-align:top}th{background:#f6f8fa}.error{color:#cf222e;font-weight:600}"
         ".advertencia{color:#9a6700;font-weight:600}</style></head><body>";
    h << "<h1>Reporte de compatibilidad</h1>";
    h << "<p><b>Archivo:</b> " << html(texto(rep["archivo"])) << " &nbsp; <b>Fecha:</b> " << html(texto(rep["fecha"]))
      << " &nbsp; <b>Modelo:</b> " << html(texto(rep["modelo_version"])) << " &nbsp; <b>Modo:</b> " << html(texto(rep["modo"])) << "</p>";
    h << "<h2 style='color:" << color << "'>Estado: " << html(estado) << "</h2>";
    h << "<p>" << rep["filas"] << " filas, " << rep["filas_con_errores"] << " con errores. " << rep["resumen"]["errores"]
      << " errores y " << rep["resumen"]["advertencias"] << " advertencias.</p>";

    auto lista = [&](const char* titulo, const json& v) {
        h << "<p><b>" << titulo << ":</b> ";
        if (v.empty()) h << "ninguna";
        for (size_t i = 0; i < v.size(); ++i) h << (i ? ", " : "") << html(texto(v[i]));
        h << "</p>";
    };
    h << "<h2>Columnas</h2>";
    lista("Esperadas", rep["columnas"]["esperadas"]);
    lista("Recibidas", rep["columnas"]["recibidas"]);
    lista("Faltantes", rep["columnas"]["faltantes"]);
    lista("Adicionales (se ignoran)", rep["columnas"]["adicionales"]);

    h << "<h2>Tipos de datos</h2><table><tr><th>Variable</th><th>Esperado</th><th>Detectado</th></tr>";
    for (const auto& t : rep["tipos"])
        h << "<tr><td>" << html(texto(t["variable"])) << "</td><td>" << html(texto(t["esperado"])) << "</td><td>"
          << html(texto(t["detectado"])) << "</td></tr>";
    h << "</table><h2>Errores y advertencias</h2>";
    if (rep["problemas"].empty()) h << "<p>Ninguno.</p>";
    else {
        h << "<table><tr><th>Nivel</th><th>Categoría</th><th>Variable</th><th>Qué pasa</th><th>Esperado</th><th>Encontrado</th>"
             "<th>Filas</th><th>Ejemplos (fila del CSV)</th></tr>";
        for (const auto& p : rep["problemas"]) {
            std::string ej;
            for (const auto& f : p["ejemplo_filas"]) ej += (ej.empty() ? "" : ", ") + f.dump();
            h << "<tr><td class='" << html(texto(p["nivel"])) << "'>" << html(texto(p["nivel"])) << "</td><td>"
              << html(texto(p["categoria"])) << "</td><td>" << html(texto(p["variable"])) << "</td><td>" << html(texto(p["mensaje"]))
              << "</td><td>" << html(texto(p["esperado"])) << "</td><td>" << html(texto(p["encontrado"])) << "</td><td>"
              << p["filas_afectadas"] << "</td><td>" << ej << "</td></tr>";
        }
        h << "</table>";
    }
    h << "<p style='color:#59636e'>El sistema no corrige los datos: corrija el archivo y vuelva a validarlo.</p></body></html>";
    escribir(carpeta / "compatibilidad.html", h.str());
}

void guardar_predicciones(const std::filesystem::path& carpeta, const json& filas, const json& resumen) {
    std::filesystem::create_directories(carpeta);
    std::ostringstream c;
    const std::vector<std::string> cols = {"codigo", "nombre", "tipo_unidad", "departamento_cod", "municipio_cod",
                                           "anio_objetivo", "prediccion", "mas_menos", "desde", "hasta"};
    for (size_t j = 0; j < cols.size(); ++j) c << (j ? "," : "") << cols[j];
    c << "\n";
    for (const auto& f : filas) {
        for (size_t j = 0; j < cols.size(); ++j) c << (j ? "," : "") << escapar_csv(f[cols[j]].is_null() ? "" : texto(f[cols[j]]));
        c << "\n";
    }
    escribir(carpeta / "predicciones.csv", c.str());
    escribir(carpeta / "predicciones_resumen.json", resumen.dump(2));
}
