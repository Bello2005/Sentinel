// Backend Crow: API REST, validación y coordinación. Inferencia con ONNX Runtime sobre el modelo activo.
//
// Uso: saber11_api [--shared RUTA] [--puerto N] [--python RUTA] [--ml-service RUTA] [--web RUTA] [--host IP]
//      (por defecto ../shared, 8080, python3 y ../ml-service; también SABER_SHARED, PUERTO, SABER_PYTHON, SABER_ML,
//       SABER_WEB y SABER_HOST). Con --web, Crow sirve además la interfaz Angular compilada (dist/frontend/browser)
//       y cualquier ruta que no sea /api devuelve index.html (navegación de una SPA). --host por defecto 0.0.0.0.
//
// Endpoints:
//   GET  /api/salud                         el servicio está vivo
//   GET  /api/modelo                        metadatos del modelo activo y registro de versiones
//   POST /api/eda                           EDA automático de cualquier CSV (aunque sea incompatible con el modelo)
//   POST /api/validar?modo=prediccion       valida un CSV (multipart, campo "archivo"); modo=entrenamiento exige el objetivo
//   POST /api/predecir                      valida y, solo si no hay errores, predice con el modelo activo
//                                           (archivo incompatible: HTTP 409 con el reporte y sin predicciones)
//   POST /api/actualizar                    datos etiquetados: valida, hace EDA, Python entrena una CANDIDATA y la compara
//   POST /api/modelo/decision               {"version","accion":"activar"|"rechazar","justificacion","responsable"}
//   GET  /api/reportes/<id>/<archivo>       descarga un reporte generado (compatibilidad.html|json, predicciones.csv, ...)
#define CROW_MAIN
#include <crow.h>

#include <crow/middlewares/cors.h>

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <map>
#include <regex>
#include <set>

#include "eda.h"
#include "entrenamiento.h"
#include "modelo.h"
#include "reportes.h"
#include "tabla.h"
#include "validador.h"

namespace fs = std::filesystem;

namespace {

struct Archivo {
    std::string nombre, contenido;
};

// El archivo puede venir como multipart/form-data (campo "archivo", lo que manda Angular) o como cuerpo crudo
Archivo leer_archivo(const crow::request& req) {
    const auto tipo = req.get_header_value("Content-Type");
    if (tipo.find("multipart/form-data") != std::string::npos) {
        crow::multipart::message msg(req);
        auto parte = msg.get_part_by_name("archivo");
        if (parte.body.empty()) throw std::runtime_error("No se recibió ningún archivo (campo 'archivo').");
        const auto& cd = parte.get_header_object("Content-Disposition");
        auto it = cd.params.find("filename");
        std::string nombre = it != cd.params.end() ? it->second : "archivo.csv";
        nombre.erase(std::remove(nombre.begin(), nombre.end(), '"'), nombre.end());
        return {nombre, parte.body};
    }
    if (req.body.empty()) throw std::runtime_error("No se recibió ningún archivo.");
    const char* n = req.url_params.get("nombre");
    return {n ? n : "archivo.csv", req.body};
}

void verificar_extension(const std::string& nombre) {
    std::string ext = fs::path(nombre).extension().string();
    std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
    if (ext == ".xlsx" || ext == ".xls")
        throw std::runtime_error("Por ahora solo se aceptan archivos CSV. En Excel: Archivo > Guardar como > CSV UTF-8.");
}

crow::response json_resp(int codigo, const json& cuerpo) {
    crow::response r(codigo, cuerpo.dump());
    r.set_header("Content-Type", "application/json; charset=utf-8");
    return r;
}

crow::response error_resp(int codigo, const std::string& mensaje) { return json_resp(codigo, {{"error", mensaje}}); }

double redondear(double x, int dec = 1) {
    const double f = std::pow(10.0, dec);
    return std::round(x * f) / f;
}

json descargas(const std::string& id, std::initializer_list<const char*> archivos) {
    json d = json::object();
    for (auto a : archivos) d[a] = "/api/reportes/" + id + "/" + a;
    return d;
}

struct Contexto {
    fs::path shared;
    GestorModelo modelos;
    Entrenamiento python;
    json reglas() const { return leer_json(shared / "config" / "reglas_dominio.json"); }
    fs::path carpeta_reporte(const std::string& id) const { return shared / "reportes" / id; }
};

// Valida y guarda el reporte de compatibilidad. Devuelve el JSON completo (con id, archivo y descargas).
json validar_y_guardar(Contexto& ctx, const Archivo& a, Modo modo, const Tabla& t, const Modelo& m, const std::string& id) {
    auto rep = validar(t, ctx.reglas(), m.metadata(), modo);
    json j = rep.a_json();
    j["id"] = id;
    j["archivo"] = a.nombre;
    j["fecha"] = ahora_iso();
    j["modelo_version"] = m.version();
    guardar_compatibilidad(ctx.carpeta_reporte(id), j);
    j["descargas"] = descargas(id, {"compatibilidad.html", "compatibilidad.json"});
    return j;
}

json resumen_predicciones(const json& filas) {
    std::map<std::string, std::vector<double>> por_tipo;
    std::vector<double> todas;
    for (const auto& f : filas) {
        por_tipo[f["tipo_unidad"]].push_back(f["prediccion"]);
        todas.push_back(f["prediccion"]);
    }
    auto stats = [](std::vector<double> v) {
        std::sort(v.begin(), v.end());
        double s = 0;
        for (double x : v) s += x;
        return json{{"registros", v.size()}, {"promedio", redondear(s / v.size())}, {"minimo", redondear(v.front())},
                    {"mediana", redondear(v[v.size() / 2])}, {"maximo", redondear(v.back())}};
    };
    json r = {{"general", stats(todas)}, {"por_tipo_unidad", json::object()}};
    for (auto& [tipo, v] : por_tipo) r["por_tipo_unidad"][tipo] = stats(v);
    return r;
}

}  // namespace

