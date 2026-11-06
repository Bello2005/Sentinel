#include "autenticacion.h"

#include "cripto.h"

using reloj = std::chrono::steady_clock;

namespace {
constexpr int MAX_FALLOS = 5;
constexpr auto VENTANA = std::chrono::minutes(15);
bool empieza(const std::string& s, const char* prefijo) { return s.rfind(prefijo, 0) == 0; }
}  // namespace

Sesiones::Sesiones(BaseDatosUsuarios& cuentas) : cuentas_(cuentas) {}

std::optional<std::string> Sesiones::iniciar(const std::string& usuario, const std::string& clave, Usuario& salida) {
    // Las cuentas se releen en cada intento: crear o borrar usuarios no exige reiniciar el servidor
    auto u = cuentas_.verificar(usuario, clave);
    if (!u) return std::nullopt;
    salida = *u;
    const std::string token = cripto::hex(cripto::aleatorio(32));
    std::lock_guard<std::mutex> lock(mutex_);
    sesiones_[token] = {salida, reloj::now() + DURACION};
    // Limpieza de sesiones vencidas
    for (auto it = sesiones_.begin(); it != sesiones_.end();) it = it->second.expira < reloj::now() ? sesiones_.erase(it) : std::next(it);
    return token;
}

void Sesiones::cerrar_de(const std::string& usuario) {
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto it = sesiones_.begin(); it != sesiones_.end();) it = it->second.usuario.usuario == usuario ? sesiones_.erase(it) : std::next(it);
}

void Sesiones::actualizar(const std::string& usuario, const Usuario& u) {
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto& [_, s] : sesiones_) if (s.usuario.usuario == usuario) s.usuario = u;
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

bool Limitador::permitir(const std::string& clave) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto& cola = eventos_[clave];
    const auto ahora = reloj::now();
    while (!cola.empty() && ahora - cola.front() > ventana_) cola.pop_front();
    if (cola.size() >= maximo_) return false;
    cola.push_back(ahora);
    return true;
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
        res.set_header("Content-Type", "application/json; charset=utf-8");
        res.code = 401;
        res.body = R"({"error":"Inicie sesión para usar la plataforma."})";
        res.end();
    } else if (!permitido_para(*ctx.usuario, req)) {
        res.set_header("Content-Type", "application/json; charset=utf-8");
        res.code = 403;
        res.body = ctx.usuario->debe_cambiar ? R"({"error":"Cambie su contraseña temporal para continuar.","codigo":"debe_cambiar"})"
                                             : R"({"error":"Su cuenta no tiene permiso para esto.","codigo":"sin_permiso"})";
        res.end();
    }
}

bool permitido_para(const Usuario& u, const crow::request& req) {
    const std::string& url = req.url;
    if (empieza(url, "/api/cuenta/")) return true;               // su propia cuenta: cualquier rol
    if (u.debe_cambiar) return false;                             // con clave temporal, solo puede cambiarla
    if (u.rol == "admin") return true;
    if (empieza(url, "/api/admin/")) return false;
    if (empieza(url, "/api/descargas")) return true;              // descargar el modelo: cualquier rol
    if (u.rol == "descarga") return url == "/api/modelo" && req.method == crow::HTTPMethod::Get;
    if (u.rol == "colaborador") return url != "/api/modelo/decision";  // propone candidatas, no las activa
    return false;
}
