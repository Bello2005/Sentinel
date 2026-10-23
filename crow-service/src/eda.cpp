#include "eda.h"

#include <algorithm>
#include <cmath>
#include <iomanip>
#include <map>
#include <numeric>
#include <regex>
#include <set>
#include <sstream>
#include <unordered_map>

namespace {

constexpr double UMBRAL_NUMERICA = 0.95;
constexpr size_t MAX_CATEGORIAS = 50;
constexpr size_t MAX_BARRAS = 20;
constexpr size_t MAX_DISCRETA = 10;
constexpr double R_RELEVANTE = 0.3, ETA2_RELEVANTE = 0.06;
constexpr size_t MAX_PUNTOS = 400, MAX_PARES_DISPERSION = 3, MAX_EJEMPLOS = 20;

double red(double x, int dec = 3) {
    if (!std::isfinite(x)) return x;
    const double f = std::pow(10.0, dec);
    return std::round(x * f) / f;
}

std::string minusculas(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(), ::tolower);
    return s;
}

std::string fmt(double x, int dec = 1) {
    std::ostringstream o;
    o << std::fixed << std::setprecision(dec) << x;
    std::string s = o.str();
    for (auto& c : s) if (c == '.') c = ',';
    return s;
}

// Cuantil con interpolación lineal (el mismo de pandas por defecto). v debe estar ordenado.
double cuantil(const std::vector<double>& v, double q) {
    if (v.empty()) return NAN;
    const double pos = q * (v.size() - 1);
    const size_t i = static_cast<size_t>(std::floor(pos));
    const double f = pos - i;
    return i + 1 < v.size() ? v[i] * (1 - f) + v[i + 1] * f : v[i];
}

struct Columna {
    std::string nombre, tipo;
    std::vector<std::string> valores;           // recortados
    std::vector<std::optional<double>> numeros;  // a_numero de cada valor
    size_t vacios = 0, no_vacios = 0, numericos = 0, distintos = 0;
    bool enteros = true;
};

std::string clasificar(Columna& c, size_t filas) {
    const std::string n = minusculas(c.nombre);
    if (c.no_vacios == 0) return "vacia";
    const bool nombre_id = n == "id" || n == "codigo" || n.rfind("cod_", 0) == 0 || n.rfind("id_", 0) == 0 ||
                           (n.size() > 4 && (n.substr(n.size() - 4) == "_cod" || n.substr(n.size() - 3) == "_id"));
    if (nombre_id) return "identificador";
    const bool numerica = c.numericos >= UMBRAL_NUMERICA * c.no_vacios;
    if (numerica) {
        const bool nombre_tiempo = n.find("anio") != std::string::npos || n.find("año") != std::string::npos ||
                                   n.find("fecha") != std::string::npos || n.find("year") != std::string::npos;
        bool rango_anio = c.enteros;
        for (const auto& x : c.numeros)
            if (x && (*x < 1990 || *x > 2100)) rango_anio = false;
        if (nombre_tiempo && rango_anio) return "temporal";
        if (c.enteros && c.distintos <= MAX_DISCRETA) return "discreta";
        return "numerica";
    }
    static const std::regex fecha(R"(^\d{4}-\d{2}-\d{2}.*$)");
    size_t fechas = 0;
    for (const auto& v : c.valores)
        if (!v.empty() && std::regex_match(v, fecha)) ++fechas;
    if (fechas >= UMBRAL_NUMERICA * c.no_vacios) return "temporal";
    if (c.distintos == c.no_vacios && filas > 20) return "identificador";
    if (c.distintos <= MAX_CATEGORIAS || c.distintos <= 0.05 * filas) return "categorica";
    return "texto";
}

