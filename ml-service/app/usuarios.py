"""Usuarios de la plataforma SENTINEL (acceso a todo lo que no es la landing pública).

Las contraseñas nunca se guardan: se guarda PBKDF2-HMAC-SHA256 con sal aleatoria de 16 bytes y 210.000 iteraciones
(recomendación OWASP), en shared/config/usuarios.json, que no va a git. Crow verifica con el mismo esquema
(crow-service/src/cripto.cpp).

Uso (desde sistema-web/ml-service):
    python -m app.usuarios crear  <usuario> --nombre "Nombre Apellido"   # pide la contraseña sin mostrarla
    python -m app.usuarios clave  <usuario>                               # cambia la contraseña
    python -m app.usuarios listar
    python -m app.usuarios eliminar <usuario>

El nombre es el que queda como responsable en las decisiones de activar o rechazar modelos.
"""
import argparse
import base64
import getpass
import hashlib
import json
import os
import re
import secrets
import sys
import tempfile
from datetime import datetime

from .config import SHARED

RUTA = SHARED / "config" / "usuarios.json"
ITERACIONES = 210_000
MIN_CLAVE = 10


def cifrar(clave: str) -> str:
    sal = secrets.token_bytes(16)
    h = hashlib.pbkdf2_hmac("sha256", clave.encode(), sal, ITERACIONES, dklen=32)
    return f"pbkdf2_sha256${ITERACIONES}${base64.b64encode(sal).decode()}${base64.b64encode(h).decode()}"


def leer() -> dict:
    return json.loads(RUTA.read_text(encoding="utf-8")) if RUTA.exists() else {"usuarios": []}


def guardar(datos: dict) -> None:
    # Escritura atómica y solo legible por el dueño
    RUTA.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=RUTA.parent, suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)
    os.chmod(tmp, 0o600)
    os.replace(tmp, RUTA)


def pedir_clave() -> str:
    clave = getpass.getpass("Contraseña: ")
    if len(clave) < MIN_CLAVE:
        sys.exit(f"La contraseña debe tener al menos {MIN_CLAVE} caracteres.")
    if getpass.getpass("Repita la contraseña: ") != clave:
        sys.exit("Las contraseñas no coinciden.")
    return clave


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="accion", required=True)
    c = sub.add_parser("crear"); c.add_argument("usuario"); c.add_argument("--nombre", required=True)
    sub.add_parser("clave").add_argument("usuario")
    sub.add_parser("eliminar").add_argument("usuario")
    sub.add_parser("listar")
    a = ap.parse_args()
    datos = leer()
    por_usuario = {u["usuario"]: u for u in datos["usuarios"]}

    if a.accion == "listar":
        for u in datos["usuarios"]:
            print(f"{u['usuario']:20} {u['nombre']:30} creado {u['creado']}")
        if not datos["usuarios"]:
            print("No hay usuarios. Cree uno con: python -m app.usuarios crear <usuario> --nombre \"...\"")
        return
    if a.accion == "crear":
        if not re.fullmatch(r"[a-z0-9._-]{3,32}", a.usuario):
            sys.exit("Usuario: 3 a 32 caracteres en minúscula (letras, números, punto, guion o guion bajo).")
        if a.usuario in por_usuario:
            sys.exit(f"Ya existe el usuario {a.usuario}. Para cambiar su contraseña: python -m app.usuarios clave {a.usuario}")
        datos["usuarios"].append({"usuario": a.usuario, "nombre": a.nombre.strip(), "hash": cifrar(pedir_clave()),
                                  "creado": datetime.now().isoformat(timespec="seconds")})
        guardar(datos)
        print(f"Usuario {a.usuario} creado. Crow lo reconoce sin reiniciar.")
    elif a.accion == "clave":
        if a.usuario not in por_usuario:
            sys.exit(f"No existe el usuario {a.usuario}.")
        por_usuario[a.usuario]["hash"] = cifrar(pedir_clave())
        guardar(datos)
        print("Contraseña actualizada. Las sesiones abiertas de ese usuario siguen vigentes hasta que expiren (8 h).")
    elif a.accion == "eliminar":
        datos["usuarios"] = [u for u in datos["usuarios"] if u["usuario"] != a.usuario]
        guardar(datos)
        print(f"Usuario {a.usuario} eliminado.")


if __name__ == "__main__":
    main()
