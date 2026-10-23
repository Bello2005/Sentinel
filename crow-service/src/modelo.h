// Inferencia con ONNX Runtime sobre el modelo activo de shared/models/registry.json.
//
// El modelo se carga una vez y se reutiliza (nunca se entrena al predecir). Si Python activa otra versión,
// GestorModelo lo nota en la siguiente petición y carga la nueva; las peticiones en curso terminan con la anterior.
#pragma once

#include <onnxruntime_cxx_api.h>

#include <filesystem>
#include <memory>
#include <mutex>
#include <nlohmann/json.hpp>
#include <string>
#include <vector>

#include "tabla.h"

using json = nlohmann::json;

class Modelo {
public:
    Modelo(Ort::Env& env, const std::filesystem::path& carpeta);
    const std::string& version() const { return version_; }
    const json& metadata() const { return meta_; }
    // Predice todas las filas. La tabla ya debe haber pasado la validación (sin errores).
    std::vector<float> predecir(const Tabla& t) const;
    // ± puntos del intervalo de 80 % según tipo de unidad y estudiantes del último año (de metadata.json)
    double intervalo(const std::string& tipo_unidad, double estudiantes) const;

private:
    std::string version_;
    json meta_;
    std::vector<std::string> entradas_;
    std::string salida_;
    std::unique_ptr<Ort::Session> sesion_;
};

class GestorModelo {
public:
    explicit GestorModelo(std::filesystem::path shared);
    // Modelo activo (lo recarga si registry.json cambió). Lanza runtime_error si no hay modelo activo.
    std::shared_ptr<const Modelo> activo();
    json registro() const;

private:
    std::filesystem::path shared_;
    Ort::Env env_{ORT_LOGGING_LEVEL_WARNING, "saber11"};
    std::mutex mutex_;
    std::shared_ptr<const Modelo> modelo_;
};

json leer_json(const std::filesystem::path& ruta);
