#include "database.h"

#include <sqlite3.h>

#include <chrono>
#include <cstdint>
#include <ctime>
#include <regex>
#include <set>
#include <stdexcept>
#include <string>

#include "cripto.h"

namespace {

const std::string HASH_FICTICIO =
    "pbkdf2_sha256$210000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const std::set<std::string> ROLES = {"admin", "colaborador", "descarga"};
const std::set<std::string> TIPOS_SOLICITUD = {"colaborador", "descarga"};
constexpr std::size_t MAX_PENDIENTES = 300;

std::string fecha_iso() {
    const std::time_t ahora = std::time(nullptr);
    std::tm local{};
    localtime_r(&ahora, &local);
    char salida[32];
    std::strftime(salida, sizeof salida, "%Y-%m-%dT%H:%M:%S", &local);
    return salida;
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

    bool paso() {
        const int rc = sqlite3_step(stmt_);
        if (rc == SQLITE_ROW) return true;
        if (rc == SQLITE_DONE) return false;
        lanzar_error(db_, "No se pudo ejecutar la consulta");
    }

    void ejecutar() {
        if (sqlite3_step(stmt_) != SQLITE_DONE) lanzar_error(db_, "No se pudo ejecutar la consulta");
    }

    std::string texto_columna(int indice) const {
        const unsigned char* valor = sqlite3_column_text(stmt_, indice);
        return valor ? reinterpret_cast<const char*>(valor) : "";
    }

    std::int64_t entero_columna(int indice) const { return sqlite3_column_int64(stmt_, indice); }

    bool nula_columna(int indice) const { return sqlite3_column_type(stmt_, indice) == SQLITE_NULL; }

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
            usuario TEXT NOT NULL COLLATE NOCASE UNIQUE,
            nombre TEXT NOT NULL,
            correo TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
            organizacion TEXT NOT NULL DEFAULT '',
            rol TEXT NOT NULL DEFAULT 'admin' CHECK (rol IN ('admin', 'colaborador', 'descarga')),
            hash TEXT NOT NULL,
            debe_cambiar INTEGER NOT NULL DEFAULT 1 CHECK (debe_cambiar IN (0, 1)),
            creado TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);

        CREATE TABLE IF NOT EXISTS solicitudes (
            id TEXT PRIMARY KEY,
            fecha TEXT NOT NULL,
            nombre TEXT NOT NULL,
            correo TEXT NOT NULL COLLATE NOCASE,
            organizacion TEXT NOT NULL DEFAULT '',
            tipo TEXT NOT NULL CHECK (tipo IN ('colaborador', 'descarga')),
            motivo TEXT NOT NULL,
            estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
            usuario_creado TEXT,
            rol_asignado TEXT,
            resuelta_por TEXT,
            resuelta_fecha TEXT,
            resuelta_nota TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes(estado);
        CREATE INDEX IF NOT EXISTS idx_solicitudes_correo ON solicitudes(correo);
        )sql";
    ejecutar_sql(db, sql, "No se pudo crear el esquema de cuentas");
}

std::string limpio(const nlohmann::json& d, const char* campo, std::size_t maximo) {
    std::string s = d.contains(campo) && d[campo].is_string() ? d[campo].get<std::string>() : "";
    std::string r;
    for (unsigned char c : s)
        if (c >= 32 || c == '\n') r += char(c);
    const auto ini = r.find_first_not_of(" \n"), fin = r.find_last_not_of(" \n");
    r = ini == std::string::npos ? "" : r.substr(ini, fin - ini + 1);
    if (r.size() > maximo) throw ErrorCuenta(400, std::string("El campo «") + campo + "» es demasiado largo.");
    return r;
}

