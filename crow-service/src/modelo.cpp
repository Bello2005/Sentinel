#include "modelo.h"

#include <array>
#include <fstream>
#include <stdexcept>

json leer_json(const std::filesystem::path& ruta) {
    std::ifstream f(ruta);
    if (!f) throw std::runtime_error("No se encontró " + ruta.filename().string());
    return json::parse(f);
}

Modelo::Modelo(Ort::Env& env, const std::filesystem::path& carpeta) {
    meta_ = leer_json(carpeta / "metadata.json");
    version_ = meta_["version"];
    entradas_ = meta_["variables_predictoras"].get<std::vector<std::string>>();
    if (!meta_["variables_categoricas"].empty())
        throw std::runtime_error("Este backend espera un modelo con entradas numéricas (float32).");
    Ort::SessionOptions op;
    op.SetIntraOpNumThreads(1);
    sesion_ = std::make_unique<Ort::Session>(env, (carpeta / meta_["onnx"]["archivo"].get<std::string>()).c_str(), op);
    Ort::AllocatorWithDefaultOptions alloc;
    salida_ = sesion_->GetOutputNameAllocated(0, alloc).get();
}

std::vector<float> Modelo::predecir(const Tabla& t) const {
    const size_t n = t.filas.size();
    if (n == 0) return {};
    auto mem = Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault);
    const std::array<int64_t, 2> forma{static_cast<int64_t>(n), 1};
    std::vector<std::vector<float>> datos(entradas_.size());  // un buffer por entrada: debe vivir hasta Run()
    std::vector<Ort::Value> tensores;
    std::vector<const char*> nombres;
    for (size_t k = 0; k < entradas_.size(); ++k) {
        const int col = t.indice(entradas_[k]);
        if (col < 0) throw std::runtime_error("Falta la columna " + entradas_[k]);
        datos[k].reserve(n);
        for (size_t i = 0; i < n; ++i) {
            auto v = a_numero(t.celda(i, col));
            if (!v) throw std::runtime_error("Valor no numérico en " + entradas_[k]);  // no pasa si se validó antes
            datos[k].push_back(static_cast<float>(*v));
        }
        tensores.push_back(Ort::Value::CreateTensor<float>(mem, datos[k].data(), n, forma.data(), forma.size()));
        nombres.push_back(entradas_[k].c_str());
    }
    const char* salidas[] = {salida_.c_str()};
    auto res = sesion_->Run(Ort::RunOptions{nullptr}, nombres.data(), tensores.data(), tensores.size(), salidas, 1);
    const float* p = res[0].GetTensorData<float>();
    return {p, p + n};
}

double Modelo::intervalo(const std::string& tipo_unidad, double estudiantes) const {
    const std::string tramo = estudiantes < 10 ? "<10" : estudiantes < 30 ? "10-29" : ">=30";
    const auto& iv = meta_["intervalo_80"];
    if (iv.contains(tipo_unidad) && iv[tipo_unidad].contains(tramo)) return iv[tipo_unidad][tramo].get<double>();
    return std::nan("");
}

GestorModelo::GestorModelo(std::filesystem::path shared) : shared_(std::move(shared)) {}

json GestorModelo::registro() const { return leer_json(shared_ / "models" / "registry.json"); }

std::shared_ptr<const Modelo> GestorModelo::activo() {
    const json reg = registro();
    if (reg["activo"].is_null()) throw std::runtime_error("No hay un modelo activo. Entrene uno con el servicio de Python.");
    const std::string version = reg["activo"];
    std::lock_guard<std::mutex> lock(mutex_);
    if (!modelo_ || modelo_->version() != version)
        modelo_ = std::make_shared<const Modelo>(env_, shared_ / "models" / version);
    return modelo_;
}
