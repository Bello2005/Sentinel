#include "validador.h"

#include <algorithm>
#include <cmath>
#include <map>
#include <regex>
#include <set>

namespace {

constexpr size_t MAX_EJEMPLOS = 20;

// Acumula las filas que incumplen una misma condición, para reportarlas como un solo problema
struct Acumulador {
    size_t total = 0;
    std::vector<size_t> ejemplos;
    std::string primer_valor;
    void agregar(size_t i, const std::string& valor) {
        if (total == 0) primer_valor = valor;
        ++total;
        if (ejemplos.size() < MAX_EJEMPLOS) ejemplos.push_back(i + 2);  // +1 por el encabezado, +1 porque empieza en 1
    }
};

std::string tipo_detectado(const Tabla& t, int col) {
    // Lo que "parece" la columna, para explicar al usuario qué se recibió
    size_t enteros = 0, numeros = 0, no_vacios = 0;
    for (size_t i = 0; i < t.filas.size(); ++i) {
        const auto& v = t.celda(i, col);
        if (recortar(v).empty()) continue;
        ++no_vacios;
        if (auto n = a_numero(v)) {
            ++numeros;
            if (std::floor(*n) == *n) ++enteros;
        }
    }
    if (no_vacios == 0) return "vacía";
    if (numeros < no_vacios) return numeros == 0 ? "texto" : "mixto (números y texto)";
    return enteros == numeros ? "entero" : "numerico";
}

std::string formato_rango(const json& v) {
    std::string r = "entre " + v["min"].dump() + " y " + v["max"].dump();
    if (v.contains("unidad")) r += " (" + v["unidad"].get<std::string>() + ")";
    return r;
}

}  // namespace

size_t ReporteValidacion::errores() const {
    return std::count_if(problemas.begin(), problemas.end(), [](const Problema& p) { return p.nivel == "error"; });
}
size_t ReporteValidacion::advertencias() const { return problemas.size() - errores(); }

json ReporteValidacion::a_json() const {
    json ps = json::array();
    for (const auto& p : problemas)
        ps.push_back({{"nivel", p.nivel}, {"categoria", p.categoria}, {"variable", p.variable}, {"mensaje", p.mensaje},
                      {"esperado", p.esperado}, {"encontrado", p.encontrado}, {"filas_afectadas", p.filas_afectadas},
                      {"ejemplo_filas", p.ejemplo_filas}});
    size_t invalidas = std::count(filas_invalidas.begin(), filas_invalidas.end(), true);
    return {{"estado", estado},
            {"modo", modo == Modo::Prediccion ? "prediccion" : "entrenamiento"},
            {"filas", filas},
            {"filas_con_errores", invalidas},
            {"columnas", {{"recibidas", recibidas}, {"esperadas", esperadas}, {"faltantes", faltantes}, {"adicionales", adicionales}}},
            {"tipos", tipos},
            {"resumen", {{"errores", errores()}, {"advertencias", advertencias()}}},
            {"problemas", ps}};
}

