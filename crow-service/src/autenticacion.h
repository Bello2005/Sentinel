// Autenticación y permisos: sesiones en memoria con cookie HttpOnly, límite de intentos por IP y control por rol.
// Las cuentas viven en BaseDatosUsuarios (database.h). La landing pública y sus datos no la necesitan; toda la API sí, salvo
// /api/salud y /api/auth/* (iniciar y cerrar sesión, consultar la sesión y solicitar acceso).
#pragma once

#include <chrono>
#include <deque>
#include <filesystem>
#include <map>
#include <mutex>
#include <optional>
#include <string>

#include <crow.h>

#include "database.h"

class Sesiones {
public:
    explicit Sesiones(BaseDatosUsuarios& cuentas);
    // Verifica usuario y clave; si son correctos crea una sesión y devuelve su token
    std::optional<std::string> iniciar(const std::string& usuario, const std::string& clave, Usuario& salida);
    std::optional<Usuario> validar(const std::string& token);
    void cerrar(const std::string& token);
    void cerrar_de(const std::string& usuario);                     // al eliminar la cuenta o cambiar su rol
    void actualizar(const std::string& usuario, const Usuario& u);  // al cambiar su clave
    // Límite de intentos: false si la IP superó los fallos permitidos (y cuántos segundos faltan)
    bool permitido(const std::string& ip, int& espera_segundos);
    void registrar_fallo(const std::string& ip);
    void limpiar_fallos(const std::string& ip);

    static constexpr std::chrono::hours DURACION{8};

private:
    struct Sesion { Usuario usuario; std::chrono::steady_clock::time_point expira; };
    struct Intentos { int fallos = 0; std::chrono::steady_clock::time_point desde; };
    BaseDatosUsuarios& cuentas_;
    std::mutex mutex_;
    std::map<std::string, Sesion> sesiones_;
    std::map<std::string, Intentos> intentos_;
};

// Middleware de Crow: deja pasar lo público, exige sesión válida en el resto de /api y aplica los permisos del rol
struct Autenticacion {
    struct context { std::optional<Usuario> usuario; };
    Sesiones* sesiones = nullptr;
    void before_handle(crow::request& req, crow::response& res, context& ctx);
    void after_handle(crow::request&, crow::response&, context&) {}
};

// Límite simple de eventos por clave (por ejemplo, solicitudes por IP) dentro de una ventana de tiempo
class Limitador {
public:
    Limitador(std::size_t maximo, std::chrono::seconds ventana) : maximo_(maximo), ventana_(ventana) {}
    bool permitir(const std::string& clave);  // registra el evento si se permite
private:
    std::size_t maximo_;
    std::chrono::seconds ventana_;
    std::mutex mutex_;
    std::map<std::string, std::deque<std::chrono::steady_clock::time_point>> eventos_;
};

std::string leer_cookie(const crow::request& req, const std::string& nombre);
std::string ip_cliente(const crow::request& req);  // X-Real-IP solo si la conexión viene de Nginx local
std::string cookie_sesion(const crow::request& req, const std::string& token, int max_age);
// ¿Puede este usuario usar esta ruta? (quien debe cambiar su clave solo puede hacer eso)
bool permitido_para(const Usuario& u, const crow::request& req);
