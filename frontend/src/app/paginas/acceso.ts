// ACCESO: la puerta a la plataforma. Usuario y contraseña (la sesión es una cookie HttpOnly que pone Crow) o, para quien
// no tiene cuenta, una solicitud de acceso con sus motivos que revisa un administrador.
import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Cuentas, TipoSolicitud } from '../core/cuentas';
import { Sesion } from '../core/sesion';
import { Tema } from '../core/tema';

@Component({
  selector: 'sx-acceso',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="aurora" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="marco">
      <section class="historia" aria-hidden="false">
        <a routerLink="/" class="marca"><img src="sentinel.svg" width="40" height="40" alt="" /><span><b>SENTINEL</b><small>Predictive Governance Platform</small></span></a>
        <div class="centro">
          <div class="radar" aria-hidden="true">
            <span class="onda"></span><span class="onda o2"></span><span class="onda o3"></span>
            <img src="sentinel.svg" width="72" height="72" alt="" />
            <span class="chip c1"><span class="material-symbols-rounded">verified_user</span>Validación</span>
            <span class="chip c2"><span class="material-symbols-rounded">gavel</span>Aprobación humana</span>
            <span class="chip c3"><span class="material-symbols-rounded">history</span>Trazabilidad</span>
          </div>
          <h1>Human-controlled AI</h1>
          <p>La plataforma valida cada dataset, explica el modelo y exige una decisión humana —con nombre y justificación— antes
             de que cualquier versión llegue a producción.</p>
          <ul>
            <li><span class="material-symbols-rounded" aria-hidden="true">shield_lock</span><div><b>Acceso protegido</b><small>Sesión cifrada, contraseñas con PBKDF2 y límite de intentos.</small></div></li>
            <li><span class="material-symbols-rounded" aria-hidden="true">fingerprint</span><div><b>Responsabilidad trazable</b><small>Cada activación queda firmada por el usuario que la aprobó.</small></div></li>
          </ul>
        </div>
        <small class="pie">Datos: ICFES · Saber 11 · CC BY-SA 4.0</small>
      </section>

      <section class="formulario">
        <div class="arriba">
          <a routerLink="/" class="volver"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>Volver al estudio</a>
          <button class="icono" type="button" (click)="tema.alternar()" [attr.aria-label]="tema.modo() === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'">
            <span class="material-symbols-rounded">{{ tema.modo() === 'dark' ? 'light_mode' : 'dark_mode' }}</span></button>
        </div>
        @if (modo() === 'entrar') {
        <form class="tarjeta" (ngSubmit)="entrar()" novalidate aria-labelledby="titulo-acceso">
          <span class="candado" aria-hidden="true"><span class="material-symbols-rounded">lock</span></span>
          <h2 id="titulo-acceso">Acceso a la plataforma</h2>
          <p class="sx-muted">Ingrese con su usuario de SENTINEL.</p>

          @if (expirada()) {
            <div class="aviso info" role="status"><span class="material-symbols-rounded" aria-hidden="true">schedule</span>Su sesión venció. Ingrese de nuevo para continuar.</div>
          }
          @if (error()) {
            <div class="aviso error" role="alert" id="error-acceso"><span class="material-symbols-rounded" aria-hidden="true">error</span>{{ error() }}</div>
          }

          <label class="campo">
            <span>Usuario</span>
            <div class="entrada" [class.mal]="!!error()">
              <span class="material-symbols-rounded" aria-hidden="true">person</span>
              <input name="usuario" aria-label="Usuario" [(ngModel)]="usuario" autocomplete="username" autocapitalize="none" spellcheck="false" required
                     [attr.aria-invalid]="!!error()" [attr.aria-describedby]="error() ? 'error-acceso' : null" />
            </div>
          </label>
          <label class="campo">
            <span>Contraseña</span>
            <div class="entrada" [class.mal]="!!error()">
              <span class="material-symbols-rounded" aria-hidden="true">key</span>
              <input name="clave" aria-label="Contraseña" [(ngModel)]="clave" [type]="ver() ? 'text' : 'password'" autocomplete="current-password" required
                     (keyup)="mayus.set($any($event).getModifierState?.('CapsLock') ?? false)" [attr.aria-invalid]="!!error()" />
              <button type="button" class="ojo" (click)="ver.set(!ver())" [attr.aria-label]="ver() ? 'Ocultar contraseña' : 'Mostrar contraseña'" [attr.aria-pressed]="ver()">
                <span class="material-symbols-rounded">{{ ver() ? 'visibility_off' : 'visibility' }}</span></button>
            </div>
            @if (mayus()) { <small class="mayus"><span class="material-symbols-rounded" aria-hidden="true">keyboard_capslock</span>Bloq Mayús activado</small> }
          </label>

          <button class="sx-btn primary lg entrar" type="submit" [disabled]="enviando() || !usuario.trim() || !clave">
            @if (enviando()) { <span class="giro material-symbols-rounded" aria-hidden="true">progress_activity</span>Verificando… }
            @else { Iniciar sesión <span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span> }
          </button>
          <div class="separador"><span>¿No tiene cuenta?</span></div>
          <button class="sx-btn lg secundario" type="button" (click)="cambiarModo('solicitar')">
            <span class="material-symbols-rounded" aria-hidden="true">person_add</span>Solicitar acceso</button>
          <p class="nota sx-muted"><span class="material-symbols-rounded" aria-hidden="true">info</span>
            Para colaborar con el modelo o descargarlo. Un administrador revisa cada solicitud.</p>
        </form>
        } @else if (modo() === 'solicitar') {
        <form class="tarjeta ancha" (ngSubmit)="solicitar()" novalidate aria-labelledby="titulo-solicitud">
          <span class="candado" aria-hidden="true"><span class="material-symbols-rounded">person_add</span></span>
          <h2 id="titulo-solicitud">Solicitar acceso</h2>
          <p class="sx-muted">Cuéntenos quién es y para qué lo necesita. Un administrador revisará su solicitud.</p>
          @if (errorSolicitud()) {
            <div class="aviso error" role="alert"><span class="material-symbols-rounded" aria-hidden="true">error</span>{{ errorSolicitud() }}</div>
          }
          <fieldset class="tipos">
            <legend>¿Qué necesita?</legend>
            @for (t of tipos; track t.id) {
              <label class="tipo" [class.sel]="sol.tipo === t.id">
                <input type="radio" name="tipo" [value]="t.id" [(ngModel)]="sol.tipo" />
                <span class="material-symbols-rounded" aria-hidden="true">{{ t.icono }}</span>
                <span><b>{{ t.titulo }}</b><small>{{ t.texto }}</small></span>
              </label>
            }
          </fieldset>
          <div class="dos-campos">
            <label class="campo"><span>Nombre completo</span>
              <div class="entrada"><span class="material-symbols-rounded" aria-hidden="true">badge</span>
                <input name="nombre" [(ngModel)]="sol.nombre" autocomplete="name" maxlength="80" required aria-label="Nombre completo" /></div></label>
            <label class="campo"><span>Correo</span>
              <div class="entrada"><span class="material-symbols-rounded" aria-hidden="true">mail</span>
                <input name="correo" type="email" [(ngModel)]="sol.correo" autocomplete="email" maxlength="120" required aria-label="Correo" /></div></label>
          </div>
          <label class="campo"><span>Organización <small>(opcional)</small></span>
            <div class="entrada"><span class="material-symbols-rounded" aria-hidden="true">apartment</span>
              <input name="organizacion" [(ngModel)]="sol.organizacion" autocomplete="organization" maxlength="120" placeholder="Universidad, secretaría, colegio…" aria-label="Organización" /></div></label>
          <label class="campo"><span>¿Por qué necesita el acceso?</span>
            <textarea name="motivo" [(ngModel)]="sol.motivo" rows="5" maxlength="1500" required aria-label="Motivo de la solicitud" aria-describedby="ayuda-motivo"
                      placeholder="Por ejemplo: soy docente de la UTCH y quiero probar el modelo con los datos de 2023 de mi secretaría."></textarea>
            <small id="ayuda-motivo" class="contador" [class.ok]="sol.motivo.trim().length >= 30">
              {{ sol.motivo.trim().length < 30 ? 'Mínimo 30 caracteres · faltan ' + (30 - sol.motivo.trim().length) : sol.motivo.length + ' / 1500' }}</small>
          </label>
          <!-- Campo trampa: invisible para las personas; si un robot lo llena, la solicitud se descarta -->
          <div class="trampa" aria-hidden="true"><input name="sitio_web" [(ngModel)]="sol.sitio_web" tabindex="-1" autocomplete="off" /></div>
          <button class="sx-btn primary lg entrar" type="submit" [disabled]="enviando() || !solicitudLista()">
            @if (enviando()) { <span class="giro material-symbols-rounded" aria-hidden="true">progress_activity</span>Enviando… }
            @else { Enviar solicitud <span class="material-symbols-rounded" aria-hidden="true">send</span> }
          </button>
          <button class="enlace" type="button" (click)="cambiarModo('entrar')"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>Ya tengo cuenta: iniciar sesión</button>
        </form>
        } @else {
        <div class="tarjeta enviada" role="status" aria-live="polite">
          <span class="candado ok" aria-hidden="true"><span class="material-symbols-rounded">mark_email_read</span></span>
          <h2>Recibimos su solicitud</h2>
          <p class="sx-muted">Gracias, {{ sol.nombre.split(' ')[0] }}. Un administrador la revisará. Si la aprueba, el equipo le escribirá a
            <b>{{ sol.correo }}</b> con su usuario y una contraseña temporal, que deberá cambiar la primera vez que entre.</p>
          <ol class="pasos-sol">
            <li class="hecho"><span class="material-symbols-rounded" aria-hidden="true">check</span>Solicitud enviada</li>
            <li><span class="material-symbols-rounded" aria-hidden="true">hourglass_top</span>Revisión del administrador</li>
            <li><span class="material-symbols-rounded" aria-hidden="true">key</span>Usuario y contraseña temporal por correo</li>
          </ol>
          <a class="sx-btn lg secundario" routerLink="/"><span class="material-symbols-rounded" aria-hidden="true">insights</span>Volver al estudio</a>
        </div>
        }
      </section>
    </div>`,
  styles: `
    :host { display: block; min-height: 100vh; position: relative; overflow: hidden; }
    .aurora { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
    .aurora i { position: absolute; width: 60vw; height: 60vw; border-radius: 50%; filter: blur(90px); animation: deriva 26s ease-in-out infinite alternate; }
    .aurora i:nth-child(1) { background: var(--sx-aurora-1); top: -30vw; left: -15vw; }
    .aurora i:nth-child(2) { background: var(--sx-aurora-2); bottom: -30vw; left: 20vw; animation-delay: -8s; }
    .aurora i:nth-child(3) { background: var(--sx-aurora-3); top: -10vw; right: -25vw; animation-delay: -16s; }
    @keyframes deriva { to { transform: translate(5vw, 4vw) scale(1.1); } }
    .marco { position: relative; z-index: 1; display: grid; grid-template-columns: 1.05fr 1fr; min-height: 100vh; }
    .historia { display: flex; flex-direction: column; padding: 36px 48px; border-right: 1px solid var(--sx-border);
                background: linear-gradient(160deg, color-mix(in srgb, var(--sx-panel) 70%, transparent), transparent); }
    .marca { display: flex; align-items: center; gap: 12px; text-decoration: none; color: inherit; }
    .marca b { display: block; letter-spacing: 0.2em; } .marca small { color: var(--sx-muted); font-size: 12px; }
    .centro { margin: auto 0; max-width: 520px; }
    .centro h1 { font-size: clamp(30px, 3.4vw, 46px); line-height: 1.05; margin: 28px 0 14px;
                 background: linear-gradient(110deg, var(--sx-text) 30%, var(--sx-accent) 70%, var(--sx-candidate)); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .centro p { color: var(--sx-muted); font-size: 16px; line-height: 1.6; margin: 0; }
    .centro ul { list-style: none; padding: 0; margin: 28px 0 0; display: flex; flex-direction: column; gap: 16px; }
    .centro li { display: flex; gap: 14px; } .centro li > span { color: var(--sx-accent); margin-top: 2px; }
    .centro li small { display: block; color: var(--sx-muted); }
    .radar { position: relative; width: 220px; height: 220px; display: grid; place-items: center; }
    .radar img { position: relative; z-index: 1; filter: drop-shadow(0 0 22px rgba(110, 231, 255, 0.5)); }
    .onda { position: absolute; inset: 30px; border-radius: 50%; border: 1px solid color-mix(in srgb, var(--sx-accent) 40%, transparent); animation: latir 3.6s ease-out infinite; }
    .o2 { animation-delay: 1.2s; } .o3 { animation-delay: 2.4s; }
    @keyframes latir { from { transform: scale(0.5); opacity: 1; } to { transform: scale(1.5); opacity: 0; } }
    .chip { position: absolute; display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 600;
            background: var(--sx-glass); backdrop-filter: blur(10px); border: 1px solid var(--sx-border-strong); box-shadow: var(--sx-shadow); white-space: nowrap;
            animation: flotar 6s ease-in-out infinite; }
    .chip span { font-size: 16px; color: var(--sx-accent); }
    .c1 { top: 8px; left: 150px; } .c2 { bottom: 26px; left: 170px; animation-delay: -2s; } .c2 span { color: var(--sx-candidate); }
    .c3 { top: 96px; left: -40px; animation-delay: -4s; } .c3 span { color: var(--sx-active); }
    @keyframes flotar { 50% { transform: translateY(-8px); } }
    .pie { color: var(--sx-faint); }
    .formulario { display: flex; flex-direction: column; padding: 28px 40px; }
    .arriba { display: flex; justify-content: space-between; align-items: center; }
    .volver { display: inline-flex; align-items: center; gap: 6px; color: var(--sx-muted); text-decoration: none; font-weight: 500; }
    .volver:hover { color: var(--sx-text); }
    .icono { width: 38px; height: 38px; border-radius: 10px; border: 1px solid var(--sx-border); background: transparent; color: var(--sx-muted); cursor: pointer; display: grid; place-items: center; }
    .tarjeta { margin: auto; width: min(420px, 100%); display: flex; flex-direction: column; gap: 16px; padding: 36px; border-radius: var(--sx-radius-lg);
               background: var(--sx-glass); backdrop-filter: blur(18px); border: 1px solid var(--sx-border-strong); box-shadow: var(--sx-shadow-lift);
               animation: sx-rise var(--sx-slow) var(--sx-ease) both; }
    .candado { width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; color: var(--sx-accent-ink);
               background: linear-gradient(135deg, var(--sx-accent), var(--sx-candidate)); box-shadow: 0 10px 30px color-mix(in srgb, var(--sx-accent) 35%, transparent); }
    .tarjeta h2 { font-size: 24px; } .tarjeta > p { margin: -10px 0 4px; }
    .campo { display: flex; flex-direction: column; gap: 6px; } .campo > span { font-size: 13px; font-weight: 600; }
    .entrada { display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 12px; border-radius: 12px; background: var(--sx-panel);
               border: 1px solid var(--sx-border-strong); transition: border-color var(--sx-fast), box-shadow var(--sx-fast); }
    .entrada:focus-within { border-color: var(--sx-accent); box-shadow: var(--sx-glow); }
    .entrada.mal { border-color: color-mix(in srgb, var(--sx-danger) 60%, transparent); }
    .entrada > span { color: var(--sx-faint); }
    .entrada input { flex: 1; min-width: 0; height: 100%; background: none; border: 0; outline: none; color: var(--sx-text); font: 15px var(--sx-font); }
    .ojo { border: 0; background: none; color: var(--sx-muted); cursor: pointer; display: grid; place-items: center; padding: 4px; border-radius: 8px; }
    .mayus { display: inline-flex; align-items: center; gap: 4px; color: var(--sx-warning); font-size: 12px; } .mayus span { font-size: 16px; }
    .entrar { justify-content: center; width: 100%; margin-top: 6px; }
    .giro { animation: girar 0.9s linear infinite; } @keyframes girar { to { transform: rotate(360deg); } }
    .aviso { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: 10px; font-size: 13.5px; animation: sx-pop 240ms var(--sx-ease); }
    .aviso.error { color: var(--sx-danger); background: color-mix(in srgb, var(--sx-danger) 10%, transparent); border: 1px solid color-mix(in srgb, var(--sx-danger) 35%, transparent); }
    .aviso.info { color: var(--sx-accent); background: color-mix(in srgb, var(--sx-accent) 10%, transparent); border: 1px solid color-mix(in srgb, var(--sx-accent) 30%, transparent); }
    .aviso span { font-size: 18px; }
    .nota { display: flex; gap: 6px; font-size: 12px; margin: 0; } .nota span { font-size: 16px; }
    .tarjeta.ancha { width: min(560px, 100%); }
    .separador { display: flex; align-items: center; gap: 10px; color: var(--sx-faint); font-size: 12.5px; margin: 4px 0 -4px; }
    .separador::before, .separador::after { content: ''; flex: 1; height: 1px; background: var(--sx-border); }
    .secundario { justify-content: center; width: 100%; text-decoration: none; }
    .tipos { border: 0; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .tipos legend { font-size: 13px; font-weight: 600; margin-bottom: 8px; padding: 0; }
    .tipo { position: relative; display: flex; gap: 10px; align-items: flex-start; padding: 14px; border-radius: 14px; border: 1px solid var(--sx-border-strong);
      background: var(--sx-panel); cursor: pointer; transition: border-color var(--sx-fast), box-shadow var(--sx-fast), background var(--sx-fast); }
    .tipo input { position: absolute; opacity: 0; pointer-events: none; }
    .tipo > span:first-of-type { font-size: 22px; color: var(--sx-muted); }
    .tipo b { display: block; font-size: 14px; } .tipo small { display: block; margin-top: 2px; color: var(--sx-muted); font-size: 12.5px; line-height: 1.45; }
    .tipo:hover { border-color: var(--sx-accent); }
    .tipo.sel { border-color: var(--sx-accent); box-shadow: var(--sx-glow); background: color-mix(in srgb, var(--sx-accent) 7%, var(--sx-panel)); }
    .tipo.sel > span:first-of-type { color: var(--sx-accent); }
    .tipo:has(input:focus-visible) { outline: 2px solid var(--sx-accent); outline-offset: 2px; }
    .dos-campos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .campo small { font-weight: 400; color: var(--sx-faint); }
    textarea { resize: vertical; min-height: 110px; padding: 12px; border-radius: 12px; background: var(--sx-panel); border: 1px solid var(--sx-border-strong);
      color: var(--sx-text); font: 15px/1.5 var(--sx-font); outline: none; transition: border-color var(--sx-fast), box-shadow var(--sx-fast); }
    textarea:focus { border-color: var(--sx-accent); box-shadow: var(--sx-glow); }
    .contador { align-self: flex-end; font-size: 12px; color: var(--sx-faint); } .contador.ok { color: var(--sx-success); }
    .trampa { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
    .enlace { align-self: center; display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; color: var(--sx-muted); font: 500 13.5px var(--sx-font); cursor: pointer; }
    .enlace:hover { color: var(--sx-text); } .enlace span { font-size: 17px; }
    .enviada { text-align: left; }
    .candado.ok { background: linear-gradient(135deg, var(--sx-success), var(--sx-accent)); }
    .pasos-sol { list-style: none; padding: 0; margin: 4px 0 8px; display: flex; flex-direction: column; gap: 10px; }
    .pasos-sol li { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--sx-muted); }
    .pasos-sol li span { width: 28px; height: 28px; border-radius: 99px; display: grid; place-items: center; font-size: 16px; border: 1px solid var(--sx-border-strong); }
    .pasos-sol li.hecho { color: var(--sx-text); } .pasos-sol li.hecho span { background: var(--sx-success); border-color: transparent; color: #fff; }
    @media (max-width: 900px) { .marco { grid-template-columns: 1fr; } .historia { display: none; } .formulario { padding: 20px 16px; } .tarjeta { padding: 26px 20px; } }
    @media (max-width: 520px) { .tipos, .dos-campos { grid-template-columns: 1fr; } }`,
})
export class Acceso {
  readonly volver = input<string>();
  readonly expirada = input<string>();
  /** /acceso?solicitar=1 abre directamente el formulario de solicitud */
  readonly solicitar_ = input<string>(undefined, { alias: 'solicitar' });
  protected tema = inject(Tema);
  private sesion = inject(Sesion);
  private router = inject(Router);
  private cuentas = inject(Cuentas);
  protected modo = signal<'entrar' | 'solicitar' | 'enviada'>('entrar');
  protected errorSolicitud = signal<string | null>(null);
  protected sol = { nombre: '', correo: '', organizacion: '', tipo: 'colaborador' as TipoSolicitud, motivo: '', sitio_web: '' };
  protected tipos = [
    { id: 'colaborador' as const, icono: 'handshake', titulo: 'Colaborar', texto: 'Probar datos nuevos, entrenar versiones candidatas y proponer mejoras.' },
    { id: 'descarga' as const, icono: 'download', titulo: 'Descargar el modelo', texto: 'Solo obtener el modelo y su ficha para usarlo por su cuenta.' },
  ];
  protected usuario = '';
  protected clave = '';
  protected ver = signal(false);
  protected mayus = signal(false);
  protected enviando = signal(false);
  protected error = signal<string | null>(null);

  constructor() {
    // Con sesión vigente no tiene sentido pedir la clave otra vez
    this.sesion.verificar().then(ok => { if (ok) this.router.navigateByUrl(this.destino()); });
    queueMicrotask(() => { if (this.solicitar_()) this.modo.set('solicitar'); });
  }

  /** Volver a donde iba (solo rutas internas); con clave temporal, primero a cambiarla; si no, la página de su rol */
  private destino() {
    const v = this.volver();
    if (this.sesion.usuario()?.debe_cambiar) return '/cuenta/clave';
    return v && v.startsWith('/') && !v.startsWith('//') && v !== '/acceso' ? v : this.sesion.inicio();
  }

  cambiarModo(m: 'entrar' | 'solicitar') { this.modo.set(m); this.error.set(null); this.errorSolicitud.set(null); }

  protected solicitudLista() {
    const s = this.sol;
    return s.nombre.trim().length >= 3 && /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(s.correo.trim()) && s.motivo.trim().length >= 30;
  }

  async solicitar() {
    if (!this.solicitudLista()) return;
    this.enviando.set(true);
    this.errorSolicitud.set(null);
    try {
      await this.cuentas.solicitar({ ...this.sol, nombre: this.sol.nombre.trim(), correo: this.sol.correo.trim(), organizacion: this.sol.organizacion.trim(), motivo: this.sol.motivo.trim() });
      this.modo.set('enviada');
    } catch (e) {
      this.errorSolicitud.set((e as Error).message);
    } finally {
      this.enviando.set(false);
    }
  }

  async entrar() {
    if (!this.usuario.trim() || !this.clave) return;
    this.enviando.set(true);
    this.error.set(null);
    try {
      await this.sesion.iniciar(this.usuario.trim(), this.clave);
      this.clave = '';
      await this.router.navigateByUrl(this.destino());
    } catch (e) {
      this.error.set((e as Error).message);
      this.clave = '';
    } finally {
      this.enviando.set(false);
    }
  }
}
