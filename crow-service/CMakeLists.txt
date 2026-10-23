cmake_minimum_required(VERSION 3.20)
project(saber11_crow CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

# Dependencias en sistema-web/vendor (descargadas, no van a git). En el servidor se puede apuntar a otra ruta:
#   cmake -DVENDOR=/opt/vendor ..
set(VENDOR "${CMAKE_CURRENT_SOURCE_DIR}/../vendor" CACHE PATH "Carpeta con crow, asio, onnxruntime e include")
set(ORT_DIR "${VENDOR}/onnxruntime")

find_package(Threads REQUIRED)
add_library(dependencias INTERFACE)
target_include_directories(dependencias INTERFACE
  "${VENDOR}/crow/include" "${VENDOR}/asio/asio/include" "${VENDOR}/include" "${ORT_DIR}/include")
target_compile_definitions(dependencias INTERFACE ASIO_STANDALONE)
find_library(ORT_LIB onnxruntime PATHS "${ORT_DIR}/lib" NO_DEFAULT_PATH REQUIRED)
target_link_libraries(dependencias INTERFACE ${ORT_LIB} Threads::Threads)

# Prueba de humo: carga el modelo activo, predice las primeras filas de un CSV y las compara con scikit-learn
add_executable(prueba_onnx src/prueba_onnx.cpp)
target_link_libraries(prueba_onnx PRIVATE dependencias)
set_target_properties(prueba_onnx PROPERTIES BUILD_RPATH "${ORT_DIR}/lib")

# Servidor de la API
add_executable(saber11_api src/main.cpp src/tabla.cpp src/validador.cpp src/modelo.cpp src/reportes.cpp
               src/eda.cpp src/reporte_eda.cpp src/entrenamiento.cpp)
target_link_libraries(saber11_api PRIVATE dependencias)
set_target_properties(saber11_api PROPERTIES BUILD_RPATH "${ORT_DIR}/lib")