std::string insertar_usuario(sqlite3* db, const std::string& usuario, const std::string& nombre,
                             const std::string& rol, const std::string& correo) {
    const std::string clave = cripto::clave_temporal();
    Sentencia s(db,
                "INSERT INTO usuarios (usuario, nombre, correo, rol, hash, debe_cambiar, creado) "
                "VALUES (?, ?, ?, ?, ?, 1, ?)");
    s.texto(1, usuario);
    s.texto(2, nombre);
    s.texto(3, correo);
    s.texto(4, rol);
    s.texto(5, cripto::cifrar_clave(clave));
    s.texto(6, fecha_iso());
    s.ejecutar();
    return clave;
}

std::size_t contar_admins(sqlite3* db) {
    Sentencia s(db, "SELECT COUNT(*) FROM usuarios WHERE rol = 'admin'");
    s.paso();
    return static_cast<std::size_t>(s.entero_columna(0));
}

void validar_usuario_nuevo(const std::string& usuario, const std::string& nombre, const std::string& rol) {
    if (!usuario_valido(usuario))
        throw ErrorCuenta(400, "El usuario debe tener de 3 a 32 caracteres: letras minúsculas, números, punto o guion.");
    if (!rol_valido(rol)) throw ErrorCuenta(400, "Rol no válido.");
    if (nombre.size() < 3) throw ErrorCuenta(400, "Escriba el nombre de la persona.");
}

}  // namespace

bool rol_valido(const std::string& rol) { return ROLES.count(rol) > 0; }

bool usuario_valido(const std::string& usuario) {
    return std::regex_match(usuario, std::regex("^[a-z0-9._-]{3,32}$"));
}

