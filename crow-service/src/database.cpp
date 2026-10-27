#include "database.h"

#include <sqlite3.h>

#include <array>
#include <cstdint>
#include <random>
#include <stdexcept>
#include <string>
#include <vector>

namespace {

constexpr std::uint32_t rotar_derecha(std::uint32_t valor, std::uint32_t posiciones) {
    return (valor >> posiciones) | (valor << (32 - posiciones));
}

std::array<std::uint8_t, 32> sha256(const std::string& entrada) {
    static constexpr std::array<std::uint32_t, 64> k = {
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2};

    std::array<std::uint32_t, 8> estado = {0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
                                           0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19};

    std::vector<std::uint8_t> mensaje(entrada.begin(), entrada.end());
    const std::uint64_t bits = static_cast<std::uint64_t>(mensaje.size()) * 8;
    mensaje.push_back(0x80);
    while (mensaje.size() % 64 != 56) mensaje.push_back(0x00);
    for (int i = 7; i >= 0; --i) mensaje.push_back(static_cast<std::uint8_t>((bits >> (i * 8)) & 0xff));

    for (std::size_t desplazamiento = 0; desplazamiento < mensaje.size(); desplazamiento += 64) {
        std::array<std::uint32_t, 64> w{};
        for (int i = 0; i < 16; ++i) {
            w[i] = (static_cast<std::uint32_t>(mensaje[desplazamiento + i * 4]) << 24) |
                   (static_cast<std::uint32_t>(mensaje[desplazamiento + i * 4 + 1]) << 16) |
                   (static_cast<std::uint32_t>(mensaje[desplazamiento + i * 4 + 2]) << 8) |
                   static_cast<std::uint32_t>(mensaje[desplazamiento + i * 4 + 3]);
        }
        for (int i = 16; i < 64; ++i) {
            const std::uint32_t s0 =
                rotar_derecha(w[i - 15], 7) ^ rotar_derecha(w[i - 15], 18) ^ (w[i - 15] >> 3);
            const std::uint32_t s1 =
                rotar_derecha(w[i - 2], 17) ^ rotar_derecha(w[i - 2], 19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16] + s0 + w[i - 7] + s1;
        }

        std::uint32_t a = estado[0], b = estado[1], c = estado[2], d = estado[3];
        std::uint32_t e = estado[4], f = estado[5], g = estado[6], h = estado[7];

        for (int i = 0; i < 64; ++i) {
            const std::uint32_t s1 = rotar_derecha(e, 6) ^ rotar_derecha(e, 11) ^ rotar_derecha(e, 25);
            const std::uint32_t ch = (e & f) ^ (~e & g);
            const std::uint32_t temp1 = h + s1 + ch + k[i] + w[i];
            const std::uint32_t s0 = rotar_derecha(a, 2) ^ rotar_derecha(a, 13) ^ rotar_derecha(a, 22);
            const std::uint32_t maj = (a & b) ^ (a & c) ^ (b & c);
            const std::uint32_t temp2 = s0 + maj;

            h = g;
            g = f;
            f = e;
            e = d + temp1;
            d = c;
            c = b;
            b = a;
            a = temp1 + temp2;
        }

        estado[0] += a;
        estado[1] += b;
        estado[2] += c;
        estado[3] += d;
        estado[4] += e;
        estado[5] += f;
        estado[6] += g;
        estado[7] += h;
    }

    std::array<std::uint8_t, 32> salida{};
    for (int i = 0; i < 8; ++i) {
        salida[i * 4] = static_cast<std::uint8_t>(estado[i] >> 24);
        salida[i * 4 + 1] = static_cast<std::uint8_t>(estado[i] >> 16);
        salida[i * 4 + 2] = static_cast<std::uint8_t>(estado[i] >> 8);
        salida[i * 4 + 3] = static_cast<std::uint8_t>(estado[i]);
    }
    return salida;
}

std::string a_hex(const std::uint8_t* datos, std::size_t cantidad) {
    static constexpr char digitos[] = "0123456789abcdef";
    std::string salida;
    salida.reserve(cantidad * 2);
    for (std::size_t i = 0; i < cantidad; ++i) {
        salida.push_back(digitos[datos[i] >> 4]);
        salida.push_back(digitos[datos[i] & 0x0f]);
    }
    return salida;
}

std::string nuevo_salt() {
    std::array<std::uint8_t, 16> bytes{};
    std::random_device aleatorio;
    for (auto& byte : bytes) byte = static_cast<std::uint8_t>(aleatorio());
    return a_hex(bytes.data(), bytes.size());
}

std::string proteger_password(const std::string& password) {
    constexpr int iteraciones = 100000;
    const std::string salt = nuevo_salt();
    const std::string inicial = salt + password;
    auto resumen = sha256(inicial);
    std::string material;
    material.reserve(64);
    for (int i = 0; i < iteraciones; ++i) {
        material.assign(reinterpret_cast<const char*>(resumen.data()), resumen.size());
        material += salt;
        resumen = sha256(material);
    }
    return "sha256$" + std::to_string(iteraciones) + "$" + salt + "$" + a_hex(resumen.data(), resumen.size());
}

void exigir(const std::string& valor, const std::string& campo) {
    if (valor.empty()) throw std::runtime_error("El campo '" + campo + "' es obligatorio.");
}

[[noreturn]] void lanzar_error(sqlite3* db, const std::string& contexto) {
    throw std::runtime_error(contexto + ": " + (db ? sqlite3_errmsg(db) : "sin conexion"));
}

void ejecutar_sql(sqlite3* db, const std::string& sql, const std::string& contexto) {
    char* error = nullptr;
    const int rc = sqlite3_exec(db, sql.c_str(), nullptr, nullptr, &error);
    if (rc != SQLITE_OK) {
        const std::string detalle = error ? error : "error desconocido";
        sqlite3_free(error);
        throw std::runtime_error(contexto + ": " + detalle);
    }
}

class Sentencia {
public:
    Sentencia(sqlite3* db, const char* sql) : db_(db) {
        if (sqlite3_prepare_v2(db_, sql, -1, &stmt_, nullptr) != SQLITE_OK)
            lanzar_error(db_, "No se pudo preparar la consulta");
    }

