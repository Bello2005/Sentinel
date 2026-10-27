#include "cripto.h"

#include <cstring>
#include <fstream>
#include <sstream>
#include <stdexcept>

namespace cripto {
namespace {

constexpr uint32_t K[64] = {
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
    0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
    0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2};

inline uint32_t rotr(uint32_t x, int n) { return (x >> n) | (x << (32 - n)); }

void bloque(uint32_t h[8], const uint8_t* p) {
    uint32_t w[64];
    for (int i = 0; i < 16; ++i) w[i] = uint32_t(p[4 * i]) << 24 | uint32_t(p[4 * i + 1]) << 16 | uint32_t(p[4 * i + 2]) << 8 | p[4 * i + 3];
    for (int i = 16; i < 64; ++i) {
        const uint32_t s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >> 3);
        const uint32_t s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >> 10);
        w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }
    uint32_t a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (int i = 0; i < 64; ++i) {
        const uint32_t t1 = hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i];
        const uint32_t t2 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c));
        hh = g; g = f; f = e; e = d + t1; d = c; c = b; b = a; a = t1 + t2;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
}

}  // namespace

std::array<uint8_t, 32> sha256(const uint8_t* datos, size_t n) {
    uint32_t h[8] = {0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19};
    size_t i = 0;
    for (; i + 64 <= n; i += 64) bloque(h, datos + i);
    uint8_t resto[128] = {0};
    const size_t r = n - i;
    std::memcpy(resto, datos + i, r);
    resto[r] = 0x80;
    const size_t total = r + 9 <= 64 ? 64 : 128;
    const uint64_t bits = uint64_t(n) * 8;
    for (int k = 0; k < 8; ++k) resto[total - 1 - k] = uint8_t(bits >> (8 * k));
    for (size_t j = 0; j < total; j += 64) bloque(h, resto + j);
    std::array<uint8_t, 32> salida{};
    for (int k = 0; k < 8; ++k)
        for (int j = 0; j < 4; ++j) salida[4 * k + j] = uint8_t(h[k] >> (24 - 8 * j));
    return salida;
}

Bytes hmac_sha256(const Bytes& clave, const Bytes& mensaje) {
    Bytes k = clave;
    if (k.size() > 64) { auto d = sha256(k.data(), k.size()); k.assign(d.begin(), d.end()); }
    k.resize(64, 0);
    Bytes interno(64 + mensaje.size()), externo(64 + 32);
    for (int i = 0; i < 64; ++i) { interno[i] = k[i] ^ 0x36; externo[i] = k[i] ^ 0x5c; }
    std::memcpy(interno.data() + 64, mensaje.data(), mensaje.size());
    auto d1 = sha256(interno.data(), interno.size());
    std::memcpy(externo.data() + 64, d1.data(), 32);
    auto d2 = sha256(externo.data(), externo.size());
    return Bytes(d2.begin(), d2.end());
}

Bytes pbkdf2_sha256(const std::string& clave, const Bytes& sal, uint32_t iteraciones, size_t largo) {
    const Bytes k(clave.begin(), clave.end());
    Bytes salida;
    for (uint32_t bloque_i = 1; salida.size() < largo; ++bloque_i) {
        Bytes m = sal;
        m.push_back(uint8_t(bloque_i >> 24)); m.push_back(uint8_t(bloque_i >> 16));
        m.push_back(uint8_t(bloque_i >> 8)); m.push_back(uint8_t(bloque_i));
        Bytes u = hmac_sha256(k, m), t = u;
        for (uint32_t it = 1; it < iteraciones; ++it) {
            u = hmac_sha256(k, u);
            for (size_t j = 0; j < t.size(); ++j) t[j] ^= u[j];
        }
        salida.insert(salida.end(), t.begin(), t.end());
    }
    salida.resize(largo);
    return salida;
}

bool iguales(const Bytes& a, const Bytes& b) {
    if (a.size() != b.size()) return false;
    uint8_t dif = 0;
    for (size_t i = 0; i < a.size(); ++i) dif |= a[i] ^ b[i];
    return dif == 0;
}

Bytes aleatorio(size_t n) {
    Bytes b(n);
    std::ifstream f("/dev/urandom", std::ios::binary);
    if (!f.read(reinterpret_cast<char*>(b.data()), n)) throw std::runtime_error("No se pudo leer /dev/urandom");
    return b;
}

std::string hex(const Bytes& b) {
    static const char* d = "0123456789abcdef";
    std::string s;
    for (uint8_t x : b) { s += d[x >> 4]; s += d[x & 15]; }
    return s;
}

Bytes desde_base64(const std::string& texto) {
    auto valor = [](char c) -> int {
        if (c >= 'A' && c <= 'Z') return c - 'A';
        if (c >= 'a' && c <= 'z') return c - 'a' + 26;
        if (c >= '0' && c <= '9') return c - '0' + 52;
        if (c == '+' || c == '-') return 62;
        if (c == '/' || c == '_') return 63;
        return -1;
    };
    Bytes b;
    uint32_t acc = 0;
    int bits = 0;
    for (char c : texto) {
        if (c == '=') break;
        const int v = valor(c);
        if (v < 0) throw std::runtime_error("base64 inválido");
        acc = (acc << 6) | uint32_t(v);
        bits += 6;
        if (bits >= 8) { bits -= 8; b.push_back(uint8_t(acc >> bits)); }
    }
    return b;
}

bool verificar_clave(const std::string& clave, const std::string& almacenado) {
    std::vector<std::string> partes;
    std::stringstream ss(almacenado);
    for (std::string p; std::getline(ss, p, '$');) partes.push_back(p);
    if (partes.size() != 4 || partes[0] != "pbkdf2_sha256") return false;
    try {
        const uint32_t it = uint32_t(std::stoul(partes[1]));
        const Bytes sal = desde_base64(partes[2]), esperado = desde_base64(partes[3]);
        if (it < 10000 || esperado.empty()) return false;
        return iguales(pbkdf2_sha256(clave, sal, it, esperado.size()), esperado);
    } catch (const std::exception&) {
        return false;
    }
}

}  // namespace cripto
