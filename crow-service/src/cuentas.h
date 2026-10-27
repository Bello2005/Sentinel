// Cuentas de la plataforma: usuarios con rol y solicitudes de acceso.
//   shared/config/usuarios.json     usuarios (clave PBKDF2, rol, si debe cambiar la clave); no va a git
//   shared/config/solicitudes.json  solicitudes de acceso enviadas desde /acceso; no va a git
// Roles: admin (todo, incluida la decisión sobre versiones y la administración), colaborador (ayuda a mejorar el
// modelo: valida, explora, predice y entrena candidatas, pero no las activa) y descarga (solo descarga el modelo).
// Una cuenta sin rol (creada antes de que existieran) cuenta como admin.
#pragma once

#include <chrono>
#include <deque>
#include <filesystem>
#include <map>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <string>

#include <nlohmann/json.hpp>

struct Usuario {
    std::string usuario, nombre, rol = "admin";
    bool debe_cambiar = false;
};

// Error con mensaje para la persona y código HTTP
struct ErrorCuenta : std::runtime_error {
    int codigo;
    ErrorCuenta(int c, const std::string& m) : std::runtime_error(m), codigo(c) {}
};

bool rol_valido(const std::string& rol);
bool usuario_valido(const std::string& usuario);  // 3 a 32 caracteres: a-z, 0-9, punto, guion y guion bajo

class Cuentas {
public:
    Cuentas(std::filesystem::path usuarios, std::filesystem::path solicitudes);

    // Usuarios ---------------------------------------------------------------------------------------------------
    // Verifica usuario y clave gastando el mismo tiempo aunque el usuario no exista
    std::optional<Usuario> verificar(const std::string& usuario, const std::string& clave);
    std::optional<Usuario> buscar(const std::string& usuario);
    nlohmann::json listar_usuarios();  // sin las claves
    size_t cantidad_usuarios();
    // Crea una cuenta con clave temporal (debe cambiarla al entrar) y devuelve esa clave
    std::string crear_usuario(const std::string& usuario, const std::string& nombre, const std::string& rol, const std::string& correo);
    void cambiar_rol(const std::string& usuario, const std::string& rol, const std::string& quien);
    void eliminar(const std::string& usuario, const std::string& quien);
    std::string restablecer(const std::string& usuario);  // nueva clave temporal
    void cambiar_clave(const std::string& usuario, const std::string& actual, const std::string& nueva);

    // Solicitudes ------------------------------------------------------------------------------------------------
    void crear_solicitud(const nlohmann::json& datos);  // valida y guarda como pendiente
    nlohmann::json listar_solicitudes();
    // Aprueba (crea la cuenta y devuelve {usuario, clave_temporal}) o rechaza (devuelve {})
    nlohmann::json resolver(const std::string& id, bool aprobar, const std::string& rol, const std::string& usuario,
                            const std::string& nota, const std::string& quien);

    static constexpr size_t MIN_CLAVE = 10;

private:
    nlohmann::json leer(const std::filesystem::path& archivo, const char* lista);
    void guardar(const std::filesystem::path& archivo, const nlohmann::json& datos);
    std::string crear_sin_bloqueo(nlohmann::json& datos, const std::string& usuario, const std::string& nombre,
                                  const std::string& rol, const std::string& correo);
    std::filesystem::path usuarios_, solicitudes_;
    std::mutex mutex_;
};

// Límite simple de eventos por clave (por ejemplo, solicitudes por IP) dentro de una ventana de tiempo
class Limitador {
public:
    Limitador(size_t maximo, std::chrono::seconds ventana) : maximo_(maximo), ventana_(ventana) {}
    bool permitir(const std::string& clave);  // registra el evento si se permite
private:
    size_t maximo_;
    std::chrono::seconds ventana_;
    std::mutex mutex_;
    std::map<std::string, std::deque<std::chrono::steady_clock::time_point>> eventos_;
};

