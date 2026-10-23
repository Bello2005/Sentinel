// Prueba de humo del entorno C++: Crow compila, ONNX Runtime carga el modelo activo y predice.
//
// Uso: prueba_onnx <ruta a shared/> <csv> [filas]
// Lee shared/models/registry.json para saber la versión activa, toma su metadata.json (orden y tipo de las
// entradas) y predice las primeras filas del CSV. Imprime código y predicción para compararlas con Python.
#include <crow.h>  // solo para comprobar que Crow + Asio compilan en esta máquina

#include <onnxruntime_cxx_api.h>
#include <rapidcsv.h>

#include <fstream>
#include <iostream>
#include <nlohmann/json.hpp>
#include <string>
#include <vector>

using json = nlohmann::json;

static json leer_json(const std::string& ruta) {
    std::ifstream f(ruta);
    if (!f) throw std::runtime_error("No se pudo abrir " + ruta);
    return json::parse(f);
}

int main(int argc, char** argv) {
    if (argc < 3) {
        std::cerr << "Uso: prueba_onnx <ruta a shared/> <csv> [filas]\n";
        return 1;
    }
    const std::string shared = argv[1], csv = argv[2];
    const size_t filas = argc > 3 ? std::stoul(argv[3]) : 5;

    json registro = leer_json(shared + "/models/registry.json");
    const std::string version = registro["activo"];
    json meta = leer_json(shared + "/models/" + version + "/metadata.json");
    std::cout << "Modelo activo: " << version << " (" << meta["algoritmo"].get<std::string>() << ")\n";

    // Las columnas de texto (códigos con ceros a la izquierda) se leen como string
    rapidcsv::Document doc(csv, rapidcsv::LabelParams(0, -1));
    const size_t n = std::min(filas, doc.GetRowCount());

    Ort::Env env(ORT_LOGGING_LEVEL_WARNING, "saber11");
    Ort::Session sesion(env, (shared + "/models/" + version + "/modelo.onnx").c_str(), Ort::SessionOptions{});
    Ort::AllocatorWithDefaultOptions alloc;
    auto mem = Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault);

    // Una entrada por variable predictora, en el orden de metadata.json: texto [n,1] o float [n,1]
    std::vector<std::string> nombres = meta["variables_predictoras"];
    std::vector<std::string> categoricas = meta["variables_categoricas"];
    std::vector<Ort::Value> tensores;
    std::vector<std::vector<float>> numeros;  // mantiene vivos los buffers de los tensores float
    numeros.reserve(nombres.size());
    const std::array<int64_t, 2> forma{static_cast<int64_t>(n), 1};
    for (const auto& nom : nombres) {
        auto col = doc.GetColumn<std::string>(nom);
        if (std::find(categoricas.begin(), categoricas.end(), nom) != categoricas.end()) {
            Ort::Value t = Ort::Value::CreateTensor(alloc, forma.data(), forma.size(), ONNX_TENSOR_ELEMENT_DATA_TYPE_STRING);
            std::vector<const char*> ptr;
            for (size_t i = 0; i < n; ++i) ptr.push_back(col[i].c_str());
            t.FillStringTensor(ptr.data(), n);
            tensores.push_back(std::move(t));
        } else {
            auto& v = numeros.emplace_back();
            for (size_t i = 0; i < n; ++i) v.push_back(std::stof(col[i]));
            tensores.push_back(Ort::Value::CreateTensor<float>(mem, v.data(), v.size(), forma.data(), forma.size()));
        }
    }
    std::vector<const char*> entradas;
    for (const auto& nom : nombres) entradas.push_back(nom.c_str());
    auto salida_nombre = sesion.GetOutputNameAllocated(0, alloc);
    const char* salidas[] = {salida_nombre.get()};

    auto res = sesion.Run(Ort::RunOptions{nullptr}, entradas.data(), tensores.data(), tensores.size(), salidas, 1);
    const float* pred = res[0].GetTensorData<float>();
    auto codigos = doc.GetColumn<std::string>("codigo");
    for (size_t i = 0; i < n; ++i) std::cout << codigos[i] << "," << pred[i] << "\n";
    return 0;
}
