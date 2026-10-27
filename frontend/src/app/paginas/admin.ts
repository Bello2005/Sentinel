// ADMINISTRACIÓN (solo admin): revisar las solicitudes de acceso y manejar las cuentas. Al aprobar o crear una cuenta
// se muestra una única vez la contraseña temporal, para entregarla a la persona; al entrar, deberá cambiarla.
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ClaveEntregada, Cuentas, Solicitud, TipoSolicitud, UsuarioCuenta } from '../core/cuentas';
import { fecha, haceCuanto } from '../core/formato';
import { NOMBRE_ROL, Rol, Sesion } from '../core/sesion';

type Pestana = 'solicitudes' | 'usuarios';

@Component({
  selector: 'sx-admin',
  imports: [FormsModule],
  template: `
    <div class="sx-page">
      <header class="sx-page-head">
        <div>
          <div class="sx-eyebrow">Administración</div>
          <h1>Accesos y cuentas</h1>
          <p>Revise quién pide acceso y por qué, y decida qué puede hacer cada persona: colaborar con el modelo o solo descargarlo.</p>
        </div>
        <div class="seg" role="tablist" aria-label="Sección">
          <button role="tab" [attr.aria-selected]="pestana() === 'solicitudes'" [class.sel]="pestana() === 'solicitudes'" (click)="pestana.set('solicitudes')">
            Solicitudes @if (pendientes()) { <span class="n">{{ pendientes() }}</span> }</button>
          <button role="tab" [attr.aria-selected]="pestana() === 'usuarios'" [class.sel]="pestana() === 'usuarios'" (click)="pestana.set('usuarios')">
            Usuarios <span class="n gris">{{ usuarios().length }}</span></button>
        </div>
      </header>

      @if (error()) { <div class="sx-card aviso error" role="alert"><span class="material-symbols-rounded" aria-hidden="true">error</span>{{ error() }}</div> }

      @if (entregada(); as c) {
        <section class="sx-card entrega" role="status">
          <div class="cab"><span class="material-symbols-rounded" aria-hidden="true">key</span>
            <div><b>Contraseña temporal de {{ c.usuario }}</b><small>Se muestra solo esta vez. Entréguela por un canal privado: al entrar, la persona deberá cambiarla.</small></div>
            <button class="cerrar" (click)="entregada.set(null)" aria-label="Cerrar"><span class="material-symbols-rounded">close</span></button></div>
          <div class="credenciales">
            <div><small>Usuario</small><code>{{ c.usuario }}</code></div>
            <div><small>Contraseña temporal</small><code>{{ c.clave_temporal }}</code></div>
          </div>
          <div class="acciones">
            <button class="sx-btn primary" (click)="copiar(mensaje(c))"><span class="material-symbols-rounded" aria-hidden="true">{{ copiado() ? 'check' : 'content_copy' }}</span>
              {{ copiado() ? 'Mensaje copiado' : 'Copiar mensaje para la persona' }}</button>
          </div>
        </section>
      }

      @if (pestana() === 'solicitudes') {
        <div class="filtro">
          <div class="seg chico" role="radiogroup" aria-label="Estado">
            @for (e of estados; track e.id) {
              <button role="radio" [attr.aria-checked]="filtro() === e.id" [class.sel]="filtro() === e.id" (click)="filtro.set(e.id)">{{ e.texto }}</button>
            }
          </div>
        </div>
        @for (s of visibles(); track s.id) {
          <article class="sx-card solicitud" [class.resuelta]="s.estado !== 'pendiente'">
            <div class="s-cab">
              <span class="avatar">{{ iniciales(s.nombre) }}</span>
              <div class="quien"><b>{{ s.nombre }}</b><small>{{ s.correo }}@if (s.organizacion) { · {{ s.organizacion }} } · {{ hace(s.fecha) }}</small></div>
              <span class="sx-pill" [class.active]="s.tipo === 'colaborador'" [class.candidate]="s.tipo === 'descarga'">
                <span class="material-symbols-rounded" aria-hidden="true">{{ s.tipo === 'colaborador' ? 'handshake' : 'download' }}</span>{{ s.tipo === 'colaborador' ? 'Quiere colaborar' : 'Quiere descargar' }}</span>
            </div>
            <blockquote>{{ s.motivo }}</blockquote>
            @if (s.estado === 'pendiente') {
              <div class="decidir">
                <label><span>Usuario</span><input [ngModel]="borrador(s).usuario" (ngModelChange)="editar(s, 'usuario', $event)" [attr.aria-label]="'Usuario para ' + s.nombre" /></label>
                <label><span>Rol</span>
                  <select [ngModel]="borrador(s).rol" (ngModelChange)="editar(s, 'rol', $event)" [attr.aria-label]="'Rol para ' + s.nombre">
                    <option value="colaborador">Colaborador</option><option value="descarga">Descarga del modelo</option></select></label>
                <label class="nota"><span>Nota (opcional)</span><input [ngModel]="borrador(s).nota" (ngModelChange)="editar(s, 'nota', $event)" placeholder="Motivo de la decisión" [attr.aria-label]="'Nota para ' + s.nombre" /></label>
                <div class="botones">
                  <button class="sx-btn danger" (click)="rechazar(s)" [disabled]="ocupado() === s.id"><span class="material-symbols-rounded" aria-hidden="true">block</span>Rechazar</button>
                  <button class="sx-btn success" (click)="aprobar(s)" [disabled]="ocupado() === s.id || !borrador(s).usuario"><span class="material-symbols-rounded" aria-hidden="true">check</span>Aprobar</button>
                </div>
              </div>
            } @else {
              <div class="resultado" [class.ok]="s.estado === 'aprobada'">
                <span class="material-symbols-rounded" aria-hidden="true">{{ s.estado === 'aprobada' ? 'check_circle' : 'cancel' }}</span>
                {{ s.estado === 'aprobada' ? 'Aprobada como ' + rolTexto(s.rol_asignado) + ' (usuario ' + s.usuario_creado + ')' : 'Rechazada' }}
                por {{ s.resuelta?.por }} el {{ fecha(s.resuelta?.fecha) }}@if (s.resuelta?.nota) { · “{{ s.resuelta?.nota }}” }
              </div>
            }
          </article>
        } @empty {
          <div class="sx-card vacio"><span class="material-symbols-rounded" aria-hidden="true">inbox</span>
            <b>{{ filtro() === 'pendiente' ? 'No hay solicitudes pendientes' : 'No hay solicitudes' }}</b>
            <small>Las personas piden acceso desde la página de acceso, con el botón «Solicitar acceso».</small></div>
        }
      } @else {
        <section class="sx-card">
          <h2>Crear una cuenta</h2>
          <form class="crear" (ngSubmit)="crear()">
            <label><span>Nombre</span><input name="nombre" [(ngModel)]="nueva.nombre" required aria-label="Nombre" /></label>
            <label><span>Usuario</span><input name="usuario" [(ngModel)]="nueva.usuario" required aria-label="Usuario" placeholder="nombre.apellido" /></label>
            <label><span>Correo</span><input name="correo" [(ngModel)]="nueva.correo" aria-label="Correo" /></label>
            <label><span>Rol</span><select name="rol" [(ngModel)]="nueva.rol" aria-label="Rol">
              @for (r of roles; track r) { <option [value]="r">{{ rolTexto(r) }}</option> }</select></label>
            <button class="sx-btn primary" type="submit" [disabled]="!nueva.nombre.trim() || !nueva.usuario.trim() || ocupado() === 'crear'">
              <span class="material-symbols-rounded" aria-hidden="true">person_add</span>Crear</button>
          </form>
        </section>
        <section class="sx-card tabla-env">
          <table>
            <thead><tr><th>Persona</th><th>Rol</th><th>Estado</th><th class="der">Acciones</th></tr></thead>
            <tbody>
              @for (u of usuarios(); track u.usuario) {
                <tr>
                  <td><b>{{ u.nombre }}</b><small>&#64;{{ u.usuario }}@if (u.correo) { · {{ u.correo }} }</small></td>
                  <td>
                    @if (u.usuario === yo()) { <span class="sx-pill active">{{ rolTexto(u.rol) }} · usted</span> }
                    @else {
                      <select [ngModel]="u.rol" (ngModelChange)="cambiarRol(u, $event)" [attr.aria-label]="'Rol de ' + u.nombre">
                        @for (r of roles; track r) { <option [value]="r">{{ rolTexto(r) }}</option> }</select>
                    }
                  </td>
                  <td>@if (u.debe_cambiar) { <span class="sx-pill warn">Clave temporal</span> } @else { <span class="sx-pill ok">Activa</span> }</td>
                  <td class="der">
                    @if (u.usuario !== yo()) {
                      <button class="sx-btn" (click)="restablecer(u)" [attr.aria-label]="'Restablecer contraseña de ' + u.nombre"><span class="material-symbols-rounded" aria-hidden="true">lock_reset</span></button>
                      @if (confirmar() === u.usuario) {
                        <button class="sx-btn danger" (click)="eliminar(u)">Confirmar</button>
                        <button class="sx-btn" (click)="confirmar.set(null)">No</button>
                      } @else {
                        <button class="sx-btn danger" (click)="confirmar.set(u.usuario)" [attr.aria-label]="'Eliminar a ' + u.nombre"><span class="material-symbols-rounded" aria-hidden="true">delete</span></button>
                      }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </section>
      }
    </div>`,
  styles: `
    .seg { display: inline-flex; gap: 4px; padding: 4px; border-radius: 12px; background: var(--sx-card); border: 1px solid var(--sx-border); }
    .seg button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border: 0; border-radius: 9px; background: none; color: var(--sx-muted); font: 600 13px var(--sx-font); cursor: pointer; }
    .seg button.sel { background: var(--sx-accent); color: var(--sx-accent-ink); }
    .seg.chico button { padding: 6px 12px; font-size: 12.5px; }
    .n { min-width: 20px; padding: 1px 6px; border-radius: 99px; background: var(--sx-danger); color: #fff; font-size: 11px; }
    .n.gris { background: var(--sx-border-strong); color: var(--sx-text); } .seg button.sel .n.gris { background: rgba(0, 0, 0, 0.15); color: inherit; }
    .aviso { display: flex; gap: 10px; color: var(--sx-danger); }
    .entrega { border-color: color-mix(in srgb, var(--sx-warning) 50%, transparent); background: color-mix(in srgb, var(--sx-warning) 6%, var(--sx-card)); animation: sx-pop 300ms var(--sx-ease); }
    .entrega .cab { display: flex; gap: 12px; align-items: flex-start; } .entrega .cab > span { color: var(--sx-warning); font-size: 24px; }
    .entrega .cab div { flex: 1; } .entrega b { display: block; } .entrega small { color: var(--sx-muted); font-size: 13px; }
    .cerrar { border: 0; background: none; color: var(--sx-muted); cursor: pointer; }
    .credenciales { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 14px 0; }
    .credenciales div { display: flex; flex-direction: column; gap: 4px; padding: 12px; border-radius: 10px; background: var(--sx-bg); border: 1px solid var(--sx-border); }
    .credenciales code { font: 600 16px var(--sx-mono); user-select: all; }
    .filtro { display: flex; justify-content: flex-end; }
    .solicitud { display: flex; flex-direction: column; gap: 14px; } .solicitud.resuelta { opacity: 0.75; }
    .s-cab { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .avatar { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; font-weight: 700; color: var(--sx-accent-ink); background: linear-gradient(135deg, var(--sx-accent), var(--sx-candidate)); }
    .quien { flex: 1; min-width: 200px; } .quien b { display: block; } .quien small { color: var(--sx-muted); font-size: 12.5px; }
    .sx-pill .material-symbols-rounded { font-size: 15px; }
    blockquote { margin: 0; padding: 12px 14px; border-left: 3px solid var(--sx-accent); border-radius: 0 10px 10px 0; background: var(--sx-bg); line-height: 1.6; white-space: pre-wrap; }
    .decidir { display: grid; grid-template-columns: 1fr 1fr 1.4fr auto; gap: 10px; align-items: end; }
    label { display: flex; flex-direction: column; gap: 4px; } label > span { font-size: 12px; font-weight: 600; color: var(--sx-muted); }
    input, select { height: 38px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--sx-border-strong); background: var(--sx-panel); color: var(--sx-text); font: 14px var(--sx-font); outline: none; }
    input:focus, select:focus { border-color: var(--sx-accent); box-shadow: var(--sx-glow); }
    .botones { display: flex; gap: 8px; }
    .resultado { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--sx-danger); } .resultado.ok { color: var(--sx-success); }
    .vacio { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 40px; text-align: center; }
    .vacio span { font-size: 40px; color: var(--sx-faint); } .vacio small { color: var(--sx-muted); }
    h2 { font-size: 16px; margin: 0 0 12px; }
    .crear { display: grid; grid-template-columns: 1.2fr 1fr 1.2fr 1fr auto; gap: 10px; align-items: end; }
    .tabla-env { overflow-x: auto; padding: 8px 20px; }
    table { width: 100%; border-collapse: collapse; min-width: 640px; }
    th { text-align: left; font-size: 11.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sx-faint); padding: 10px 8px; border-bottom: 1px solid var(--sx-border); }
    td { padding: 12px 8px; border-bottom: 1px solid var(--sx-border); vertical-align: middle; }
    td b { display: block; } td small { color: var(--sx-muted); font-size: 12.5px; }
    .der { text-align: right; white-space: nowrap; } td.der .sx-btn { padding: 0 10px; margin-left: 6px; }
    @media (max-width: 1100px) { .decidir, .crear { grid-template-columns: 1fr 1fr; } .botones { grid-column: 1 / -1; justify-content: flex-end; } }
    @media (max-width: 600px) { .decidir, .crear, .credenciales { grid-template-columns: 1fr; } }`,
})
export class Admin {
  private cuentas = inject(Cuentas);
  private sesion = inject(Sesion);
  protected pestana = signal<Pestana>('solicitudes');
  protected filtro = signal<'pendiente' | 'todas'>('pendiente');
  protected solicitudes = signal<Solicitud[]>([]);
  protected usuarios = signal<UsuarioCuenta[]>([]);
  protected error = signal<string | null>(null);
  protected entregada = signal<ClaveEntregada | null>(null);
  protected ocupado = signal<string | null>(null);
  protected confirmar = signal<string | null>(null);
  protected copiado = signal(false);
  protected borradores = signal<Record<string, { usuario: string; rol: TipoSolicitud; nota: string }>>({});
  protected nueva = { nombre: '', usuario: '', correo: '', rol: 'colaborador' as Rol };
  protected roles: Rol[] = ['colaborador', 'descarga', 'admin'];
  protected estados = [{ id: 'pendiente' as const, texto: 'Pendientes' }, { id: 'todas' as const, texto: 'Todas' }];
  protected pendientes = computed(() => this.solicitudes().filter(s => s.estado === 'pendiente').length);
  protected visibles = computed(() => this.solicitudes().filter(s => this.filtro() === 'todas' || s.estado === 'pendiente'));
  protected yo = computed(() => this.sesion.usuario()?.usuario ?? '');
  protected fecha = fecha;
  protected hace = haceCuanto;

