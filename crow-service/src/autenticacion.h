// Autenticación de la plataforma: usuarios de shared/config/usuarios.json (claves PBKDF2), sesiones en memoria con
// cookie HttpOnly y límite de intentos por IP. La landing pública y sus datos no la necesitan; toda la API sí,
// salvo /api/salud y /api/auth/login.
#pragma once

#include <chrono>
#include <filesystem>
#include <map>
#include <mutex>
#include <optional>
#include <string>

#include <crow.h>

struct Usuario {
    std::string usuario, nombre;
};

class Sesiones {
public:
    explicit Sesiones(std::filesystem::path archivo_usuarios);
    // Verifica usuario y clave; si son correctos crea una sesión y devuelve su token
    std::optional<std::string> iniciar(const std::string& usuario, const std::string& clave, Usuario& salida);
    std::optional<Usuario> validar(const std::string& token);
    void cerrar(const std::string& token);
    // Límite de intentos: false si la IP superó los fallos permitidos (y cuántos segundos faltan)
    bool permitido(const std::string& ip, int& espera_segundos);
    void registrar_fallo(const std::string& ip);
    void limpiar_fallos(const std::string& ip);
    size_t usuarios_registrados() const;

    static constexpr std::chrono::hours DURACION{8};

private:
    struct Sesion { Usuario usuario; std::chrono::steady_clock::time_point expira; };
    struct Intentos { int fallos = 0; std::chrono::steady_clock::time_point desde; };
    std::filesystem::path archivo_;
    std::mutex mutex_;
    std::map<std::string, Sesion> sesiones_;
    std::map<std::string, Intentos> intentos_;
};

// Middleware de Crow: deja pasar lo público y exige sesión válida en el resto de /api
struct Autenticacion {
    struct context { std::optional<Usuario> usuario; };
    Sesiones* sesiones = nullptr;
    void before_handle(crow::request& req, crow::response& res, context& ctx);
    void after_handle(crow::request&, crow::response&, context&) {}
};

std::string leer_cookie(const crow::request& req, const std::string& nombre);
std::string ip_cliente(const crow::request& req);  // X-Real-IP solo si la conexión viene de Nginx local
std::string cookie_sesion(const crow::request& req, const std::string& token, int max_age);
