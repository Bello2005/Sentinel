// Criptografía mínima para la autenticación, sin dependencias externas: SHA-256, HMAC-SHA256, PBKDF2-HMAC-SHA256
// (el mismo esquema que hashlib.pbkdf2_hmac de Python, con el que ml-service/app/usuarios.py crea las claves),
// comparación en tiempo constante y bytes aleatorios del sistema operativo para los tokens de sesión.
#pragma once

#include <array>
#include <cstdint>
#include <string>
#include <vector>

namespace cripto {

using Bytes = std::vector<uint8_t>;

std::array<uint8_t, 32> sha256(const uint8_t* datos, size_t n);
Bytes hmac_sha256(const Bytes& clave, const Bytes& mensaje);
Bytes pbkdf2_sha256(const std::string& clave, const Bytes& sal, uint32_t iteraciones, size_t largo);

bool iguales(const Bytes& a, const Bytes& b);        // tiempo constante
Bytes aleatorio(size_t n);                           // /dev/urandom
std::string hex(const Bytes& b);
Bytes desde_base64(const std::string& texto);        // lanza std::runtime_error si no es base64 válido
std::string a_base64(const Bytes& b);                // base64 estándar con relleno

// Verifica una clave contra "pbkdf2_sha256$<iteraciones>$<sal_base64>$<hash_base64>"
bool verificar_clave(const std::string& clave, const std::string& almacenado);
// Cifra una clave nueva con sal aleatoria: el mismo formato que ml-service/app/usuarios.py
std::string cifrar_clave(const std::string& clave);
// Clave temporal legible (sin caracteres que se confundan, como 0/O o 1/l), para entregarla a mano
std::string clave_temporal(size_t largo = 16);

}  // namespace cripto