int main(int argc, char** argv) {
    std::string shared = std::getenv("SABER_SHARED") ? std::getenv("SABER_SHARED") : "../shared";
    int puerto = std::getenv("PUERTO") ? std::atoi(std::getenv("PUERTO")) : 8080;
    std::string python = std::getenv("SABER_PYTHON") ? std::getenv("SABER_PYTHON") : "python3";
    std::string ml = std::getenv("SABER_ML") ? std::getenv("SABER_ML") : "../ml-service";
    std::string web = std::getenv("SABER_WEB") ? std::getenv("SABER_WEB") : "";
    std::string host = std::getenv("SABER_HOST") ? std::getenv("SABER_HOST") : "0.0.0.0";
    for (int i = 1; i + 1 < argc; i += 2) {
        std::string a = argv[i];
        if (a == "--shared") shared = argv[i + 1];
        else if (a == "--puerto") puerto = std::atoi(argv[i + 1]);
        else if (a == "--python") python = argv[i + 1];
        else if (a == "--ml-service") ml = argv[i + 1];
        else if (a == "--web") web = argv[i + 1];
        else if (a == "--host") host = argv[i + 1];
    }
    Contexto ctx{fs::absolute(shared), GestorModelo(fs::absolute(shared)),
                 Entrenamiento(python.find('/') == std::string::npos ? fs::path(python) : fs::absolute(python), fs::absolute(ml))};
    fs::create_directories(ctx.shared / "reportes");

    crow::App<crow::CORSHandler> app;
    // En producción Nginx sirve Angular y la API en el mismo dominio; CORS abierto solo ayuda en desarrollo (ng serve)
    app.get_middleware<crow::CORSHandler>().global().origin("*").methods("GET"_method, "POST"_method).headers("Content-Type");

    CROW_ROUTE(app, "/api/salud")([&] {
        json j = {{"estado", "ok"}, {"shared", ctx.shared.string()}};
        try { j["modelo_activo"] = ctx.modelos.activo()->version(); } catch (const std::exception& e) { j["modelo_activo"] = nullptr; }
        return json_resp(200, j);
    });

    CROW_ROUTE(app, "/api/modelo")([&] {
        try {
            auto m = ctx.modelos.activo();
            return json_resp(200, {{"activo", m->metadata()}, {"registro", ctx.modelos.registro()}});
        } catch (const std::exception& e) { return error_resp(503, e.what()); }
    });

    // El EDA no depende del modelo: se puede analizar un archivo incompatible para entender qué corregir
    CROW_ROUTE(app, "/api/eda").methods("POST"_method)([&](const crow::request& req) {
        try {
            auto a = leer_archivo(req);
            verificar_extension(a.nombre);
            auto t = leer_csv(a.contenido);
            const std::string id = nuevo_id();
            json r = {{"id", id}, {"archivo", a.nombre}, {"fecha", ahora_iso()}, {"eda", analizar(t)}};
            guardar_eda(ctx.carpeta_reporte(id), r);
            r["descargas"] = descargas(id, {"eda.html", "eda.json"});
            return json_resp(200, r);
        } catch (const std::exception& e) { return error_resp(400, e.what()); }
    });

    CROW_ROUTE(app, "/api/validar").methods("POST"_method)([&](const crow::request& req) {
        try {
            const char* modo_txt = req.url_params.get("modo");
            const std::string modo_s = modo_txt ? modo_txt : "prediccion";
            if (modo_s != "prediccion" && modo_s != "entrenamiento")
                return error_resp(400, "modo debe ser 'prediccion' o 'entrenamiento'.");
            auto a = leer_archivo(req);
            verificar_extension(a.nombre);
            auto t = leer_csv(a.contenido);
            auto m = ctx.modelos.activo();
            return json_resp(200, validar_y_guardar(ctx, a, modo_s == "prediccion" ? Modo::Prediccion : Modo::Entrenamiento,
                                                    t, *m, nuevo_id()));
        } catch (const std::exception& e) { return error_resp(400, e.what()); }
    });

    CROW_ROUTE(app, "/api/predecir").methods("POST"_method)([&](const crow::request& req) {
        try {
            auto a = leer_archivo(req);
            verificar_extension(a.nombre);
            auto t = leer_csv(a.contenido);
            auto m = ctx.modelos.activo();
            const std::string id = nuevo_id();
            json val = validar_y_guardar(ctx, a, Modo::Prediccion, t, *m, id);
            if (val["estado"] == "incompatible")  // las predicciones solo se generan después de aprobar la validación
                return json_resp(409, {{"id", id}, {"estado", "incompatible"}, {"validacion", val},
                                       {"mensaje", "El archivo es incompatible: no se generaron predicciones. Revise el reporte de compatibilidad."}});

            auto pred = m->predecir(t);
            const int c_est = t.indice("estudiantes_ultimo"), c_tipo = t.indice("tipo_unidad");
            const std::vector<std::string> ident = {"codigo", "nombre", "tipo_unidad", "departamento_cod", "municipio_cod", "anio_objetivo"};
            json filas = json::array();
            for (size_t i = 0; i < t.filas.size(); ++i) {
                json f = {{"fila", i + 2}};
                for (const auto& c : ident) {
                    const int k = t.indice(c);
                    f[c] = k >= 0 ? json(recortar(t.celda(i, k))) : json(nullptr);
                }
                const double p = pred[i];
                const double mm = m->intervalo(recortar(t.celda(i, c_tipo)), a_numero(t.celda(i, c_est)).value_or(0));
                f["prediccion"] = redondear(p);
                f["mas_menos"] = std::isnan(mm) ? json(nullptr) : json(mm);
                f["desde"] = std::isnan(mm) ? json(nullptr) : json(redondear(p - mm));
                f["hasta"] = std::isnan(mm) ? json(nullptr) : json(redondear(p + mm));
                filas.push_back(std::move(f));
            }
            json resumen = resumen_predicciones(filas);
            resumen["modelo_version"] = m->version();
            resumen["cobertura_intervalo"] = m->metadata().value("cobertura_intervalo", 0.8);
            guardar_predicciones(ctx.carpeta_reporte(id), filas, resumen);
            json desc = val["descargas"];
            desc.update(descargas(id, {"predicciones.csv", "predicciones_resumen.json"}));
            return json_resp(200, {{"id", id}, {"estado", val["estado"]}, {"modelo_version", m->version()}, {"validacion", val},
                                   {"resumen", resumen}, {"predicciones", filas}, {"descargas", desc}});
        } catch (const std::exception& e) { return error_resp(400, e.what()); }
    });

    // Actualización controlada: nada se integra sin validar y la candidata nunca se activa sola
    CROW_ROUTE(app, "/api/actualizar").methods("POST"_method)([&](const crow::request& req) {
        try {
            auto a = leer_archivo(req);
            verificar_extension(a.nombre);
            auto t = leer_csv(a.contenido);
            auto m = ctx.modelos.activo();
            const std::string id = nuevo_id();
            const fs::path carpeta = ctx.carpeta_reporte(id);
            json val = validar_y_guardar(ctx, a, Modo::Entrenamiento, t, *m, id);
            if (val["estado"] == "incompatible")
                return json_resp(409, {{"id", id}, {"estado", "incompatible"}, {"validacion", val},
                                       {"mensaje", "Los datos no superaron la validación: no se integraron ni se entrenó una candidata."}});
            // EDA de los registros nuevos
            guardar_eda(carpeta, {{"id", id}, {"archivo", a.nombre}, {"fecha", ahora_iso()}, {"eda", analizar(t)}}, "eda_nuevos");
            // El lote validado se guarda tal cual llegó y Python lo integra en un conjunto nuevo
            const fs::path lote = ctx.shared / "data" / "lotes" / (id + ".csv");
            fs::create_directories(lote.parent_path());
            std::ofstream(lote, std::ios::binary) << a.contenido;
            json res = ctx.python.ejecutar("actualizar", {"--lote", lote.string(), "--salida", carpeta.string(), "--nombre", a.nombre}, carpeta / "python.log");
            // EDA del conjunto actualizado
            std::ifstream f(ctx.shared / res["conjunto_actualizado"]["archivo"].get<std::string>(), std::ios::binary);
            auto conjunto = leer_csv(std::string(std::istreambuf_iterator<char>(f), {}));
            guardar_eda(carpeta, {{"id", id}, {"archivo", res["conjunto_actualizado"]["archivo"]}, {"fecha", ahora_iso()},
                                  {"eda", analizar(conjunto)}}, "eda_conjunto");
            json desc = val["descargas"];
            desc.update(descargas(id, {"eda_nuevos.html", "eda_nuevos.json", "eda_conjunto.html", "eda_conjunto.json",
                                       "actualizacion.html", "actualizacion.json"}));
            return json_resp(200, {{"id", id}, {"estado", val["estado"]}, {"validacion", val}, {"actualizacion", res}, {"descargas", desc}});
        } catch (const std::exception& e) { return error_resp(400, e.what()); }
    });

    CROW_ROUTE(app, "/api/modelo/decision").methods("POST"_method)([&](const crow::request& req) {
        try {
            json s = json::parse(req.body, nullptr, false);
            if (s.is_discarded() || !s.contains("version") || !s.contains("accion"))
                return error_resp(400, "Envíe un JSON con version, accion (activar o rechazar) y justificacion.");
            const std::string id = nuevo_id();
            const fs::path carpeta = ctx.shared / "reportes" / "decisiones";
            fs::create_directories(carpeta);
            const fs::path solicitud = carpeta / (id + ".json");
            std::ofstream(solicitud) << json{{"version", s["version"]}, {"accion", s["accion"]},
                                             {"justificacion", s.value("justificacion", "")}, {"responsable", s.value("responsable", "")},
                                             {"fecha", ahora_iso()}}.dump(2);
            json reg = ctx.python.ejecutar("decidir", {"--solicitud", solicitud.string()}, carpeta / "python.log");
            json out = {{"registro", reg}};
            try { out["modelo_activo"] = ctx.modelos.activo()->version(); } catch (const std::exception&) {}
            return json_resp(200, out);
        } catch (const std::exception& e) { return error_resp(400, e.what()); }
    });

    CROW_ROUTE(app, "/api/reportes/<string>/<string>")([&](const std::string& id, const std::string& archivo) {
        static const std::regex id_ok("^[0-9]{8}-[0-9]{6}-[0-9a-f]{4}$");
        static const std::map<std::string, std::string> tipos = {
            {"compatibilidad.html", "text/html; charset=utf-8"}, {"compatibilidad.json", "application/json"},
            {"eda.html", "text/html; charset=utf-8"}, {"eda.json", "application/json"},
            {"eda_nuevos.html", "text/html; charset=utf-8"}, {"eda_nuevos.json", "application/json"},
            {"eda_conjunto.html", "text/html; charset=utf-8"}, {"eda_conjunto.json", "application/json"},
            {"actualizacion.html", "text/html; charset=utf-8"}, {"actualizacion.json", "application/json"},
            {"predicciones.csv", "text/csv; charset=utf-8"}, {"predicciones_resumen.json", "application/json"}};
        auto tipo = tipos.find(archivo);
        if (!std::regex_match(id, id_ok) || tipo == tipos.end()) return error_resp(404, "Reporte no encontrado.");
        std::ifstream f(ctx.carpeta_reporte(id) / archivo, std::ios::binary);
        if (!f) return error_resp(404, "Reporte no encontrado.");
        crow::response r(200, std::string(std::istreambuf_iterator<char>(f), {}));
        r.set_header("Content-Type", tipo->second);
        if (archivo.find(".html") == std::string::npos)
            r.set_header("Content-Disposition", "attachment; filename=\"" + id + "_" + archivo + "\"");
        return r;
    });

    // Interfaz web (opcional): archivos estáticos de Angular con respaldo a index.html
    if (!web.empty()) {
        const fs::path raiz = fs::weakly_canonical(fs::absolute(web));
        if (!fs::exists(raiz / "index.html")) {
            CROW_LOG_ERROR << "--web " << raiz << " no tiene index.html (¿compiló el frontend?)";
            return 1;
        }
        // Rutas normales "/" y "/<path>" (no el comodín de Crow, que es el manejador de 404 y descarta el cuerpo).
        // Las rutas de /api son más específicas y tienen prioridad.
        auto servir = [raiz](const std::string& ruta) {
            static const std::map<std::string, std::string> mime = {
                {".html", "text/html; charset=utf-8"}, {".js", "text/javascript"}, {".css", "text/css"},
                {".json", "application/json"}, {".webmanifest", "application/manifest+json"}, {".svg", "image/svg+xml"},
                {".ico", "image/x-icon"}, {".png", "image/png"}, {".woff2", "font/woff2"}, {".csv", "text/csv; charset=utf-8"},
                {".txt", "text/plain; charset=utf-8"}};
            if (ruta.rfind("api/", 0) == 0 || ruta == "api") return error_resp(404, "Ruta de la API no encontrada.");
            // Ruta pedida dentro de la carpeta web; cualquier intento de salir de ella (..) sirve index.html
            fs::path archivo = fs::weakly_canonical(raiz / ruta);
            const bool dentro = archivo.string().rfind(raiz.string() + "/", 0) == 0;
            if (!dentro || !fs::is_regular_file(archivo)) archivo = raiz / "index.html";
            std::ifstream f(archivo, std::ios::binary);
            crow::response r(200, std::string(std::istreambuf_iterator<char>(f), {}));
            auto m = mime.find(archivo.extension().string());
            r.set_header("Content-Type", m != mime.end() ? m->second : "application/octet-stream");
            // Los archivos con hash en el nombre no cambian nunca; index.html y el service worker, siempre frescos
            const std::string nombre = archivo.filename().string();
            const bool inmutable = nombre.find('-') != std::string::npos && (archivo.extension() == ".js" || archivo.extension() == ".css");
            r.set_header("Cache-Control", inmutable ? "public, max-age=31536000, immutable" : "no-cache");
            return r;
        };
        CROW_ROUTE(app, "/")([servir] { return servir(""); });
        CROW_ROUTE(app, "/<path>")([servir](const std::string& ruta) { return servir(ruta); });
        CROW_LOG_INFO << "web: " << raiz;
    }

    CROW_LOG_INFO << "shared: " << ctx.shared << "  " << host << ":" << puerto;
    app.bindaddr(host).port(puerto).multithreaded().run();
}
