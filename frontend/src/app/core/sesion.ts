// Sesión del usuario de la plataforma. La credencial es una cookie HttpOnly que pone Crow: JavaScript no la ve ni la
// guarda; aquí solo se conoce quién está conectado. La landing pública no necesita sesión.
import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';

export interface UsuarioSesion { usuario: string; nombre: string }

@Injectable({ providedIn: 'root' })
export class Sesion {
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly usuario = signal<UsuarioSesion | null>(null);
  readonly activa = computed(() => this.usuario() !== null);
  readonly iniciales = computed(() => (this.usuario()?.nombre ?? '?').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase());
  private verificada = false;

  /** Pregunta a Crow si la cookie sigue vigente (una vez por carga de la app, salvo que se fuerce). */
  async verificar(forzar = false): Promise<boolean> {
    if (this.verificada && !forzar) return this.activa();
    try {
      const r = await firstValueFrom(this.http.get<UsuarioSesion & { activa: boolean }>('/api/auth/sesion'));
      this.usuario.set(r.activa ? { usuario: r.usuario, nombre: r.nombre } : null);
    } catch {
      this.usuario.set(null);
    }
    this.verificada = true;
    return this.activa();
  }

  async iniciar(usuario: string, clave: string): Promise<void> {
    const u = await firstValueFrom(this.http.post<UsuarioSesion>('/api/auth/login', { usuario, clave }).pipe(
      catchError((e: HttpErrorResponse) => throwError(() => new Error(
        e.status === 0 ? 'No hay conexión con el servidor.' : (e.error?.error ?? 'No se pudo iniciar sesión.'))))));
    this.usuario.set(u);
    this.verificada = true;
  }

  async cerrar(): Promise<void> {
    try { await firstValueFrom(this.http.post('/api/auth/logout', {})); } catch { /* la cookie se limpia igual */ }
    this.usuario.set(null);
    await this.router.navigateByUrl('/acceso');
  }

  /** La sesión venció mientras se usaba la app (un 401 de la API). */
  expirada() {
    if (!this.usuario()) return;
    this.usuario.set(null);
    this.router.navigate(['/acceso'], { queryParams: { volver: this.router.url, expirada: 1 } });
  }
}

/** Solo deja entrar a la plataforma con sesión; si no, manda a /acceso recordando a dónde iba. */
export const sesionGuard: CanMatchFn = async (_ruta, segmentos) => {
  const sesion = inject(Sesion), router = inject(Router);
  if (await sesion.verificar()) return true;
  const volver = '/' + segmentos.map(s => s.path).join('/');
  return router.createUrlTree(['/acceso'], { queryParams: volver !== '/' ? { volver } : {} });
};

/** Si la API responde 401 (sesión vencida o cerrada en otro lado), vuelve al acceso. */
export const sesionInterceptor: HttpInterceptorFn = (req, next) => {
  const sesion = inject(Sesion);
  return next(req).pipe(catchError((e: HttpErrorResponse) => {
    if (e.status === 401 && !req.url.includes('/api/auth/')) sesion.expirada();
    return throwError(() => e);
  }));
};
