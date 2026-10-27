// Coordinación con el servicio de entrenamiento en Python (ml-service): Crow valida y orquesta, Python entrena.
//
// Se ejecuta `python -m app.<modulo> ...` dentro de ml-service/. Todos los argumentos son rutas que genera el propio
// servidor (nunca texto del usuario: la justificación de una decisión viaja en un archivo JSON). Solo corre un
// entrenamiento a la vez. La salida estándar de Python es un JSON; si trae "error", se devuelve ese mensaje.

#pragma once

#include <filesystem>
#include <mutex>
#include <nlohmann/json.hpp>
#include <string>
#include <vector>

using json = nlohmann::json;

class Entrenamiento {
public:
    Entrenamiento(std::filesystem::path python, std::filesystem::path ml_service);
    // Lanza runtime_error con el mensaje de Python (o uno genérico) si el proceso falla
    json ejecutar(const std::string& modulo, const std::vector<std::string>& args, const std::filesystem::path& log);

private:
    std::filesystem::path python_, ml_service_;
    std::mutex mutex_;
};