BaseDatosUsuarios::BaseDatosUsuarios(const std::filesystem::path& archivo) {
    if (archivo.empty()) throw std::runtime_error("La ruta de la base de datos de cuentas esta vacia.");
    if (!archivo.parent_path().empty()) std::filesystem::create_directories(archivo.parent_path());

    const std::string ruta = archivo.string();
    const int rc = sqlite3_open_v2(ruta.c_str(), &db_,
                                   SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nullptr);
    if (rc != SQLITE_OK) {
        const std::string detalle = db_ ? sqlite3_errmsg(db_) : "no se pudo abrir el archivo";
        if (db_) {
            sqlite3_close(db_);
            db_ = nullptr;
        }
        throw std::runtime_error("No se pudo abrir la base de datos de cuentas: " + detalle);
    }

    try {
        sqlite3_busy_timeout(db_, 5000);
        ejecutar_sql(db_, "PRAGMA foreign_keys = ON", "No se pudo activar las claves foraneas");
        ejecutar_sql(db_, "PRAGMA journal_mode = WAL", "No se pudo activar el modo WAL");
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

// --- Usuarios ---------------------------------------------------------------------------------------------------
std::optional<Usuario> BaseDatosUsuarios::verificar(const std::string& usuario, const std::string& clave) {
    std::lock_guard<std::mutex> lock(mutex_);
    Sentencia s(db_, "SELECT usuario, nombre, rol, debe_cambiar, hash FROM usuarios WHERE usuario = ?");
    s.texto(1, usuario);
    const bool existe = s.paso();
    const std::string almacenado = existe ? s.texto_columna(4) : HASH_FICTICIO;
    const bool ok = cripto::verificar_clave(clave, almacenado);
    if (!existe || !ok) return std::nullopt;

    std::string rol = s.texto_columna(2);
    if (!rol_valido(rol)) rol = "admin";
    return Usuario{s.texto_columna(0), s.texto_columna(1), rol, s.entero_columna(3) != 0};
}

std::optional<Usuario> BaseDatosUsuarios::buscar(const std::string& usuario) {
    std::lock_guard<std::mutex> lock(mutex_);
    Sentencia s(db_, "SELECT usuario, nombre, rol, debe_cambiar FROM usuarios WHERE usuario = ?");
    s.texto(1, usuario);
    if (!s.paso()) return std::nullopt;

    std::string rol = s.texto_columna(2);
    if (!rol_valido(rol)) rol = "admin";
    return Usuario{s.texto_columna(0), s.texto_columna(1), rol, s.entero_columna(3) != 0};
}

std::size_t BaseDatosUsuarios::cantidad_usuarios() {
    std::lock_guard<std::mutex> lock(mutex_);
    Sentencia s(db_, "SELECT COUNT(*) FROM usuarios");
    s.paso();
    return static_cast<std::size_t>(s.entero_columna(0));
}

nlohmann::json BaseDatosUsuarios::listar_usuarios() {
    std::lock_guard<std::mutex> lock(mutex_);
    Sentencia s(db_,
                "SELECT usuario, nombre, rol, correo, creado, debe_cambiar FROM usuarios "
                "ORDER BY nombre COLLATE NOCASE, usuario COLLATE NOCASE");
    nlohmann::json salida = nlohmann::json::array();
    while (s.paso()) {
        std::string rol = s.texto_columna(2);
        if (!rol_valido(rol)) rol = "admin";
        salida.push_back({{"usuario", s.texto_columna(0)}, {"nombre", s.texto_columna(1)}, {"rol", rol},
                          {"correo", s.texto_columna(3)}, {"creado", s.texto_columna(4)},
                          {"debe_cambiar", s.entero_columna(5) != 0}});
    }
    return salida;
}

std::string BaseDatosUsuarios::crear_usuario(const std::string& usuario, const std::string& nombre,
                                             const std::string& rol, const std::string& correo) {
    validar_usuario_nuevo(usuario, nombre, rol);

    std::lock_guard<std::mutex> lock(mutex_);
    Transaccion tx(db_);
    Sentencia existe(db_, "SELECT 1 FROM usuarios WHERE usuario = ?");
    existe.texto(1, usuario);
    if (existe.paso()) throw ErrorCuenta(409, "Ya existe un usuario con ese nombre.");

    const std::string clave = insertar_usuario(db_, usuario, nombre, rol, correo);
    tx.confirmar();
    return clave;
}

void BaseDatosUsuarios::cambiar_rol(const std::string& usuario, const std::string& rol, const std::string& quien) {
    if (!rol_valido(rol)) throw ErrorCuenta(400, "Rol no válido.");

    std::lock_guard<std::mutex> lock(mutex_);
    Transaccion tx(db_);
    Sentencia actual(db_, "SELECT rol FROM usuarios WHERE usuario = ?");
    actual.texto(1, usuario);
    if (!actual.paso()) throw ErrorCuenta(404, "No existe ese usuario.");

    const std::string rol_actual = actual.texto_columna(0);
    if (usuario == quien) throw ErrorCuenta(400, "No puede cambiar su propio rol.");
    if (rol_actual == "admin" && rol != "admin" && contar_admins(db_) <= 1)
        throw ErrorCuenta(400, "Debe quedar al menos un administrador.");

    Sentencia s(db_, "UPDATE usuarios SET rol = ? WHERE usuario = ?");
    s.texto(1, rol);
    s.texto(2, usuario);
    s.ejecutar();
    tx.confirmar();
}

void BaseDatosUsuarios::eliminar(const std::string& usuario, const std::string& quien) {
    std::lock_guard<std::mutex> lock(mutex_);
    Transaccion tx(db_);
    Sentencia actual(db_, "SELECT rol FROM usuarios WHERE usuario = ?");
    actual.texto(1, usuario);
    if (!actual.paso()) throw ErrorCuenta(404, "No existe ese usuario.");

    if (usuario == quien) throw ErrorCuenta(400, "No puede eliminar su propia cuenta.");
    if (actual.texto_columna(0) == "admin" && contar_admins(db_) <= 1)
        throw ErrorCuenta(400, "Debe quedar al menos un administrador.");

    Sentencia s(db_, "DELETE FROM usuarios WHERE usuario = ?");
    s.texto(1, usuario);
    s.ejecutar();
    tx.confirmar();
}

std::string BaseDatosUsuarios::restablecer(const std::string& usuario) {
    std::lock_guard<std::mutex> lock(mutex_);
    Transaccion tx(db_);
    Sentencia existe(db_, "SELECT 1 FROM usuarios WHERE usuario = ?");
    existe.texto(1, usuario);
    if (!existe.paso()) throw ErrorCuenta(404, "No existe ese usuario.");

    const std::string clave = cripto::clave_temporal();
    Sentencia s(db_, "UPDATE usuarios SET hash = ?, debe_cambiar = 1 WHERE usuario = ?");
    s.texto(1, cripto::cifrar_clave(clave));
    s.texto(2, usuario);
    s.ejecutar();
    tx.confirmar();
    return clave;
}

void BaseDatosUsuarios::cambiar_clave(const std::string& usuario, const std::string& actual,
                                      const std::string& nueva) {
    if (nueva.size() < MIN_CLAVE)
        throw ErrorCuenta(400, "La contraseña nueva debe tener al menos 10 caracteres.");
    if (nueva.size() > 200) throw ErrorCuenta(400, "La contraseña nueva es demasiado larga.");
    if (nueva == actual) throw ErrorCuenta(400, "La contraseña nueva debe ser distinta de la actual.");

    std::lock_guard<std::mutex> lock(mutex_);
    Transaccion tx(db_);
    Sentencia q(db_, "SELECT hash FROM usuarios WHERE usuario = ?");
    q.texto(1, usuario);
    if (!q.paso()) throw ErrorCuenta(404, "No existe ese usuario.");
    if (!cripto::verificar_clave(actual, q.texto_columna(0)))
        throw ErrorCuenta(400, "La contraseña actual no es correcta.");

    Sentencia s(db_, "UPDATE usuarios SET hash = ?, debe_cambiar = 0 WHERE usuario = ?");
    s.texto(1, cripto::cifrar_clave(nueva));
    s.texto(2, usuario);
    s.ejecutar();
    tx.confirmar();
}

// --- Solicitudes ------------------------------------------------------------------------------------------------
void BaseDatosUsuarios::crear_solicitud(const nlohmann::json& d) {
    const std::string nombre = limpio(d, "nombre", 80), correo = limpio(d, "correo", 120),
                      organizacion = limpio(d, "organizacion", 120), tipo = limpio(d, "tipo", 20),
                      motivo = limpio(d, "motivo", 1500);
    if (nombre.size() < 3) throw ErrorCuenta(400, "Escriba su nombre completo.");
    if (!std::regex_match(correo, std::regex(R"(^[^@\s]+@[^@\s]+\.[^@\s]{2,}$)")))
        throw ErrorCuenta(400, "Escriba un correo válido.");
    if (!TIPOS_SOLICITUD.count(tipo)) throw ErrorCuenta(400, "Elija qué tipo de acceso necesita.");
    if (motivo.size() < 30)
        throw ErrorCuenta(400, "Cuéntenos un poco más por qué necesita el acceso (al menos 30 caracteres).");

    std::lock_guard<std::mutex> lock(mutex_);
    Transaccion tx(db_);
    Sentencia repetida(db_, "SELECT 1 FROM solicitudes WHERE estado = 'pendiente' AND correo = ?");
    repetida.texto(1, correo);
    if (repetida.paso())
        throw ErrorCuenta(409, "Ya hay una solicitud pendiente con ese correo. El equipo la revisará pronto.");

    Sentencia pendientes(db_, "SELECT COUNT(*) FROM solicitudes WHERE estado = 'pendiente'");
    pendientes.paso();
    if (static_cast<std::size_t>(pendientes.entero_columna(0)) >= MAX_PENDIENTES)
        throw ErrorCuenta(503, "Hay demasiadas solicitudes pendientes. Intente más tarde.");

    Sentencia s(db_,
                "INSERT INTO solicitudes (id, fecha, nombre, correo, organizacion, tipo, motivo, estado) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente')");
    s.texto(1, cripto::hex(cripto::aleatorio(8)));
    s.texto(2, fecha_iso());
    s.texto(3, nombre);
    s.texto(4, correo);
    s.texto(5, organizacion);
    s.texto(6, tipo);
    s.texto(7, motivo);
    s.ejecutar();
    tx.confirmar();
}

nlohmann::json BaseDatosUsuarios::listar_solicitudes() {
    std::lock_guard<std::mutex> lock(mutex_);
    Sentencia s(db_,
                "SELECT id, fecha, nombre, correo, organizacion, tipo, motivo, estado, usuario_creado, "
                "rol_asignado, resuelta_por, resuelta_fecha, resuelta_nota FROM solicitudes "
                "ORDER BY fecha DESC, rowid DESC");
    nlohmann::json salida = nlohmann::json::array();
    while (s.paso()) {
        nlohmann::json solicitud = {{"id", s.texto_columna(0)},       {"fecha", s.texto_columna(1)},
                                    {"nombre", s.texto_columna(2)},   {"correo", s.texto_columna(3)},
                                    {"organizacion", s.texto_columna(4)}, {"tipo", s.texto_columna(5)},
                                    {"motivo", s.texto_columna(6)},   {"estado", s.texto_columna(7)}};
        if (!s.nula_columna(8)) solicitud["usuario_creado"] = s.texto_columna(8);
        if (!s.nula_columna(9)) solicitud["rol_asignado"] = s.texto_columna(9);
        if (!s.nula_columna(10))
            solicitud["resuelta"] = {{"por", s.texto_columna(10)},
                                     {"fecha", s.texto_columna(11)},
                                     {"nota", s.texto_columna(12)}};
        salida.push_back(std::move(solicitud));
    }
    return salida;
}

nlohmann::json BaseDatosUsuarios::resolver(const std::string& id, bool aprobar, const std::string& rol,
                                           const std::string& usuario, const std::string& nota,
                                           const std::string& quien) {
    if (nota.size() > 500) throw ErrorCuenta(400, "La nota es demasiado larga.");

    std::lock_guard<std::mutex> lock(mutex_);
    Transaccion tx(db_);
    Sentencia consulta(db_, "SELECT nombre, correo, estado FROM solicitudes WHERE id = ?");
    consulta.texto(1, id);
    if (!consulta.paso()) throw ErrorCuenta(404, "No existe esa solicitud.");
    if (consulta.texto_columna(2) != "pendiente")
        throw ErrorCuenta(409, "Esa solicitud ya fue resuelta.");

    nlohmann::json salida = nlohmann::json::object();
    if (aprobar) {
        if (rol != "colaborador" && rol != "descarga")
            throw ErrorCuenta(400, "Elija el rol: colaborador o descarga.");
        if (!usuario_valido(usuario))
            throw ErrorCuenta(400, "El usuario debe tener de 3 a 32 caracteres: letras minúsculas, números, punto o guion.");
        Sentencia existe(db_, "SELECT 1 FROM usuarios WHERE usuario = ?");
        existe.texto(1, usuario);
        if (existe.paso()) throw ErrorCuenta(409, "Ya existe un usuario con ese nombre.");

        const std::string clave = insertar_usuario(db_, usuario, consulta.texto_columna(0), rol,
                                                   consulta.texto_columna(1));
        salida = {{"usuario", usuario}, {"clave_temporal", clave}, {"rol", rol}};

        Sentencia s(db_,
                    "UPDATE solicitudes SET estado = 'aprobada', usuario_creado = ?, rol_asignado = ?, "
                    "resuelta_por = ?, resuelta_fecha = ?, resuelta_nota = ? WHERE id = ?");
        s.texto(1, usuario);
        s.texto(2, rol);
        s.texto(3, quien);
        s.texto(4, fecha_iso());
        s.texto(5, nota);
        s.texto(6, id);
        s.ejecutar();
    } else {
        Sentencia s(db_,
                    "UPDATE solicitudes SET estado = 'rechazada', resuelta_por = ?, resuelta_fecha = ?, "
                    "resuelta_nota = ? WHERE id = ?");
        s.texto(1, quien);
        s.texto(2, fecha_iso());
        s.texto(3, nota);
        s.texto(4, id);
        s.ejecutar();
    }

    tx.confirmar();
    return salida;
}