    ~Sentencia() {
        if (stmt_) sqlite3_finalize(stmt_);
    }

    Sentencia(const Sentencia&) = delete;
    Sentencia& operator=(const Sentencia&) = delete;

    void texto(int indice, const std::string& valor) {
        if (sqlite3_bind_text(stmt_, indice, valor.c_str(), static_cast<int>(valor.size()), SQLITE_TRANSIENT) !=
            SQLITE_OK)
            lanzar_error(db_, "No se pudo enlazar un texto");
    }

    void entero(int indice, std::int64_t valor) {
        if (sqlite3_bind_int64(stmt_, indice, valor) != SQLITE_OK)
            lanzar_error(db_, "No se pudo enlazar un numero");
    }

    void nulo(int indice) {
        if (sqlite3_bind_null(stmt_, indice) != SQLITE_OK)
            lanzar_error(db_, "No se pudo enlazar un valor nulo");
    }

    void ejecutar() {
        if (sqlite3_step(stmt_) != SQLITE_DONE) lanzar_error(db_, "No se pudo ejecutar la consulta");
    }

private:
    sqlite3* db_;
    sqlite3_stmt* stmt_ = nullptr;
};

class Transaccion {
public:
    explicit Transaccion(sqlite3* db) : db_(db) {
        char* error = nullptr;
        if (sqlite3_exec(db_, "BEGIN IMMEDIATE", nullptr, nullptr, &error) != SQLITE_OK) {
            const std::string detalle = error ? error : "error desconocido";
            sqlite3_free(error);
            throw std::runtime_error("No se pudo iniciar la transaccion: " + detalle);
        }
    }

