#pragma once

#include <cstdint>
#include <optional>
#include <string>

struct sqlite3;

struct Usuario {
    std::int64_t id = 0; 
    std::string nombre_completo;
    std::string correo;
    std::string organizacion;
    std::string comentario;
    std::string cargo;
    std::string telefono;
    std::string ciudad;
    std::string departamento;
    std::string pais = "Colombia";
    std::string rol = "analista";
    std::string estado = "pendiente";
};

struct Credencial {
    std::int64_t id = 0;
    std::int64_t usuario_id = 0;
    std::string username;
    std::string password;
    bool activo = true;
    std::string ultimo_acceso;
};

class BaseDatosUsuarios {
public:
    explicit BaseDatosUsuarios(const std::string& archivo);
    ~BaseDatosUsuarios();

    BaseDatosUsuarios(const BaseDatosUsuarios&) = delete;
    BaseDatosUsuarios& operator=(const BaseDatosUsuarios&) = delete;
    BaseDatosUsuarios(BaseDatosUsuarios&&) = delete;
    BaseDatosUsuarios& operator=(BaseDatosUsuarios&&) = delete;

    std::int64_t crear_usuario(const Usuario& usuario, const Credencial& credencial);
    void modificar_usuario(std::int64_t id, const Usuario& usuario,
                           const std::optional<Credencial>& credencial = std::nullopt);
    void eliminar_usuario(std::int64_t id);

private:
    sqlite3* db_ = nullptr;
};
