"""Usuarios de la plataforma SENTINEL (acceso a todo lo que no es la landing pública).

Las contraseñas nunca se guardan: se guarda PBKDF2-HMAC-SHA256 con sal aleatoria de 16 bytes y 210.000 iteraciones
(recomendación OWASP), en shared/config/sentinel.db, que no va a git. Crow usa el mismo esquema
(crow-service/src/database.cpp y cripto.cpp).

Uso (desde sistema-web/ml-service):
    python -m app.usuarios crear  <usuario> --nombre "Nombre Apellido" [--rol admin|colaborador|descarga]
                                                                          # pide la contraseña sin mostrarla
    python -m app.usuarios clave  <usuario>                               # cambia la contraseña
    python -m app.usuarios listar
    python -m app.usuarios eliminar <usuario>

El nombre es el que queda como responsable en las decisiones de activar o rechazar modelos.
Roles: admin (todo, incluida la administración y la decisión sobre versiones), colaborador (valida, explora, predice y
entrena candidatas, pero no las activa) y descarga (solo descarga el modelo). Sin --rol, la cuenta es admin.
Las solicitudes de acceso que llegan desde /acceso las aprueba un admin en la plataforma (Administración).
"""
import argparse
import base64
import getpass
import hashlib
import os
import re
import secrets
import sqlite3
import sys
from datetime import datetime

from .config import SHARED

RUTA = SHARED / "config" / "sentinel.db"
ITERACIONES = 210_000
MIN_CLAVE = 10
ROLES = ("admin", "colaborador", "descarga")

ESQUEMA = """
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT NOT NULL COLLATE NOCASE UNIQUE,
    nombre TEXT NOT NULL,
    correo TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
    organizacion TEXT NOT NULL DEFAULT '',
    rol TEXT NOT NULL DEFAULT 'admin' CHECK (rol IN ('admin', 'colaborador', 'descarga')),
    hash TEXT NOT NULL,
    debe_cambiar INTEGER NOT NULL DEFAULT 1 CHECK (debe_cambiar IN (0, 1)),
    creado TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);

CREATE TABLE IF NOT EXISTS solicitudes (
    id TEXT PRIMARY KEY,
    fecha TEXT NOT NULL,
    nombre TEXT NOT NULL,
    correo TEXT NOT NULL COLLATE NOCASE,
    organizacion TEXT NOT NULL DEFAULT '',
    tipo TEXT NOT NULL CHECK (tipo IN ('colaborador', 'descarga')),
    motivo TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
    usuario_creado TEXT,
    rol_asignado TEXT,
    resuelta_por TEXT,
    resuelta_fecha TEXT,
    resuelta_nota TEXT
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_correo ON solicitudes(correo);
"""


def cifrar(clave: str) -> str:
    sal = secrets.token_bytes(16)
    h = hashlib.pbkdf2_hmac("sha256", clave.encode(), sal, ITERACIONES, dklen=32)
    return f"pbkdf2_sha256${ITERACIONES}${base64.b64encode(sal).decode()}${base64.b64encode(h).decode()}"


def conectar() -> sqlite3.Connection:
    RUTA.parent.mkdir(parents=True, exist_ok=True)
    nueva = not RUTA.exists()
    db = sqlite3.connect(RUTA)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA busy_timeout = 5000")
    db.execute("PRAGMA journal_mode = WAL")
    db.executescript(ESQUEMA)
    if nueva:
        os.chmod(RUTA, 0o600)
    return db


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
    c.add_argument("--rol", choices=ROLES, default="admin")
    sub.add_parser("clave").add_argument("usuario")
    sub.add_parser("eliminar").add_argument("usuario")
    sub.add_parser("listar")
    a = ap.parse_args()

    with conectar() as db:
        if a.accion == "listar":
            filas = db.execute("SELECT usuario, nombre, rol, creado FROM usuarios ORDER BY nombre COLLATE NOCASE").fetchall()
            for u in filas:
                print(f"{u['usuario']:20} {u['nombre']:30} {u['rol']:12} creado {u['creado']}")
            if not filas:
                print("No hay usuarios. Cree uno con: python -m app.usuarios crear <usuario> --nombre \"...\"")
            return

        if a.accion == "crear":
            if not re.fullmatch(r"[a-z0-9._-]{3,32}", a.usuario):
                sys.exit("Usuario: 3 a 32 caracteres en minúscula (letras, números, punto, guion o guion bajo).")
            if db.execute("SELECT 1 FROM usuarios WHERE usuario = ?", (a.usuario,)).fetchone():
                sys.exit(f"Ya existe el usuario {a.usuario}. Para cambiar su contraseña: python -m app.usuarios clave {a.usuario}")
            db.execute(
                "INSERT INTO usuarios (usuario, nombre, rol, hash, debe_cambiar, creado) VALUES (?, ?, ?, ?, 0, ?)",
                (a.usuario, a.nombre.strip(), a.rol, cifrar(pedir_clave()), datetime.now().isoformat(timespec="seconds")),
            )
            print(f"Usuario {a.usuario} creado. Crow lo reconoce sin reiniciar.")

        elif a.accion == "clave":
            u = db.execute("SELECT 1 FROM usuarios WHERE usuario = ?", (a.usuario,)).fetchone()
            if not u:
                sys.exit(f"No existe el usuario {a.usuario}.")
            db.execute(
                "UPDATE usuarios SET hash = ?, debe_cambiar = 0 WHERE usuario = ?",
                (cifrar(pedir_clave()), a.usuario),
            )
            print("Contraseña actualizada. Las sesiones abiertas de ese usuario siguen vigentes hasta que expiren (8 h).")

        elif a.accion == "eliminar":
            u = db.execute("SELECT rol FROM usuarios WHERE usuario = ?", (a.usuario,)).fetchone()
            if not u:
                sys.exit(f"No existe el usuario {a.usuario}.")
            if u["rol"] == "admin":
                admins = db.execute("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'admin'").fetchone()["n"]
                if admins <= 1:
                    sys.exit("Debe quedar al menos un administrador.")
            db.execute("DELETE FROM usuarios WHERE usuario = ?", (a.usuario,))
            print(f"Usuario {a.usuario} eliminado.")


if __name__ == "__main__":
    main()