json frecuencias(const Columna& c, size_t limite) {
    std::map<std::string, size_t> cuenta;
    for (const auto& v : c.valores)
        if (!v.empty()) ++cuenta[v];
    std::vector<std::pair<std::string, size_t>> orden(cuenta.begin(), cuenta.end());
    std::stable_sort(orden.begin(), orden.end(), [](auto& a, auto& b) { return a.second > b.second; });
    json f = json::array();
    size_t otras = 0;
    for (size_t i = 0; i < orden.size(); ++i) {
        if (i < limite)
            f.push_back({{"valor", orden[i].first}, {"conteo", orden[i].second},
                         {"proporcion", red(double(orden[i].second) / c.no_vacios, 4)}});
        else
            otras += orden[i].second;
    }
    if (otras) f.push_back({{"valor", "(otras " + std::to_string(orden.size() - limite) + ")"}, {"conteo", otras},
                            {"proporcion", red(double(otras) / c.no_vacios, 4)}});
    return f;
}

json numericas(const Columna& c, std::vector<std::string>& obs) {
    std::vector<double> v;
    std::vector<size_t> fila;
    for (size_t i = 0; i < c.numeros.size(); ++i)
        if (c.numeros[i]) v.push_back(*c.numeros[i]), fila.push_back(i);
    std::vector<double> s = v;
    std::sort(s.begin(), s.end());
    const double n = v.size();
    const double media = std::accumulate(v.begin(), v.end(), 0.0) / n;
    double m2 = 0, m3 = 0;
    for (double x : v) m2 += (x - media) * (x - media), m3 += std::pow(x - media, 3);
    const double desv = n > 1 ? std::sqrt(m2 / (n - 1)) : 0;
    const double asim = m2 > 0 ? (m3 / n) / std::pow(m2 / n, 1.5) : 0;
    const double q1 = cuantil(s, .25), med = cuantil(s, .5), q3 = cuantil(s, .75), ric = q3 - q1;
    const double li = q1 - 1.5 * ric, ls = q3 + 1.5 * ric;

    // Con RIC = 0 (variable casi constante) o discreta, Tukey marcaría como atípico todo lo que no sea el valor
    // más común: no se aplica y se dice por qué
    const bool aplica_tukey = ric > 0 && c.tipo != "discreta";
    json atip = json::array();
    std::vector<size_t> filas_atip;
    double bigote_min = s.back(), bigote_max = s.front();
    for (size_t k = 0; k < v.size(); ++k) {
        if (aplica_tukey && (v[k] < li || v[k] > ls)) {
            if (filas_atip.size() < MAX_EJEMPLOS) atip.push_back(red(v[k], 2));
            filas_atip.push_back(fila[k] + 2);
        } else {
            bigote_min = std::min(bigote_min, v[k]);
            bigote_max = std::max(bigote_max, v[k]);
        }
    }
    // Histograma con la regla de Sturges (entre 5 y 30 barras)
    json hist = {{"bordes", json::array()}, {"conteos", json::array()}};
    const size_t k = std::clamp<size_t>(static_cast<size_t>(std::ceil(std::log2(n) + 1)), 5, 30);
    if (s.front() == s.back()) {
        hist["bordes"] = {red(s.front()), red(s.front())};
        hist["conteos"] = {v.size()};
    } else {
        const double ancho = (s.back() - s.front()) / k;
        std::vector<size_t> cont(k, 0);
        for (double x : v) cont[std::min(k - 1, static_cast<size_t>((x - s.front()) / ancho))]++;
        for (size_t b = 0; b <= k; ++b) hist["bordes"].push_back(red(s.front() + b * ancho));
        hist["conteos"] = cont;
    }
    if (!filas_atip.empty())
        obs.push_back(c.nombre + ": " + std::to_string(filas_atip.size()) + " posibles atípicos (" +
                      fmt(100.0 * filas_atip.size() / n) + " %) fuera de [" + fmt(li, 2) + ", " + fmt(ls, 2) + "].");
    if (std::abs(asim) >= 1)
        obs.push_back(c.nombre + ": distribución " + (asim > 0 ? "sesgada a la derecha" : "sesgada a la izquierda") +
                      " (asimetría " + fmt(asim, 2) + ").");
    std::vector<size_t> ej(filas_atip.begin(), filas_atip.begin() + std::min(filas_atip.size(), MAX_EJEMPLOS));
    return {{"n", v.size()}, {"media", red(media)}, {"desviacion", red(desv)}, {"minimo", red(s.front())},
            {"q1", red(q1)}, {"mediana", red(med)}, {"q3", red(q3)}, {"maximo", red(s.back())}, {"asimetria", red(asim)},
            {"valores_no_numericos", c.no_vacios - c.numericos},
            {"atipicos", {{"criterio", aplica_tukey ? "Tukey 1,5·RIC" : c.tipo == "discreta" ? "no se aplica: variable discreta (ver frecuencias)"
                                                                                                : "no se aplica: RIC = 0 (la mayoría de valores son iguales)"},
                          {"limite_inferior", aplica_tukey ? json(red(li)) : json(nullptr)},
                          {"limite_superior", aplica_tukey ? json(red(ls)) : json(nullptr)},
                          {"cantidad", filas_atip.size()}, {"proporcion", red(filas_atip.size() / n, 4)},
                          {"ejemplos", atip}, {"ejemplo_filas", ej}}},
            {"histograma", hist},
            {"caja", {{"min", red(bigote_min)}, {"q1", red(q1)}, {"mediana", red(med)}, {"q3", red(q3)}, {"max", red(bigote_max)}}}};
}

}  // namespace