  constructor() { this.cargar(); }

  async cargar() {
    try {
      const [s, u] = await Promise.all([this.cuentas.solicitudes(), this.cuentas.usuarios()]);
      this.solicitudes.set(s.solicitudes);
      this.usuarios.set(u.usuarios);
      this.error.set(null);
    } catch (e) { this.error.set((e as Error).message); }
  }

  rolTexto(r?: Rol) { return r ? NOMBRE_ROL[r] : ''; }
  iniciales(n: string) { return n.trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase(); }

  /** Usuario sugerido a partir del correo: la parte antes de @, en minúscula y sin caracteres raros */
  borrador(s: Solicitud) {
    return this.borradores()[s.id] ?? {
      usuario: s.correo.split('@')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 32),
      rol: s.tipo, nota: '' };
  }
  editar(s: Solicitud, campo: 'usuario' | 'rol' | 'nota', valor: string) {
    this.borradores.update(b => ({ ...b, [s.id]: { ...this.borrador(s), [campo]: valor } }));
  }

  private async hacer(id: string, f: () => Promise<unknown>) {
    this.ocupado.set(id);
    this.error.set(null);
    try { await f(); await this.cargar(); } catch (e) { this.error.set((e as Error).message); } finally { this.ocupado.set(null); }
  }
  aprobar(s: Solicitud) {
    const b = this.borrador(s);
    return this.hacer(s.id, async () => { this.entregada.set(await this.cuentas.aprobar(s.id, b.rol, b.usuario.trim(), b.nota.trim())); });
  }
  rechazar(s: Solicitud) { return this.hacer(s.id, () => this.cuentas.rechazar(s.id, this.borrador(s).nota.trim())); }
  crear() {
    const n = this.nueva;
    return this.hacer('crear', async () => {
      this.entregada.set(await this.cuentas.crearUsuario({ nombre: n.nombre.trim(), usuario: n.usuario.trim(), correo: n.correo.trim(), rol: n.rol }));
      this.nueva = { nombre: '', usuario: '', correo: '', rol: 'colaborador' };
    });
  }
  cambiarRol(u: UsuarioCuenta, rol: Rol) { return this.hacer(u.usuario, () => this.cuentas.cambiarRol(u.usuario, rol)); }
  restablecer(u: UsuarioCuenta) { return this.hacer(u.usuario, async () => { this.entregada.set(await this.cuentas.restablecer(u.usuario)); }); }
  eliminar(u: UsuarioCuenta) { this.confirmar.set(null); return this.hacer(u.usuario, () => this.cuentas.eliminar(u.usuario)); }

  mensaje(c: ClaveEntregada) {
    return `Hola. Ya tiene acceso a SENTINEL (https://sentinel.bello.works/acceso).\nUsuario: ${c.usuario}\nContraseña temporal: ${c.clave_temporal}\n` +
           `Al entrar por primera vez le pediremos cambiarla por una que solo usted conozca.`;
  }
  async copiar(texto: string) {
    try { await navigator.clipboard.writeText(texto); this.copiado.set(true); setTimeout(() => this.copiado.set(false), 2000); } catch { /* sin portapapeles */ }
  }
}
