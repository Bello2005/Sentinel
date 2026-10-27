#include "cuentas.h"

#include <algorithm>
#include <ctime>
#include <fstream>
#include <regex>
#include <set>

#include "cripto.h"
#include "reportes.h"

using json = nlohmann::json;
namespace fs = std::filesystem;

namespace {
// Clave ficticia para gastar el mismo tiempo cuando el usuario no existe (no revela qué usuarios hay)
const std::string HASH_FICTICIO = "pbkdf2_sha256$210000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const std::set<std::string> ROLES = {"admin", "colaborador", "descarga"};
const std::set<std::string> TIPOS_SOLICITUD = {"colaborador", "descarga"};
constexpr size_t MAX_PENDIENTES = 300;

std::string rol_de(const json& u) { const std::string r = u.value("rol", "admin"); return ROLES.count(r) ? r : "admin"; }

Usuario desde_json(const json& u) {
    return {u.value("usuario", ""), u.value("nombre", u.value("usuario", "")), rol_de(u), u.value("debe_cambiar", false)};
}

// Texto de un formulario: sin espacios a los lados, sin caracteres de control y con largo acotado
std::string limpio(const json& d, const char* campo, size_t maximo) {
    std::string s = d.contains(campo) && d[campo].is_string() ? d[campo].get<std::string>() : "";
    std::string r;
    for (unsigned char c : s) if (c >= 32 || c == '\n') r += char(c);
    const auto ini = r.find_first_not_of(" \n"), fin = r.find_last_not_of(" \n");
    r = ini == std::string::npos ? "" : r.substr(ini, fin - ini + 1);
    if (r.size() > maximo) throw ErrorCuenta(400, std::string("El campo «") + campo + "» es demasiado largo.");
    return r;
}

json* buscar_en(json& datos, const char* lista, const char* campo, const std::string& valor) {
    for (auto& x : datos[lista]) if (x.value(campo, "") == valor) return &x;
    return nullptr;
}

size_t admins(const json& datos) {
    size_t n = 0;
    for (const auto& u : datos["usuarios"]) if (rol_de(u) == "admin") ++n;
    return n;
}
}  // namespace

bool rol_valido(const std::string& rol) { return ROLES.count(rol) > 0; }
bool usuario_valido(const std::string& u) { return std::regex_match(u, std::regex("^[a-z0-9._-]{3,32}$")); }

Cuentas::Cuentas(fs::path usuarios, fs::path solicitudes) : usuarios_(std::move(usuarios)), solicitudes_(std::move(solicitudes)) {}

json Cuentas::leer(const fs::path& archivo, const char* lista) {
    json d = json::object();
    if (std::ifstream f(archivo); f) {
        try { d = json::parse(f); } catch (...) { throw ErrorCuenta(500, "El archivo de cuentas está dañado. Revíselo en el servidor."); }
    }
    if (!d.is_object()) d = json::object();
    if (!d.contains(lista) || !d[lista].is_array()) d[lista] = json::array();
    return d;
}

// Escritura atómica (archivo temporal + rename) y solo legible por el dueño del proceso
void Cuentas::guardar(const fs::path& archivo, const json& datos) {
    fs::create_directories(archivo.parent_path());
    const fs::path tmp = archivo.string() + ".tmp";
    {
        std::ofstream f(tmp, std::ios::trunc);
        if (!f) throw ErrorCuenta(500, "No se pudo guardar el archivo de cuentas.");
        f << datos.dump(2);
    }
    fs::permissions(tmp, fs::perms::owner_read | fs::perms::owner_write, fs::perm_options::replace);
    fs::rename(tmp, archivo);
}

// --- Usuarios ---------------------------------------------------------------------------------------------------
std::optional<Usuario> Cuentas::verificar(const std::string& usuario, const std::string& clave) {
    json datos;
    { std::lock_guard<std::mutex> l(mutex_); datos = leer(usuarios_, "usuarios"); }
    const json* u = buscar_en(datos, "usuarios", "usuario", usuario);
    const bool ok = cripto::verificar_clave(clave, u ? u->value("hash", "") : HASH_FICTICIO);
    if (!u || !ok) return std::nullopt;
    return desde_json(*u);
}

std::optional<Usuario> Cuentas::buscar(const std::string& usuario) {
    std::lock_guard<std::mutex> l(mutex_);
    json datos = leer(usuarios_, "usuarios");
    const json* u = buscar_en(datos, "usuarios", "usuario", usuario);
    if (!u) return std::nullopt;
    return desde_json(*u);
}

size_t Cuentas::cantidad_usuarios() {
    std::lock_guard<std::mutex> l(mutex_);
    try { return leer(usuarios_, "usuarios")["usuarios"].size(); } catch (...) { return 0; }
}

