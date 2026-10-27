// Cuentas: solicitudes de acceso (públicas), administración de usuarios (solo admin) y descargas del modelo.
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, firstValueFrom, throwError } from 'rxjs';

import { Rol, mensaje } from './sesion';

export type TipoSolicitud = 'colaborador' | 'descarga';
export interface NuevaSolicitud { nombre: string; correo: string; organizacion: string; tipo: TipoSolicitud; motivo: string; sitio_web: string }
export interface Solicitud {
  id: string; fecha: string; nombre: string; correo: string; organizacion: string; tipo: TipoSolicitud; motivo: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada'; usuario_creado?: string; rol_asignado?: Rol;
  resuelta?: { por: string; fecha: string; nota: string };
}
export interface UsuarioCuenta { usuario: string; nombre: string; rol: Rol; correo: string; creado: string; debe_cambiar: boolean }
export interface ClaveEntregada { usuario: string; clave_temporal: string; rol?: Rol }
export interface ArchivoDescarga { nombre: string; descripcion: string; bytes: number }
export interface FichaDescarga {
  version: string; fecha_entrenamiento: string; algoritmo: string; variables: string[]; registros: number;
  validacion: { mae_choco?: number; mae_pais?: number; lineas_base?: { promedio_3_mae_choco?: number; persistencia_mae_choco?: number } };
  intervalo_80: Record<string, Record<string, number>>; archivos: ArchivoDescarga[];
}

@Injectable({ providedIn: 'root' })
export class Cuentas {
  private http = inject(HttpClient);

  private pedir<T>(o: Observable<T>, porDefecto: string) {
    return firstValueFrom(o.pipe(catchError((e: HttpErrorResponse) => throwError(() => new Error(mensaje(e, porDefecto))))));
  }

  solicitar(s: NuevaSolicitud) { return this.pedir(this.http.post('/api/auth/solicitud', s), 'No se pudo enviar la solicitud.'); }

  solicitudes() { return this.pedir(this.http.get<{ solicitudes: Solicitud[]; pendientes: number }>('/api/admin/solicitudes'), 'No se pudieron cargar las solicitudes.'); }
  aprobar(id: string, rol: TipoSolicitud, usuario: string, nota: string) {
    return this.pedir(this.http.post<ClaveEntregada>(`/api/admin/solicitudes/${id}`, { accion: 'aprobar', rol, usuario, nota }), 'No se pudo aprobar.');
  }
  rechazar(id: string, nota: string) {
    return this.pedir(this.http.post(`/api/admin/solicitudes/${id}`, { accion: 'rechazar', nota }), 'No se pudo rechazar.');
  }

  usuarios() { return this.pedir(this.http.get<{ usuarios: UsuarioCuenta[] }>('/api/admin/usuarios'), 'No se pudieron cargar los usuarios.'); }
  crearUsuario(u: { usuario: string; nombre: string; rol: Rol; correo: string }) {
    return this.pedir(this.http.post<ClaveEntregada>('/api/admin/usuarios', u), 'No se pudo crear el usuario.');
  }
  cambiarRol(usuario: string, rol: Rol) { return this.pedir(this.http.post(`/api/admin/usuarios/${usuario}`, { accion: 'rol', rol }), 'No se pudo cambiar el rol.'); }
  restablecer(usuario: string) {
    return this.pedir(this.http.post<ClaveEntregada>(`/api/admin/usuarios/${usuario}`, { accion: 'restablecer' }), 'No se pudo restablecer la contraseña.');
  }
  eliminar(usuario: string) { return this.pedir(this.http.post(`/api/admin/usuarios/${usuario}`, { accion: 'eliminar' }), 'No se pudo eliminar.'); }

  ficha() { return this.pedir(this.http.get<FichaDescarga>('/api/descargas'), 'No se pudo cargar el modelo.'); }
}
