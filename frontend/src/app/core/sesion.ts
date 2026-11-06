// Sesión del usuario de la plataforma. La credencial es una cookie HttpOnly que pone Crow: JavaScript no la ve ni la
// guarda; aquí solo se conoce quién está conectado y su rol. La landing pública no necesita sesión.
// Los permisos de verdad los aplica Crow (middleware por rol); aquí solo se ocultan las páginas que no corresponden.
import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateChildFn, CanMatchFn, Router } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';

/** admin: todo · colaborador: mejora el modelo pero no activa versiones · descarga: solo descarga el modelo */
export type Rol = 'admin' | 'colaborador' | 'descarga';
export const ROLES_EQUIPO: Rol[] = ['admin', 'colaborador'];
export const NOMBRE_ROL: Record<Rol, string> = { admin: 'Administrador', colaborador: 'Colaborador', descarga: 'Descarga del modelo' };

export interface UsuarioSesion { usuario: string; nombre: string; rol: Rol; debe_cambiar: boolean }

@Injectable({ providedIn: 'root' })
export class Sesion {
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly usuario = signal<UsuarioSesion | null>(null);
  readonly activa = computed(() => this.usuario() !== null);
  readonly rol = computed(() => this.usuario()?.rol ?? null);
  readonly esAdmin = computed(() => this.rol() === 'admin');
  readonly iniciales = computed(() => (this.usuario()?.nombre ?? '?').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase());
  private verificada = false;

  /** ¿El rol actual puede ver algo marcado con estos roles? Sin roles, cualquiera con sesión. */
  puede(roles?: readonly Rol[]) { const r = this.rol(); return !!r && (!roles || roles.includes(r)); }

  /** Página de llegada según la cuenta: cambiar la clave temporal, las descargas o el Command Center */
  inicio(): string {
    const u = this.usuario();
    if (!u) return '/acceso';
    if (u.debe_cambiar) return '/cuenta/clave';
    return u.rol === 'descarga' ? '/descargas' : '/centro';
  }

  /** Pregunta a Crow si la cookie sigue vigente (una vez por carga de la app, salvo que se fuerce). */
  async verificar(forzar = false): Promise<boolean> {
    if (this.verificada && !forzar) return this.activa();
    try {
      const r = await firstValueFrom(this.http.get<UsuarioSesion & { activa: boolean }>('/api/auth/sesion'));
      this.usuario.set(r.activa ? normalizar(r) : null);
    } catch {
      this.usuario.set(null);
    }
    this.verificada = true;
    return this.activa();
  }

  async iniciar(usuario: string, clave: string): Promise<UsuarioSesion> {
    const u = await firstValueFrom(this.http.post<UsuarioSesion>('/api/auth/login', { usuario, clave }).pipe(
      catchError((e: HttpErrorResponse) => throwError(() => new Error(mensaje(e, 'No se pudo iniciar sesión.'))))));
    this.usuario.set(normalizar(u));
    this.verificada = true;
    return this.usuario()!;
  }

  async cambiarClave(actual: string, nueva: string): Promise<void> {
    const u = await firstValueFrom(this.http.post<UsuarioSesion>('/api/cuenta/clave', { actual, nueva }).pipe(
      catchError((e: HttpErrorResponse) => throwError(() => new Error(mensaje(e, 'No se pudo cambiar la contraseña.'))))));
    this.usuario.set(normalizar(u));
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

function normalizar(u: Partial<UsuarioSesion>): UsuarioSesion {
  return { usuario: u.usuario ?? '', nombre: u.nombre ?? u.usuario ?? '', rol: (u.rol ?? 'admin') as Rol, debe_cambiar: !!u.debe_cambiar };
}
export function mensaje(e: HttpErrorResponse, porDefecto: string) {
  return e.status === 0 ? 'No hay conexión con el servidor.' : (e.error?.error ?? porDefecto);
}

/** Solo deja entrar a la plataforma con sesión; si no, manda a /acceso recordando a dónde iba. */
export const sesionGuard: CanMatchFn = async (_ruta, segmentos) => {
  const sesion = inject(Sesion), router = inject(Router);
  if (await sesion.verificar()) return true;
  const volver = '/' + segmentos.map(s => s.path).join('/');
  return router.createUrlTree(['/acceso'], { queryParams: volver !== '/' ? { volver } : {} });
};

/** Dentro de la plataforma: con clave temporal solo se puede cambiar la clave; y cada página exige su rol (data.roles). */
export const rolGuard: CanActivateChildFn = (hijo: ActivatedRouteSnapshot) => {
  const sesion = inject(Sesion), router = inject(Router);
  if (sesion.usuario()?.debe_cambiar) return router.createUrlTree(['/cuenta/clave']);
  const roles = hijo.data?.['roles'] as Rol[] | undefined;
  return sesion.puede(roles) ? true : router.createUrlTree([sesion.inicio()]);
};

/** 401: la sesión venció o se cerró en otro lado (por ejemplo, un admin cambió el rol). 403 por clave temporal: a cambiarla. */
export const sesionInterceptor: HttpInterceptorFn = (req, next) => {
  const sesion = inject(Sesion), router = inject(Router);
  return next(req).pipe(catchError((e: HttpErrorResponse) => {
    if (e.status === 401 && !req.url.includes('/api/auth/')) sesion.expirada();
    if (e.status === 403 && e.error?.codigo === 'debe_cambiar') router.navigateByUrl('/cuenta/clave');
    return throwError(() => e);
  }));
};