json Cuentas::listar_usuarios() {
    std::lock_guard<std::mutex> l(mutex_);
    json salida = json::array();
    const json datos = leer(usuarios_, "usuarios");  // en una variable: recorrer un temporal dejaría referencias colgando
    for (const auto& u : datos["usuarios"])
        salida.push_back({{"usuario", u.value("usuario", "")}, {"nombre", u.value("nombre", "")}, {"rol", rol_de(u)},
                          {"correo", u.value("correo", "")}, {"creado", u.value("creado", "")}, {"debe_cambiar", u.value("debe_cambiar", false)}});
    return salida;
}

std::string Cuentas::crear_sin_bloqueo(json& datos, const std::string& usuario, const std::string& nombre, const std::string& rol,
                                       const std::string& correo) {
    if (!usuario_valido(usuario)) throw ErrorCuenta(400, "El usuario debe tener de 3 a 32 caracteres: letras minúsculas, números, punto o guion.");
    if (!rol_valido(rol)) throw ErrorCuenta(400, "Rol no válido.");
    if (nombre.size() < 3) throw ErrorCuenta(400, "Escriba el nombre de la persona.");
    if (buscar_en(datos, "usuarios", "usuario", usuario)) throw ErrorCuenta(409, "Ya existe un usuario con ese nombre.");
    const std::string clave = cripto::clave_temporal();
    datos["usuarios"].push_back({{"usuario", usuario}, {"nombre", nombre}, {"rol", rol}, {"correo", correo},
                                 {"hash", cripto::cifrar_clave(clave)}, {"debe_cambiar", true}, {"creado", ahora_iso()}});
    return clave;
}

std::string Cuentas::crear_usuario(const std::string& usuario, const std::string& nombre, const std::string& rol, const std::string& correo) {
    std::lock_guard<std::mutex> l(mutex_);
    json datos = leer(usuarios_, "usuarios");
    const std::string clave = crear_sin_bloqueo(datos, usuario, nombre, rol, correo);
    guardar(usuarios_, datos);
    return clave;
}

void Cuentas::cambiar_rol(const std::string& usuario, const std::string& rol, const std::string& quien) {
    if (!rol_valido(rol)) throw ErrorCuenta(400, "Rol no válido.");
    std::lock_guard<std::mutex> l(mutex_);
    json datos = leer(usuarios_, "usuarios");
    json* u = buscar_en(datos, "usuarios", "usuario", usuario);
    if (!u) throw ErrorCuenta(404, "No existe ese usuario.");
    if (usuario == quien) throw ErrorCuenta(400, "No puede cambiar su propio rol.");
    if (rol_de(*u) == "admin" && rol != "admin" && admins(datos) <= 1) throw ErrorCuenta(400, "Debe quedar al menos un administrador.");
    (*u)["rol"] = rol;
    guardar(usuarios_, datos);
}

void Cuentas::eliminar(const std::string& usuario, const std::string& quien) {
    std::lock_guard<std::mutex> l(mutex_);
    json datos = leer(usuarios_, "usuarios");
    json* u = buscar_en(datos, "usuarios", "usuario", usuario);
    if (!u) throw ErrorCuenta(404, "No existe ese usuario.");
    if (usuario == quien) throw ErrorCuenta(400, "No puede eliminar su propia cuenta.");
    if (rol_de(*u) == "admin" && admins(datos) <= 1) throw ErrorCuenta(400, "Debe quedar al menos un administrador.");
    auto& lista = datos["usuarios"];
    for (auto it = lista.begin(); it != lista.end(); ++it)
        if (it->value("usuario", "") == usuario) { lista.erase(it); break; }
    guardar(usuarios_, datos);
}

std::string Cuentas::restablecer(const std::string& usuario) {
    std::lock_guard<std::mutex> l(mutex_);
    json datos = leer(usuarios_, "usuarios");
    json* u = buscar_en(datos, "usuarios", "usuario", usuario);
    if (!u) throw ErrorCuenta(404, "No existe ese usuario.");
    const std::string clave = cripto::clave_temporal();
    (*u)["hash"] = cripto::cifrar_clave(clave);
    (*u)["debe_cambiar"] = true;
    guardar(usuarios_, datos);
    return clave;
}

