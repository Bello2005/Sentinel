// CAMBIAR CONTRASEÑA: obligatorio al entrar con una clave temporal (cuenta nueva o restablecida) y disponible
// siempre desde el menú de la cuenta. Fuera del shell para que nada más de la plataforma cargue antes.
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Sesion } from '../core/sesion';

@Component({
  selector: 'sx-cuenta-clave',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="aurora" aria-hidden="true"><i></i><i></i></div>
    <main class="centro">
      <form class="tarjeta" (ngSubmit)="guardar()" novalidate aria-labelledby="titulo-clave">
        <span class="candado" aria-hidden="true"><span class="material-symbols-rounded">key</span></span>
        <h1 id="titulo-clave">{{ obligatoria() ? 'Cree su contraseña' : 'Cambiar contraseña' }}</h1>
        <p class="sx-muted">
          @if (obligatoria()) { Hola, {{ primerNombre() }}. Entró con una contraseña temporal: cámbiela por una que solo usted conozca para continuar. }
          @else { Use al menos 10 caracteres. Una frase corta es fácil de recordar y difícil de adivinar. }
        </p>
        @if (error()) { <div class="aviso error" role="alert"><span class="material-symbols-rounded" aria-hidden="true">error</span>{{ error() }}</div> }

        <label class="campo"><span>{{ obligatoria() ? 'Contraseña temporal' : 'Contraseña actual' }}</span>
          <div class="entrada"><span class="material-symbols-rounded" aria-hidden="true">lock</span>
            <input name="actual" [type]="ver() ? 'text' : 'password'" [(ngModel)]="actual" autocomplete="current-password" required aria-label="Contraseña actual" /></div></label>
        <label class="campo"><span>Contraseña nueva</span>
          <div class="entrada"><span class="material-symbols-rounded" aria-hidden="true">key</span>
            <input name="nueva" [type]="ver() ? 'text' : 'password'" [(ngModel)]="nueva" autocomplete="new-password" required aria-label="Contraseña nueva" aria-describedby="fuerza" />
            <button type="button" class="ojo" (click)="ver.set(!ver())" [attr.aria-label]="ver() ? 'Ocultar contraseñas' : 'Mostrar contraseñas'" [attr.aria-pressed]="ver()">
              <span class="material-symbols-rounded">{{ ver() ? 'visibility_off' : 'visibility' }}</span></button></div>
          <div class="fuerza" id="fuerza" aria-live="polite">
            <span class="barra"><span [style.width.%]="fuerza().pct" [style.background]="fuerza().color"></span></span><small>{{ fuerza().texto }}</small></div>
        </label>
        <label class="campo"><span>Repita la contraseña nueva</span>
          <div class="entrada" [class.mal]="!!repetir && repetir !== nueva"><span class="material-symbols-rounded" aria-hidden="true">done_all</span>
            <input name="repetir" [type]="ver() ? 'text' : 'password'" [(ngModel)]="repetir" autocomplete="new-password" required aria-label="Repita la contraseña nueva" /></div>
          @if (repetir && repetir !== nueva) { <small class="no-coincide">Las contraseñas no coinciden.</small> }
        </label>

        <button class="sx-btn primary lg enviar" type="submit" [disabled]="guardando() || !lista()">
          @if (guardando()) { <span class="giro material-symbols-rounded" aria-hidden="true">progress_activity</span>Guardando… }
          @else { Guardar y continuar <span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span> }
        </button>
        <div class="pie">
          @if (!obligatoria()) { <a [routerLink]="sesion.inicio()">Cancelar</a> }
          <button type="button" (click)="sesion.cerrar()">Cerrar sesión</button>
        </div>
      </form>
    </main>`,
  styles: `
    :host { display: block; min-height: 100vh; position: relative; overflow: hidden; }
    .aurora { position: fixed; inset: 0; pointer-events: none; }
    .aurora i { position: absolute; width: 60vw; height: 60vw; border-radius: 50%; filter: blur(90px); }
    .aurora i:nth-child(1) { background: var(--sx-aurora-1); top: -30vw; left: -15vw; } .aurora i:nth-child(2) { background: var(--sx-aurora-2); bottom: -30vw; right: -10vw; }
    .centro { position: relative; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; }
    .tarjeta { width: min(440px, 100%); display: flex; flex-direction: column; gap: 16px; padding: 34px; border-radius: var(--sx-radius-lg);
      background: var(--sx-glass); backdrop-filter: blur(18px); border: 1px solid var(--sx-border-strong); box-shadow: var(--sx-shadow-lift); animation: sx-rise var(--sx-slow) var(--sx-ease) both; }
    .candado { width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; color: var(--sx-accent-ink); background: linear-gradient(135deg, var(--sx-accent), var(--sx-candidate)); }
    h1 { font-size: 24px; margin: 0; } .tarjeta > p { margin: -8px 0 0; line-height: 1.55; }
    .campo { display: flex; flex-direction: column; gap: 6px; } .campo > span { font-size: 13px; font-weight: 600; }
    .entrada { display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 12px; border-radius: 12px; background: var(--sx-panel); border: 1px solid var(--sx-border-strong);
      transition: border-color var(--sx-fast), box-shadow var(--sx-fast); }
    .entrada:focus-within { border-color: var(--sx-accent); box-shadow: var(--sx-glow); } .entrada.mal { border-color: color-mix(in srgb, var(--sx-danger) 60%, transparent); }
    .entrada > span { color: var(--sx-faint); }
    .entrada input { flex: 1; min-width: 0; height: 100%; background: none; border: 0; outline: none; color: var(--sx-text); font: 15px var(--sx-font); }
    .ojo { border: 0; background: none; color: var(--sx-muted); cursor: pointer; display: grid; place-items: center; padding: 4px; }
    .fuerza { display: flex; align-items: center; gap: 10px; } .fuerza small { font-size: 12px; color: var(--sx-muted); min-width: 120px; }
    .barra { flex: 1; height: 6px; border-radius: 99px; background: var(--sx-border); overflow: hidden; }
    .barra span { display: block; height: 100%; border-radius: 99px; transition: width var(--sx-med) var(--sx-ease), background var(--sx-med); }
    .no-coincide { color: var(--sx-danger); font-size: 12px; }
    .enviar { justify-content: center; width: 100%; }
    .giro { animation: girar 0.9s linear infinite; } @keyframes girar { to { transform: rotate(360deg); } }
    .aviso { display: flex; gap: 8px; padding: 10px 12px; border-radius: 10px; font-size: 13.5px; color: var(--sx-danger);
      background: color-mix(in srgb, var(--sx-danger) 10%, transparent); border: 1px solid color-mix(in srgb, var(--sx-danger) 35%, transparent); }
    .pie { display: flex; justify-content: center; gap: 18px; }
    .pie a, .pie button { border: 0; background: none; color: var(--sx-muted); font: 500 13.5px var(--sx-font); cursor: pointer; text-decoration: none; }
    .pie a:hover, .pie button:hover { color: var(--sx-text); }`,
})
export class CuentaClave {
  protected sesion = inject(Sesion);
  private router = inject(Router);
  protected actual = '';
  protected nueva = '';
  protected repetir = '';
  protected ver = signal(false);
  protected guardando = signal(false);
  protected error = signal<string | null>(null);
  protected obligatoria = computed(() => !!this.sesion.usuario()?.debe_cambiar);
  protected primerNombre = computed(() => (this.sesion.usuario()?.nombre ?? '').split(' ')[0]);

  /** Indicador sencillo: largo y variedad de caracteres */
  protected fuerza() {
    const c = this.nueva;
    if (!c) return { pct: 0, color: 'var(--sx-border)', texto: 'Mínimo 10 caracteres' };
    if (c.length < 10) return { pct: 20, color: 'var(--sx-danger)', texto: `Faltan ${10 - c.length} caracteres` };
    const tipos = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(r => r.test(c)).length + (c.length >= 16 ? 1 : 0);
    return tipos >= 4 ? { pct: 100, color: 'var(--sx-success)', texto: 'Muy buena' }
         : tipos >= 3 ? { pct: 70, color: 'var(--sx-accent)', texto: 'Buena' } : { pct: 45, color: 'var(--sx-warning)', texto: 'Aceptable' };
  }
  protected lista() { return !!this.actual && this.nueva.length >= 10 && this.nueva === this.repetir; }

  async guardar() {
    if (!this.lista()) return;
    this.guardando.set(true);
    this.error.set(null);
    try {
      await this.sesion.cambiarClave(this.actual, this.nueva);
      this.actual = this.nueva = this.repetir = '';
      await this.router.navigateByUrl(this.sesion.inicio());
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.guardando.set(false);
    }
  }
}
