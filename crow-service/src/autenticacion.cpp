#include "autenticacion.h"

#include <fstream>
#include <nlohmann/json.hpp>

#include "cripto.h"

using json = nlohmann::json;
using reloj = std::chrono::steady_clock;

namespace {
constexpr int MAX_FALLOS = 5;
constexpr auto VENTANA = std::chrono::minutes(15);
// Clave ficticia para gastar el mismo tiempo cuando el usuario no existe (no revela qué usuarios hay)
const std::string HASH_FICTICIO = "pbkdf2_sha256$210000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
}  // namespace

Sesiones::Sesiones(std::filesystem::path archivo) : archivo_(std::move(archivo)) {}

size_t Sesiones::usuarios_registrados() const {
    std::ifstream f(archivo_);
    if (!f) return 0;
    try { return json::parse(f).value("usuarios", json::array()).size(); } catch (...) { return 0; }
}

std::optional<std::string> Sesiones::iniciar(const std::string& usuario, const std::string& clave, Usuario& salida) {
    // Se relee el archivo en cada intento: crear o borrar usuarios no exige reiniciar el servidor
    json datos = json::object();
    if (std::ifstream f(archivo_); f) {
        try { datos = json::parse(f); } catch (...) {}
    }
    // Se recorre el arreglo dentro de `datos` (no una copia): `encontrado` apunta a un elemento que sigue vivo
    const json* encontrado = nullptr;
    if (datos.contains("usuarios") && datos["usuarios"].is_array())
        for (const auto& u : datos["usuarios"])
            if (u.is_object() && u.value("usuario", "") == usuario) encontrado = &u;
    const bool ok = cripto::verificar_clave(clave, encontrado ? encontrado->value("hash", "") : HASH_FICTICIO);
    if (!encontrado || !ok) return std::nullopt;
    salida = {usuario, encontrado->value("nombre", usuario)};
    const std::string token = cripto::hex(cripto::aleatorio(32));
    std::lock_guard<std::mutex> lock(mutex_);
    sesiones_[token] = {salida, reloj::now() + DURACION};
    // Limpieza de sesiones vencidas
    for (auto it = sesiones_.begin(); it != sesiones_.end();) it = it->second.expira < reloj::now() ? sesiones_.erase(it) : std::next(it);
    return token;
}

std::optional<Usuario> Sesiones::validar(const std::string& token) {
    if (token.size() != 64) return std::nullopt;
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = sesiones_.find(token);
    if (it == sesiones_.end()) return std::nullopt;
    if (it->second.expira < reloj::now()) { sesiones_.erase(it); return std::nullopt; }
    return it->second.usuario;
}

void Sesiones::cerrar(const std::string& token) {
    std::lock_guard<std::mutex> lock(mutex_);
    sesiones_.erase(token);
}

bool Sesiones::permitido(const std::string& ip, int& espera) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = intentos_.find(ip);
    if (it == intentos_.end()) return true;
    const auto pasado = reloj::now() - it->second.desde;
    if (pasado > VENTANA) { intentos_.erase(it); return true; }
    if (it->second.fallos < MAX_FALLOS) return true;
    espera = int(std::chrono::duration_cast<std::chrono::seconds>(VENTANA - pasado).count());
    return false;
}

void Sesiones::registrar_fallo(const std::string& ip) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto& i = intentos_[ip];
    if (i.fallos == 0 || reloj::now() - i.desde > VENTANA) i = {0, reloj::now()};
    ++i.fallos;
}

void Sesiones::limpiar_fallos(const std::string& ip) {
    std::lock_guard<std::mutex> lock(mutex_);
    intentos_.erase(ip);
}

std::string leer_cookie(const crow::request& req, const std::string& nombre) {
    const std::string c = req.get_header_value("Cookie");
    const std::string buscar = nombre + "=";
    for (size_t pos = 0; pos < c.size();) {
        while (pos < c.size() && (c[pos] == ' ' || c[pos] == ';')) ++pos;
        const size_t fin = c.find(';', pos);
        const std::string par = c.substr(pos, fin == std::string::npos ? std::string::npos : fin - pos);
        if (par.rfind(buscar, 0) == 0) return par.substr(buscar.size());
        if (fin == std::string::npos) break;
        pos = fin + 1;
    }
    return "";
}

std::string ip_cliente(const crow::request& req) {
    const std::string real = req.get_header_value("X-Real-IP");
    const bool desde_nginx = req.remote_ip_address == "127.0.0.1" || req.remote_ip_address == "::1";
    return desde_nginx && !real.empty() ? real : req.remote_ip_address;
}

std::string cookie_sesion(const crow::request& req, const std::string& token, int max_age) {
    std::string c = "sx_sesion=" + token + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + std::to_string(max_age);
    if (req.get_header_value("X-Forwarded-Proto") == "https") c += "; Secure";
    return c;
}

void Autenticacion::before_handle(crow::request& req, crow::response& res, context& ctx) {
    const std::string& url = req.url;
    if (url.rfind("/api/", 0) != 0) return;                                   // interfaz y datos públicos
    if (url == "/api/salud" || url.rfind("/api/auth/", 0) == 0) return;  // públicos: salud, login, logout y sesión
    if (req.method == crow::HTTPMethod::Options) return;                      // preflight CORS en desarrollo
    if (sesiones) ctx.usuario = sesiones->validar(leer_cookie(req, "sx_sesion"));
    if (!ctx.usuario) {
        res.code = 401;
        res.set_header("Content-Type", "application/json; charset=utf-8");
        res.body = R"({"error":"Inicie sesión para usar la plataforma."})";
        res.end();
    }
}