void Cuentas::cambiar_clave(const std::string& usuario, const std::string& actual, const std::string& nueva) {
    if (nueva.size() < MIN_CLAVE) throw ErrorCuenta(400, "La contraseña nueva debe tener al menos 10 caracteres.");
    if (nueva.size() > 200) throw ErrorCuenta(400, "La contraseña nueva es demasiado larga.");
    if (nueva == actual) throw ErrorCuenta(400, "La contraseña nueva debe ser distinta de la actual.");
    std::lock_guard<std::mutex> l(mutex_);
    json datos = leer(usuarios_, "usuarios");
    json* u = buscar_en(datos, "usuarios", "usuario", usuario);
    if (!u) throw ErrorCuenta(404, "No existe ese usuario.");
    if (!cripto::verificar_clave(actual, u->value("hash", ""))) throw ErrorCuenta(400, "La contraseña actual no es correcta.");
    (*u)["hash"] = cripto::cifrar_clave(nueva);
    (*u)["debe_cambiar"] = false;
    guardar(usuarios_, datos);
}

// --- Solicitudes ------------------------------------------------------------------------------------------------
void Cuentas::crear_solicitud(const json& d) {
    const std::string nombre = limpio(d, "nombre", 80), correo = limpio(d, "correo", 120), organizacion = limpio(d, "organizacion", 120),
                      tipo = limpio(d, "tipo", 20), motivo = limpio(d, "motivo", 1500);
    if (nombre.size() < 3) throw ErrorCuenta(400, "Escriba su nombre completo.");
    if (!std::regex_match(correo, std::regex(R"(^[^@\s]+@[^@\s]+\.[^@\s]{2,}$)"))) throw ErrorCuenta(400, "Escriba un correo válido.");
    if (!TIPOS_SOLICITUD.count(tipo)) throw ErrorCuenta(400, "Elija qué tipo de acceso necesita.");
    if (motivo.size() < 30) throw ErrorCuenta(400, "Cuéntenos un poco más por qué necesita el acceso (al menos 30 caracteres).");
    std::lock_guard<std::mutex> l(mutex_);
    json datos = leer(solicitudes_, "solicitudes");
    size_t pendientes = 0;
    for (const auto& s : datos["solicitudes"]) {
        if (s.value("estado", "") != "pendiente") continue;
        ++pendientes;
        if (s.value("correo", "") == correo) throw ErrorCuenta(409, "Ya hay una solicitud pendiente con ese correo. El equipo la revisará pronto.");
    }
    if (pendientes >= MAX_PENDIENTES) throw ErrorCuenta(503, "Hay demasiadas solicitudes pendientes. Intente más tarde.");
    datos["solicitudes"].push_back({{"id", cripto::hex(cripto::aleatorio(8))}, {"fecha", ahora_iso()}, {"nombre", nombre}, {"correo", correo},
                                    {"organizacion", organizacion}, {"tipo", tipo}, {"motivo", motivo}, {"estado", "pendiente"}});
    guardar(solicitudes_, datos);
}

json Cuentas::listar_solicitudes() {
    std::lock_guard<std::mutex> l(mutex_);
    json lista = leer(solicitudes_, "solicitudes")["solicitudes"];
    // Las más recientes primero
    std::reverse(lista.begin(), lista.end());
    return lista;
}

json Cuentas::resolver(const std::string& id, bool aprobar, const std::string& rol, const std::string& usuario, const std::string& nota,
                       const std::string& quien) {
    if (nota.size() > 500) throw ErrorCuenta(400, "La nota es demasiado larga.");
    std::lock_guard<std::mutex> l(mutex_);
    json sols = leer(solicitudes_, "solicitudes");
    json* s = buscar_en(sols, "solicitudes", "id", id);
    if (!s) throw ErrorCuenta(404, "No existe esa solicitud.");
    if (s->value("estado", "") != "pendiente") throw ErrorCuenta(409, "Esa solicitud ya fue resuelta.");
    json salida = json::object();
    if (aprobar) {
        if (rol != "colaborador" && rol != "descarga") throw ErrorCuenta(400, "Elija el rol: colaborador o descarga.");
        json usuarios = leer(usuarios_, "usuarios");
        const std::string clave = crear_sin_bloqueo(usuarios, usuario, s->value("nombre", ""), rol, s->value("correo", ""));
        guardar(usuarios_, usuarios);
        salida = {{"usuario", usuario}, {"clave_temporal", clave}, {"rol", rol}};
        (*s)["usuario_creado"] = usuario;
        (*s)["rol_asignado"] = rol;
    }
    (*s)["estado"] = aprobar ? "aprobada" : "rechazada";
    (*s)["resuelta"] = {{"por", quien}, {"fecha", ahora_iso()}, {"nota", nota}};
    guardar(solicitudes_, sols);
    return salida;
}

bool Limitador::permitir(const std::string& clave) {
    std::lock_guard<std::mutex> l(mutex_);
    auto& cola = eventos_[clave];
    const auto ahora = std::chrono::steady_clock::now();
    while (!cola.empty() && ahora - cola.front() > ventana_) cola.pop_front();
    if (cola.size() >= maximo_) return false;
    cola.push_back(ahora);
    return true;
}
