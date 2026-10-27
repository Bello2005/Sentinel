#include "entrenamiento.h"

#include <array>
#include <cstdio>
#include <stdexcept>
#ifdef _WIN32
    #include <windows.h>
    #include <process.h>
    #define pclose _pclose
    #define popen _popen
#else
    #include <sys/wait.h>
#endif

namespace {

// Comillas simples para sh: ' se escribe '\''
std::string comillas(const std::string& s) {
    std::string r = "'";
    for (char c : s) r += c == '\'' ? std::string("'\\''") : std::string(1, c);
    return r + "'";
}

}  // namespace

Entrenamiento::Entrenamiento(std::filesystem::path python, std::filesystem::path ml_service)
    : python_(std::move(python)), ml_service_(std::move(ml_service)) {}

json Entrenamiento::ejecutar(const std::string& modulo, const std::vector<std::string>& args, const std::filesystem::path& log) {
    std::lock_guard<std::mutex> lock(mutex_);  // un entrenamiento a la vez
    std::string cmd = "cd " + comillas(ml_service_.string()) + " && " + comillas(python_.string()) + " -m app." + modulo;
    for (const auto& a : args) cmd += " " + comillas(a);
    cmd += " 2>> " + comillas(log.string());  // avisos y trazas de Python van al log, no al usuario

    FILE* p = popen(cmd.c_str(), "r");
    if (!p) throw std::runtime_error("No se pudo iniciar el servicio de entrenamiento.");
    std::string salida;
    std::array<char, 4096> buf;
    while (size_t n = fread(buf.data(), 1, buf.size(), p)) salida.append(buf.data(), n);
    const int estado = pclose(p);

    json r;
    try {
        r = json::parse(salida.substr(salida.find('{')));
    } catch (const std::exception&) {
        throw std::runtime_error("El servicio de entrenamiento falló sin dar detalles (revise " + log.filename().string() + ").");
    }
    if (r.contains("error")) throw std::runtime_error(r["error"].get<std::string>());
#ifdef _WIN32
    if(estado != 0) throw std::runtime_error("El servicio de entrenamiento terminó con error.");
#else
    if (!WIFEXITED(estado) || WEXITSTATUS(estado) != 0) throw std::runtime_error("El servicio de entrenamiento terminó con error.");
#endif
    return r;
}