    ~Transaccion() {
        if (!confirmada_) sqlite3_exec(db_, "ROLLBACK", nullptr, nullptr, nullptr);
    }

    Transaccion(const Transaccion&) = delete;
    Transaccion& operator=(const Transaccion&) = delete;

    void confirmar() {
        char* error = nullptr;
        if (sqlite3_exec(db_, "COMMIT", nullptr, nullptr, &error) != SQLITE_OK) {
            const std::string detalle = error ? error : "error desconocido";
            sqlite3_free(error);
            throw std::runtime_error("No se pudo confirmar la transaccion: " + detalle);
        }
        confirmada_ = true;
    }

private:
    sqlite3* db_;
    bool confirmada_ = false;
};

void crear_esquema(sqlite3* db) {
    const std::string sql = R"sql(
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_completo TEXT NOT NULL,
            correo TEXT NOT NULL COLLATE NOCASE UNIQUE,
            organizacion TEXT NOT NULL,
            comentario TEXT NOT NULL,
            cargo TEXT NOT NULL DEFAULT '',
            telefono TEXT NOT NULL DEFAULT '',
            ciudad TEXT NOT NULL DEFAULT '',
            departamento TEXT NOT NULL DEFAULT '',
            pais TEXT NOT NULL DEFAULT 'Colombia',
            rol TEXT NOT NULL DEFAULT 'analista',
            estado TEXT NOT NULL DEFAULT 'pendiente',
            fecha_solicitud TEXT NOT NULL DEFAULT (datetime('now')),
            fecha_actualizacion TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS credenciales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL UNIQUE,
            username TEXT NOT NULL COLLATE NOCASE UNIQUE,
            password TEXT NOT NULL,
            activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
            ultimo_acceso TEXT,
            fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
            fecha_actualizacion TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_usuarios_estado ON usuarios(estado);
        )sql";
    ejecutar_sql(db, sql, "No se pudo crear el esquema de usuarios");
}

void validar_usuario(const Usuario& usuario) {
    exigir(usuario.nombre_completo, "nombre_completo");
    exigir(usuario.correo, "correo");
    exigir(usuario.organizacion, "organizacion");
    exigir(usuario.comentario, "comentario");
}

void insertar_credencial(sqlite3* db, std::int64_t usuario_id, const Credencial& credencial) {
    exigir(credencial.username, "username");
    exigir(credencial.password, "password");

    Sentencia s(db,
                "INSERT INTO credenciales (usuario_id, username, password, activo, ultimo_acceso) "
                "VALUES (?, ?, ?, ?, ?)");
    s.entero(1, usuario_id);
    s.texto(2, credencial.username);
    s.texto(3, proteger_password(credencial.password));
    s.entero(4, credencial.activo ? 1 : 0);
    if (credencial.ultimo_acceso.empty())
        s.nulo(5);
    else
        s.texto(5, credencial.ultimo_acceso);
    s.ejecutar();
}

}  // namespace

BaseDatosUsuarios::BaseDatosUsuarios(const std::string& archivo) {
    if (archivo.empty()) throw std::runtime_error("La ruta de la base de datos de usuarios esta vacia.");

    const int rc = sqlite3_open_v2(archivo.c_str(), &db_,
                                   SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nullptr);
    if (rc != SQLITE_OK) {
        const std::string detalle = db_ ? sqlite3_errmsg(db_) : "no se pudo abrir el archivo";
        if (db_) {
            sqlite3_close(db_);
            db_ = nullptr;
        }
        throw std::runtime_error("No se pudo abrir la base de datos de usuarios: " + detalle);
    }

    try {
        sqlite3_busy_timeout(db_, 5000);
        ejecutar_sql(db_, "PRAGMA foreign_keys = ON", "No se pudo activar las claves foraneas");
        crear_esquema(db_);
    } catch (...) {
        sqlite3_close(db_);
        db_ = nullptr;
        throw;
    }
}