ReporteValidacion validar(const Tabla& t, const json& reglas, const json& metadata, Modo modo) {
    ReporteValidacion r;
    r.modo = modo;
    r.filas = t.filas.size();
    r.recibidas = t.columnas;
    r.filas_invalidas.assign(t.filas.size(), false);
    auto agregar = [&](Problema p, const Acumulador* acc = nullptr) {
        if (acc) {
            p.filas_afectadas = acc->total;
            p.ejemplo_filas = acc->ejemplos;
        }
        r.problemas.push_back(std::move(p));
    };
    auto marcar = [&](size_t i, bool es_error) {
        if (es_error) r.filas_invalidas[i] = true;
    };

    const auto& objetivo = reglas["objetivo"];
    const std::string nombre_objetivo = objetivo["nombre"];

    // Variables que se validan: las de las reglas + el objetivo (con su propia definición)
    std::vector<json> variables(reglas["variables"].begin(), reglas["variables"].end());
    json var_objetivo = objetivo;
    var_objetivo["rol"] = "objetivo";
    var_objetivo["admite_nulos"] = false;
    var_objetivo["obligatoria"] = modo == Modo::Entrenamiento;
    variables.push_back(var_objetivo);

    // --- 1. Esquema --------------------------------------------------------------------------------------------
    std::set<std::string> conocidas;
    for (const auto& v : variables) {
        const std::string nom = v["nombre"];
        conocidas.insert(nom);
        const bool obligatoria = v.value("obligatoria", true);
        if (obligatoria) r.esperadas.push_back(nom);
        if (t.indice(nom) < 0 && obligatoria) {
            r.faltantes.push_back(nom);
            agregar({"error", "esquema", nom,
                     v["rol"] == "objetivo" ? "Falta la variable objetivo: sin el valor real no se puede usar para actualizar el modelo."
                                            : "Falta una columna obligatoria (" + v["rol"].get<std::string>() + ").",
                     "columna '" + nom + "'", "no está en el archivo"});
        }
    }
    std::set<std::string> vistas;
    for (const auto& c : t.columnas) {
        if (!vistas.insert(c).second)
            agregar({"error", "esquema", c, "La columna aparece más de una vez.", "nombres únicos", "repetida"});
        if (!conocidas.count(c)) {
            r.adicionales.push_back(c);
            agregar({"advertencia", "esquema", c, "Columna adicional: el modelo no la usa y se ignora.", "", "columna no definida"});
        }
    }
    if (modo == Modo::Prediccion && t.indice(nombre_objetivo) >= 0)
        agregar({"advertencia", "esquema", nombre_objetivo,
                 "El archivo trae la variable objetivo; para predecir no se usa y se ignora.", "", "columna presente"});
    if (t.filas.empty())
        agregar({"error", "contenido", "", "El archivo no tiene filas de datos.", "al menos 1 fila", "0 filas"});

    // --- 2. Tipo, 3. contenido y 4. dominio, variable por variable --------------------------------------------------
    const json categorias = metadata.value("categorias_validas", json::object());
    for (const auto& v : variables) {
        const std::string nom = v["nombre"], tipo = v["tipo"];
        const int col = t.indice(nom);
        if (col < 0) continue;
        if (modo == Modo::Prediccion && nom == nombre_objetivo) continue;  // se ignora al predecir
        r.tipos.push_back({{"variable", nom}, {"esperado", tipo}, {"detectado", tipo_detectado(t, col)}});

        const bool admite_nulos = v.value("admite_nulos", false);
        const bool numerica = tipo == "entero" || tipo == "numerico";
        std::optional<std::regex> patron;
        if (v.contains("patron")) patron = std::regex(v["patron"].get<std::string>());
        std::set<std::string> validas;
        if (tipo == "categorica" && categorias.contains(nom))
            for (const auto& c : categorias[nom]) validas.insert(c.get<std::string>());

        Acumulador nulos, mal_tipo, fuera_rango, mal_patron, desconocidas;
        std::set<std::string> valores_desconocidos;
        for (size_t i = 0; i < t.filas.size(); ++i) {
            const std::string valor = recortar(t.celda(i, col));
            if (valor.empty()) {
                if (!admite_nulos) nulos.agregar(i, valor), marcar(i, true);
                continue;
            }
            if (numerica) {
                auto n = a_numero(valor);
                if (!n || (tipo == "entero" && std::floor(*n) != *n)) {
                    mal_tipo.agregar(i, valor), marcar(i, true);
                    continue;
                }
                if ((v.contains("min") && *n < v["min"].get<double>()) || (v.contains("max") && *n > v["max"].get<double>()))
                    fuera_rango.agregar(i, valor), marcar(i, true);
            } else if (patron && !std::regex_match(valor, *patron)) {
                mal_patron.agregar(i, valor), marcar(i, true);
            } else if (tipo == "categorica" && !validas.empty() && !validas.count(valor)) {
                const bool rechazar = v.value("desconocidas", "rechazar") == "rechazar";
                desconocidas.agregar(i, valor), marcar(i, rechazar);
                valores_desconocidos.insert(valor);
            }
        }
        if (nulos.total)
            agregar({"error", "contenido", nom, "Valores vacíos en una variable que no los admite. El sistema no los rellena: complete o quite esas filas.",
                     "sin vacíos", std::to_string(nulos.total) + " vacíos"}, &nulos);
        if (mal_tipo.total)
            agregar({"error", "tipo", nom, "Hay valores que no son del tipo esperado.", tipo,
                     tipo_detectado(t, col) + " (ejemplo: '" + mal_tipo.primer_valor + "')"}, &mal_tipo);
        if (fuera_rango.total)
            agregar({"error", "dominio", nom, "Valores fuera del rango válido.", formato_rango(v),
                     "ejemplo: " + fuera_rango.primer_valor}, &fuera_rango);
        if (mal_patron.total)
            agregar({"error", "contenido", nom, "Formato no válido. " + v.value("descripcion", std::string()),
                     "patrón " + v["patron"].get<std::string>(), "ejemplo: '" + mal_patron.primer_valor + "'"}, &mal_patron);
        if (desconocidas.total) {
            std::string lista, permitidas;
            for (const auto& c : valores_desconocidos) lista += (lista.empty() ? "" : ", ") + c;
            for (const auto& c : validas) permitidas += (permitidas.empty() ? "" : ", ") + c;
            const bool rechazar = v.value("desconocidas", "rechazar") == "rechazar";
            agregar({rechazar ? "error" : "advertencia", "contenido", nom,
                     "Categoría no vista durante el entrenamiento.", permitidas, lista}, &desconocidas);
        }
    }

    // --- 5. Reglas cruzadas (definidas por id en reglas_dominio.json) -------------------------------------------
    auto num = [&](size_t i, const std::string& c) { return a_numero(t.celda(i, t.indice(c))); };
    auto txt = [&](size_t i, const std::string& c) { return recortar(t.celda(i, t.indice(c))); };
    auto tiene = [&](std::initializer_list<const char*> cols) {
        return std::all_of(cols.begin(), cols.end(), [&](const char* c) { return t.indice(c) >= 0; });
    };
    for (const auto& regla : reglas.value("reglas_cruzadas", json::array())) {
        const std::string id = regla["id"], nivel = regla["nivel"] == "error" ? "error" : "advertencia";
        const std::string mensaje = regla.value("mensaje", "Regla incumplida: " + regla["regla"].get<std::string>());
        Acumulador acc;
        std::string variable;
        if (id == "gap_consistente" && tiene({"anios_desde_ultimo", "anio_objetivo", "anio_ultimo"})) {
            variable = "anios_desde_ultimo";
            for (size_t i = 0; i < t.filas.size(); ++i) {
                auto g = num(i, "anios_desde_ultimo"), o = num(i, "anio_objetivo"), u = num(i, "anio_ultimo");
                if (g && o && u && *g != *o - *u) acc.agregar(i, txt(i, "anios_desde_ultimo")), marcar(i, nivel == "error");
            }
        } else if (id == "codigo_segun_tipo" && tiene({"codigo", "tipo_unidad"})) {
            variable = "codigo";
            for (size_t i = 0; i < t.filas.size(); ++i) {
                const auto c = txt(i, "codigo"), tu = txt(i, "tipo_unidad");
                if ((tu == "municipio" && c.size() != 5) || (tu == "colegio" && c.size() != 12))
                    acc.agregar(i, c), marcar(i, nivel == "error");
            }
        } else if (id == "sin_duplicados" && tiene({"tipo_unidad", "codigo", "anio_objetivo"})) {
            variable = "codigo";
            std::map<std::string, size_t> vistos;
            for (size_t i = 0; i < t.filas.size(); ++i) {
                const auto clave = txt(i, "tipo_unidad") + "|" + txt(i, "codigo") + "|" + txt(i, "anio_objetivo");
                if (!vistos.emplace(clave, i).second) acc.agregar(i, txt(i, "codigo")), marcar(i, nivel == "error");
            }
        } else if (id == "pocos_estudiantes" && tiene({"estudiantes_ultimo"})) {
            variable = "estudiantes_ultimo";
            for (size_t i = 0; i < t.filas.size(); ++i)
                if (auto n = num(i, "estudiantes_ultimo"); n && *n < 10) acc.agregar(i, txt(i, "estudiantes_ultimo"));
        } else {
            continue;  // objetivo_en_prediccion se revisa en el esquema; ids desconocidos se ignoran
        }
        if (acc.total)
            agregar({nivel, "regla", variable, mensaje, regla["regla"], "ejemplo: " + acc.primer_valor}, &acc);
    }

    r.estado = r.errores() ? "incompatible" : r.advertencias() ? "compatible_con_advertencias" : "compatible";
    return r;
}