json analizar(const Tabla& t) {
    const size_t filas = t.filas.size();
    std::vector<Columna> cols(t.columnas.size());
    for (size_t j = 0; j < cols.size(); ++j) {
        auto& c = cols[j];
        c.nombre = t.columnas[j];
        std::set<std::string> distintos;
        for (size_t i = 0; i < filas; ++i) {
            c.valores.push_back(recortar(t.celda(i, j)));
            const auto& v = c.valores.back();
            c.numeros.push_back(a_numero(v));
            if (v.empty()) { ++c.vacios; continue; }
            ++c.no_vacios;
            distintos.insert(v);
            if (c.numeros.back()) {
                ++c.numericos;
                if (std::floor(*c.numeros.back()) != *c.numeros.back()) c.enteros = false;
            }
        }
        c.distintos = distintos.size();
        c.tipo = clasificar(c, filas);
    }

    std::vector<std::string> obs;
    json variables = json::array(), graficas = json::array();
    size_t vacios_total = 0;
    for (auto& c : cols) {
        vacios_total += c.vacios;
        json v = {{"nombre", c.nombre}, {"tipo", c.tipo}, {"no_vacios", c.no_vacios}, {"vacios", c.vacios},
                  {"proporcion_vacios", filas ? red(double(c.vacios) / filas, 4) : 0}, {"distintos", c.distintos}};
        if (c.vacios)
            obs.push_back(c.nombre + ": " + std::to_string(c.vacios) + " valores vacíos (" + fmt(100.0 * c.vacios / filas) + " %).");
        if (c.tipo == "numerica" || c.tipo == "discreta") {
            v["estadisticas"] = numericas(c, obs);
            if (c.no_vacios > c.numericos)
                obs.push_back(c.nombre + ": " + std::to_string(c.no_vacios - c.numericos) + " valores no numéricos en una columna numérica.");
            if (c.tipo == "discreta") {
                v["frecuencias"] = frecuencias(c, MAX_BARRAS);
                graficas.push_back({{"tipo", "barras"}, {"variable", c.nombre}, {"titulo", "Frecuencia de " + c.nombre}});
            } else {
                graficas.push_back({{"tipo", "histograma"}, {"variable", c.nombre}, {"titulo", "Distribución de " + c.nombre}});
                graficas.push_back({{"tipo", "caja"}, {"variable", c.nombre}, {"titulo", "Caja y atípicos de " + c.nombre}});
            }
        } else if (c.tipo == "categorica") {
            v["frecuencias"] = frecuencias(c, MAX_BARRAS);
            graficas.push_back({{"tipo", "barras"}, {"variable", c.nombre}, {"titulo", "Frecuencia de " + c.nombre}});
        } else if (c.tipo == "temporal") {
            v["frecuencias"] = frecuencias(c, 200);
            std::sort(v["frecuencias"].begin(), v["frecuencias"].end(),
                      [](const json& a, const json& b) { return a["valor"].get<std::string>() < b["valor"].get<std::string>(); });
            graficas.push_back({{"tipo", "linea"}, {"variable", c.nombre}, {"titulo", "Registros por " + c.nombre}});
        } else if (c.tipo == "identificador" || c.tipo == "texto") {
            size_t lmin = SIZE_MAX, lmax = 0;
            json ej = json::array();
            for (const auto& x : c.valores) {
                if (x.empty()) continue;
                lmin = std::min(lmin, x.size()), lmax = std::max(lmax, x.size());
                if (ej.size() < 5) ej.push_back(x);
            }
            v["texto"] = {{"longitud_min", lmin == SIZE_MAX ? 0 : lmin}, {"longitud_max", lmax}, {"ejemplos", ej},
                          {"repetidos", c.no_vacios - c.distintos}};
        }
        variables.push_back(std::move(v));
    }

    // Filas duplicadas (exactas)
    std::unordered_map<std::string, size_t> vistas;
    size_t dup = 0;
    json dup_filas = json::array();
    for (size_t i = 0; i < filas; ++i) {
        std::string clave;
        for (const auto& c : cols) clave += c.valores[i] + '\x1f';
        if (!vistas.emplace(clave, i).second) {
            ++dup;
            if (dup_filas.size() < MAX_EJEMPLOS) dup_filas.push_back({{"fila", i + 2}, {"igual_a", vistas[clave] + 2}});
        }
    }
    if (dup) obs.push_back(std::to_string(dup) + " filas duplicadas exactas.");

    // Correlaciones de Pearson entre numéricas (pares completos)
    std::vector<const Columna*> num;
    for (const auto& c : cols)
        if (c.tipo == "numerica" || c.tipo == "discreta") num.push_back(&c);
    json corr = {{"variables", json::array()}, {"matriz", json::array()}};
    std::vector<std::tuple<double, size_t, size_t>> pares;
    for (auto* c : num) corr["variables"].push_back(c->nombre);
    for (size_t a = 0; a < num.size(); ++a) {
        json filaM = json::array();
        for (size_t b = 0; b < num.size(); ++b) {
            if (a == b) { filaM.push_back(1.0); continue; }
            double sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
            size_t n = 0;
            for (size_t i = 0; i < filas; ++i) {
                auto x = num[a]->numeros[i], y = num[b]->numeros[i];
                if (!x || !y) continue;
                ++n, sx += *x, sy += *y, sxx += *x * *x, syy += *y * *y, sxy += *x * *y;
            }
            const double den = std::sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
            const double r = n > 2 && den > 0 ? (n * sxy - sx * sy) / den : NAN;
            filaM.push_back(std::isfinite(r) ? json(red(r)) : json(nullptr));
            if (a < b && std::isfinite(r)) pares.emplace_back(std::abs(r), a, b);
        }
        corr["matriz"].push_back(filaM);
    }
    std::sort(pares.rbegin(), pares.rend());
    json relaciones = json::array();
    for (auto& [ar, a, b] : pares) {
        if (ar < R_RELEVANTE) break;
        const double r = corr["matriz"][a][b];
        relaciones.push_back({{"tipo", "correlacion"}, {"variables", {num[a]->nombre, num[b]->nombre}}, {"valor", r},
                              {"descripcion", std::string(ar >= 0.7 ? "Asociación lineal fuerte" : ar >= 0.5 ? "Asociación lineal moderada" : "Asociación lineal débil") +
                                                  (r > 0 ? " y positiva" : " y negativa") + " (r = " + fmt(r, 2) + ")."}});
    }
    if (num.size() >= 2) graficas.push_back({{"tipo", "correlaciones"}, {"titulo", "Correlaciones entre variables numéricas"}});

    // Dispersión de los pares más asociados (muestra sistemática de hasta MAX_PUNTOS puntos)
    json dispersion = json::array();
    for (size_t p = 0; p < std::min(pares.size(), MAX_PARES_DISPERSION); ++p) {
        auto [ar, a, b] = pares[p];
        if (ar < R_RELEVANTE) break;
        json pts = json::array();
        const size_t paso = std::max<size_t>(1, filas / MAX_PUNTOS);
        for (size_t i = 0; i < filas; i += paso) {
            auto x = num[a]->numeros[i], y = num[b]->numeros[i];
            if (x && y) pts.push_back({red(*x, 2), red(*y, 2)});
        }
        dispersion.push_back({{"x", num[a]->nombre}, {"y", num[b]->nombre}, {"puntos", pts}});
        graficas.push_back({{"tipo", "dispersion"}, {"x", num[a]->nombre}, {"y", num[b]->nombre},
                            {"titulo", num[b]->nombre + " frente a " + num[a]->nombre}});
    }

    // Categóricas frente a numéricas: eta² (proporción de la variación explicada por las categorías)
    for (const auto& cat : cols) {
        if (cat.tipo != "categorica" || cat.distintos > 12 || cat.distintos < 2) continue;
        for (auto* nc : num) {
            std::map<std::string, std::pair<double, size_t>> grupos;
            double total = 0;
            size_t n = 0;
            for (size_t i = 0; i < filas; ++i) {
                auto y = nc->numeros[i];
                if (!y || cat.valores[i].empty()) continue;
                auto& g = grupos[cat.valores[i]];
                g.first += *y, ++g.second, total += *y, ++n;
            }
            if (n < 3) continue;
            const double media = total / n;
            double ssb = 0, sst = 0;
            for (auto& [k, g] : grupos) ssb += g.second * std::pow(g.first / g.second - media, 2);
            for (size_t i = 0; i < filas; ++i)
                if (nc->numeros[i] && !cat.valores[i].empty()) sst += std::pow(*nc->numeros[i] - media, 2);
            const double eta2 = sst > 0 ? ssb / sst : 0;
            if (eta2 < ETA2_RELEVANTE) continue;
            json medias = json::object();
            for (auto& [k, g] : grupos) medias[k] = red(g.first / g.second, 2);
            relaciones.push_back({{"tipo", "eta2"}, {"variables", {cat.nombre, nc->nombre}}, {"valor", red(eta2)},
                                  {"medias_por_categoria", medias},
                                  {"descripcion", cat.nombre + " explica el " + fmt(100 * eta2) + " % de la variación de " + nc->nombre + "."}});
        }
    }
    for (const auto& r : relaciones) obs.push_back(r["variables"][0].get<std::string>() + " y " + r["variables"][1].get<std::string>() +
                                                   ": " + r["descripcion"].get<std::string>() + " No implica causalidad.");

    std::map<std::string, size_t> por_tipo;
    for (const auto& c : cols) ++por_tipo[c.tipo];
    return {{"general", {{"filas", filas}, {"columnas", cols.size()}, {"celdas_vacias", vacios_total},
                         {"proporcion_vacias", filas && !cols.empty() ? red(double(vacios_total) / (filas * cols.size()), 4) : 0},
                         {"filas_duplicadas", dup}, {"ejemplo_duplicadas", dup_filas}, {"variables_por_tipo", por_tipo}}},
            {"variables", variables},
            {"correlaciones", corr},
            {"dispersion", dispersion},
            {"relaciones", relaciones},
            {"graficas", graficas},
            {"observaciones", obs},
            {"criterios", {{"numerica", "al menos 95 % de los valores no vacíos son números"},
                           {"discreta", "numérica entera con 10 valores distintos o menos"},
                           {"temporal", "años (1990-2100) en columnas anio/año/fecha, o fechas AAAA-MM-DD"},
                           {"identificador", "nombre codigo/id/*_cod/*_id, o un valor distinto por fila"},
                           {"categorica", "texto con 50 valores distintos o menos (o < 5 % de las filas)"},
                           {"atipicos", "regla de Tukey: fuera de [Q1 - 1,5·RIC, Q3 + 1,5·RIC]"},
                           {"relaciones", "Pearson |r| >= 0,3 entre numéricas; eta² >= 0,06 entre categórica y numérica. Asociación, no causalidad."}}}};
}