BaseDatosUsuarios::~BaseDatosUsuarios() {
    if (db_) sqlite3_close(db_);
}

std::int64_t BaseDatosUsuarios::crear_usuario(const Usuario& usuario, const Credencial& credencial) {
    validar_usuario(usuario);
    exigir(credencial.username, "username");
    exigir(credencial.password, "password");

    Transaccion tx(db_);

    Sentencia s(db_,
                "INSERT INTO usuarios (nombre_completo, correo, organizacion, comentario, cargo, telefono, "
                "ciudad, departamento, pais, rol, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    s.texto(1, usuario.nombre_completo);
    s.texto(2, usuario.correo);
    s.texto(3, usuario.organizacion);
    s.texto(4, usuario.comentario);
    s.texto(5, usuario.cargo);
    s.texto(6, usuario.telefono);
    s.texto(7, usuario.ciudad);
    s.texto(8, usuario.departamento);
    s.texto(9, usuario.pais);
    s.texto(10, usuario.rol);
    s.texto(11, usuario.estado);
    s.ejecutar();

    const std::int64_t id = sqlite3_last_insert_rowid(db_);
    insertar_credencial(db_, id, credencial);
    tx.confirmar();
    return id;
}

void BaseDatosUsuarios::modificar_usuario(std::int64_t id, const Usuario& usuario,
                                          const std::optional<Credencial>& credencial) {
    if (id <= 0) throw std::runtime_error("El id del usuario no es valido.");
    validar_usuario(usuario);

    Transaccion tx(db_);

    Sentencia s(db_,
                "UPDATE usuarios SET nombre_completo = ?, correo = ?, organizacion = ?, comentario = ?, "
                "cargo = ?, telefono = ?, ciudad = ?, departamento = ?, pais = ?, rol = ?, estado = ?, "
                "fecha_actualizacion = datetime('now') WHERE id = ?");
    s.texto(1, usuario.nombre_completo);
    s.texto(2, usuario.correo);
    s.texto(3, usuario.organizacion);
    s.texto(4, usuario.comentario);
    s.texto(5, usuario.cargo);
    s.texto(6, usuario.telefono);
    s.texto(7, usuario.ciudad);
    s.texto(8, usuario.departamento);
    s.texto(9, usuario.pais);
    s.texto(10, usuario.rol);
    s.texto(11, usuario.estado);
    s.entero(12, id);
    s.ejecutar();

    if (sqlite3_changes(db_) == 0) throw std::runtime_error("No existe un usuario con ese id.");

    if (credencial) {
        exigir(credencial->username, "username");

        if (credencial->password.empty()) {
            Sentencia sc(db_,
                         "UPDATE credenciales SET username = ?, activo = ?, fecha_actualizacion = datetime('now') "
                         "WHERE usuario_id = ?");
            sc.texto(1, credencial->username);
            sc.entero(2, credencial->activo ? 1 : 0);
            sc.entero(3, id);
            sc.ejecutar();
        } else {
            Sentencia sc(db_,
                         "UPDATE credenciales SET username = ?, password = ?, activo = ?, "
                         "fecha_actualizacion = datetime('now') WHERE usuario_id = ?");
            sc.texto(1, credencial->username);
            sc.texto(2, proteger_password(credencial->password));
            sc.entero(3, credencial->activo ? 1 : 0);
            sc.entero(4, id);
            sc.ejecutar();
        }

        if (sqlite3_changes(db_) == 0) insertar_credencial(db_, id, *credencial);
    }

    tx.confirmar();
}

void BaseDatosUsuarios::eliminar_usuario(std::int64_t id) {
    if (id <= 0) throw std::runtime_error("El id del usuario no es valido.");

    Transaccion tx(db_);
    Sentencia s(db_, "DELETE FROM usuarios WHERE id = ?");
    s.entero(1, id);
    s.ejecutar();

    if (sqlite3_changes(db_) == 0) throw std::runtime_error("No existe un usuario con ese id.");
    tx.confirmar();
}
