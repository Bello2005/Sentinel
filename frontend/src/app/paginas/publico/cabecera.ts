// Cabecera de las páginas públicas (glosario y artículo): marca, enlaces entre las tres vistas, tema y acceso.
import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { Sesion } from '../../core/sesion';
import { Tema } from '../../core/tema';

export const VISTAS_PUBLICAS = [
  { ruta: '/', titulo: 'El estudio', icono: 'insights', exacto: true },
  { ruta: '/proceso', titulo: 'Cómo lo hicimos', icono: 'auto_stories', exacto: false },
  { ruta: '/glosario', titulo: 'Glosario', icono: 'menu_book', exacto: false },
];

@Component({
  selector: 'sx-cabecera',
  imports: [RouterLink, RouterLinkActive],
  host: { '(window:scroll)': 'alDesplazar()' },
  template: `
    <header class="nav" [class.compacta]="compacta()">
      <div class="nav-in">
        <a class="marca" routerLink="/" aria-label="SENTINEL, volver al estudio">
          <img src="sentinel.svg" width="32" height="32" alt="" />
          <span><b>SENTINEL</b><small>Estudio Saber 11 · Chocó</small></span>
        </a>
        <nav class="enlaces" aria-label="Páginas del estudio">
          @for (v of vistas; track v.ruta) {
            <a [routerLink]="v.ruta" routerLinkActive="activa" [routerLinkActiveOptions]="{ exact: v.exacto }" ariaCurrentWhenActive="page">
              <span class="material-symbols-rounded" aria-hidden="true">{{ v.icono }}</span>{{ v.titulo }}</a>
          }
        </nav>
        <div class="acciones">
          <button class="icono" (click)="tema.alternar()" [attr.aria-label]="tema.modo() === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'">
            <span class="material-symbols-rounded">{{ tema.modo() === 'dark' ? 'light_mode' : 'dark_mode' }}</span></button>
          <a class="sx-btn primary" [routerLink]="sesion.activa() ? '/centro' : '/acceso'">
            <span class="material-symbols-rounded">{{ sesion.activa() ? 'space_dashboard' : 'lock' }}</span><span class="txt">{{ sesion.activa() ? 'Plataforma' : 'Acceder' }}</span></a>
          <button class="icono menu" (click)="menu.set(!menu())" [attr.aria-expanded]="menu()" aria-controls="menu-publico" aria-label="Menú">
            <span class="material-symbols-rounded">{{ menu() ? 'close' : 'menu' }}</span></button>
        </div>
      </div>
      @if (menu()) {
        <nav id="menu-publico" class="menu-movil" aria-label="Páginas del estudio">
          @for (v of vistas; track v.ruta) {
            <a [routerLink]="v.ruta" (click)="menu.set(false)"><span class="material-symbols-rounded" aria-hidden="true">{{ v.icono }}</span>{{ v.titulo }}</a>
          }
        </nav>
      }
    </header>`,
  styles: `
    :host { display: block; position: sticky; top: 0; z-index: 60; }
    .nav { transition: background var(--sx-med), box-shadow var(--sx-med), border-color var(--sx-med); border-bottom: 1px solid transparent; }
    .nav.compacta { background: var(--sx-glass); backdrop-filter: blur(16px) saturate(140%); border-color: var(--sx-border); box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12); }
    .nav-in { max-width: 1240px; margin: 0 auto; height: 68px; padding: 0 24px; display: flex; align-items: center; gap: 24px; }
    .marca { display: flex; align-items: center; gap: 10px; text-decoration: none; color: inherit; flex: none; }
    .marca img { filter: drop-shadow(0 0 10px rgba(110, 231, 255, 0.35)); }
    .marca b { display: block; letter-spacing: 0.18em; font-size: 14px; } .marca small { display: block; color: var(--sx-muted); font-size: 11px; }
    .enlaces { display: flex; gap: 4px; margin: 0 auto; }
    .enlaces a { position: relative; display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; border-radius: 10px; color: var(--sx-muted);
      text-decoration: none; font-size: 14px; font-weight: 500; transition: color var(--sx-fast), background var(--sx-fast); }
    .enlaces a span { font-size: 18px; }
    .enlaces a:hover { color: var(--sx-text); background: color-mix(in srgb, var(--sx-text) 5%, transparent); }
    .enlaces a.activa { color: var(--sx-text); }
    .enlaces a.activa::after { content: ''; position: absolute; left: 14px; right: 14px; bottom: 2px; height: 2px; border-radius: 2px; background: var(--sx-accent); box-shadow: 0 0 10px var(--sx-accent); }
    .acciones { display: flex; align-items: center; gap: 10px; }
    .icono { width: 38px; height: 38px; border-radius: 10px; border: 1px solid var(--sx-border); background: transparent; color: var(--sx-muted); cursor: pointer; display: grid; place-items: center; }
    .icono:hover { color: var(--sx-text); border-color: var(--sx-border-strong); }
    .icono.menu { display: none; }
    .menu-movil { display: flex; flex-direction: column; padding: 8px 16px 16px; background: var(--sx-glass); backdrop-filter: blur(16px); border-bottom: 1px solid var(--sx-border); }
    .menu-movil a { display: flex; align-items: center; gap: 10px; padding: 14px 8px; color: var(--sx-text); text-decoration: none; border-bottom: 1px solid var(--sx-border); }
    .menu-movil a span { color: var(--sx-accent); }
    @media (max-width: 860px) { .enlaces { display: none; } .icono.menu { display: grid; } .acciones { margin-left: auto; } }
    @media (max-width: 520px) { .nav-in { padding: 0 16px; gap: 12px; } .marca small { display: none; } .sx-btn .txt { display: none; } }`,
})
export class Cabecera {
  protected tema = inject(Tema);
  protected sesion = inject(Sesion);
  protected vistas = VISTAS_PUBLICAS;
  protected compacta = signal(false);
  protected menu = signal(false);
  constructor() { this.sesion.verificar(); }
  alDesplazar() { this.compacta.set(scrollY > 24); }
}
