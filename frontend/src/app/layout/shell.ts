// Estructura de la aplicación: barra lateral colapsable, barra de comandos, contenido y panel contextual.
import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { haceCuanto } from '../core/formato';
import { NOMBRE_ROL, Sesion } from '../core/sesion';
import { SentinelStore } from '../core/store';
import { Tema } from '../core/tema';
import { Estado } from '../shared/ui';
import { DESTINOS, GRUPOS } from './navegacion';
import { Paleta } from './paleta';

@Component({
  selector: 'sx-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatTooltipModule, MatProgressBarModule, MatMenuModule, Paleta, Estado],
  host: { '(document:keydown)': 'atajo($event)', '[class.colapsada]': 'colapsada()', '[class.con-contexto]': 'contexto()' },
  template: `
    <a class="saltar" href="#contenido">Saltar al contenido</a>
    <div class="aurora" aria-hidden="true"><i></i><i></i><i></i></div>

    <nav class="lateral sx-glass" aria-label="Navegación principal">
      <a class="marca" [routerLink]="sesion.inicio()" aria-label="SENTINEL, inicio de la plataforma">
        <img src="sentinel.svg" width="34" height="34" alt="" />
        <span class="texto"><b>SENTINEL</b><small>Predictive Governance</small></span>
      </a>
      @for (g of grupos(); track g) {
        <div class="grupo">{{ g }}</div>
        @for (d of destinosDe(g); track d.ruta) {
          <a class="item" [routerLink]="d.ruta" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: false }"
             [matTooltip]="colapsada() ? d.titulo : ''" matTooltipPosition="right">
            <span class="material-symbols-rounded" aria-hidden="true">{{ d.icono }}</span>
            <span class="texto">{{ d.titulo }}</span>
            @if (d.ruta === '/decision' && store.candidatas().length) {
              <span class="badge" [attr.aria-label]="store.candidatas().length + ' candidatas pendientes'">{{ store.candidatas().length }}</span>
            }
          </a>
        }
      }
      <a class="item estudio" routerLink="/" [matTooltip]="colapsada() ? 'Ver el estudio' : ''" matTooltipPosition="right">
        <span class="material-symbols-rounded" aria-hidden="true">auto_stories</span><span class="texto">Ver el estudio</span>
      </a>
      <div class="lema">
        <span class="material-symbols-rounded" aria-hidden="true">shield_person</span>
        <span class="texto">Human-controlled AI. Ningún modelo llega a producción sin aprobación humana.</span>
      </div>
      <button class="colapsar" (click)="colapsada.set(!colapsada())" [attr.aria-label]="colapsada() ? 'Expandir menú' : 'Colapsar menú'">
        <span class="material-symbols-rounded" aria-hidden="true">{{ colapsada() ? 'chevron_right' : 'chevron_left' }}</span>
      </button>
    </nav>

    <header class="barra sx-glass">
      <button class="menu-movil sx-btn" (click)="colapsada.set(!colapsada())" aria-label="Menú">
        <span class="material-symbols-rounded">menu</span>
      </button>
      <div class="migas"><span class="sx-muted">SENTINEL /&nbsp;</span><b>{{ actual().titulo }}</b></div>
      <button class="busqueda" (click)="paleta.set(true)" aria-label="Abrir paleta de comandos (Control más K)">
        <span class="material-symbols-rounded" aria-hidden="true">search</span>
        <span class="ph">Buscar o ejecutar…</span><kbd>Ctrl K</kbd>
      </button>
      <div class="derecha">
        <span class="api" [class.on]="store.apiOnline()" [class.off]="store.apiOnline() === false" role="status"
              [matTooltip]="store.apiOnline() ? 'Crow responde en /api' : 'Sin conexión con Crow'">
          <span class="sx-dot pulse"></span>API {{ store.apiOnline() === null ? '…' : store.apiOnline() ? 'en línea' : 'sin conexión' }}
        </span>
        @if (store.activa(); as a) {
          <a class="modelo" routerLink="/historial" matTooltip="Modelo en producción">
            <span class="material-symbols-rounded" aria-hidden="true">deployed_code</span>{{ a.id }}
          </a>
        }
        <button class="icono" (click)="tema.alternar()" [attr.aria-label]="tema.modo() === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
                [matTooltip]="tema.modo() === 'dark' ? 'Modo claro' : 'Modo oscuro'">
          <span class="material-symbols-rounded">{{ tema.modo() === 'dark' ? 'light_mode' : 'dark_mode' }}</span>
        </button>
        <button class="icono" (click)="contexto.set(!contexto())" aria-label="Mostrar u ocultar panel contextual" matTooltip="Panel contextual">
          <span class="material-symbols-rounded">{{ contexto() ? 'right_panel_close' : 'right_panel_open' }}</span>
        </button>
        @if (sesion.usuario(); as u) {
          <button class="usuario" [matMenuTriggerFor]="menuUsuario" [attr.aria-label]="'Cuenta de ' + u.nombre">
            <span class="avatar">{{ sesion.iniciales() }}</span><span class="nombre">{{ u.nombre }}</span>
            <span class="material-symbols-rounded" aria-hidden="true">expand_more</span>
          </button>
          <mat-menu #menuUsuario="matMenu" xPosition="before">
            <div class="menu-cab" mat-menu-item disabled><b>{{ u.nombre }}</b><small>&#64;{{ u.usuario }} · {{ nombreRol[u.rol] }}</small></div>
            <a mat-menu-item routerLink="/"><span class="material-symbols-rounded menu-ico">auto_stories</span>Ver el estudio</a>
            <a mat-menu-item routerLink="/cuenta/clave"><span class="material-symbols-rounded menu-ico">key</span>Cambiar contraseña</a>
            <button mat-menu-item (click)="sesion.cerrar()"><span class="material-symbols-rounded menu-ico">logout</span>Cerrar sesión</button>
          </mat-menu>
        }
      </div>
      @if (store.trabajando()) { <mat-progress-bar class="progreso" mode="indeterminate" aria-label="Procesando" /> }
    </header>

    <main id="contenido" tabindex="-1"><router-outlet /></main>

    @if (contexto()) {
      <aside class="contexto sx-glass" aria-label="Panel contextual">
        <section>
          <div class="sx-eyebrow">Dataset en sesión</div>
          @if (store.archivo(); as f) {
            <div class="archivo"><span class="material-symbols-rounded" aria-hidden="true">description</span>
              <div><b>{{ f.name }}</b><small class="sx-muted">{{ (f.size / 1024).toFixed(0) }} KB</small></div></div>
            @if (store.validacion(); as v) { <sx-estado [estado]="v.estado" /> }
          } @else { <p class="sx-muted">Ninguno. Cárguelo en <a routerLink="/validacion">Validación</a>.</p> }
        </section>
        <section>
          <div class="sx-eyebrow">Gobierno</div>
          @if (store.activa(); as a) { <div class="fila"><sx-estado estado="activo" [pulso]="true" /><b class="mono">{{ a.id }}</b></div> }
          @for (c of store.candidatas(); track c.id) {
            <a class="fila" routerLink="/decision" [queryParams]="{ v: c.id }"><sx-estado estado="candidato" /><b class="mono">{{ c.id }}</b>
              <span class="sx-muted">revisar →</span></a>
          } @empty { <p class="sx-muted">Sin candidatas pendientes.</p> }
        </section>
        <section class="actividad">
          <div class="sx-eyebrow">Actividad reciente</div>
          @for (e of store.actividad().slice(0, 8); track e.fecha) {
            <div class="evento" [attr.data-tono]="e.tono"><span class="sx-dot"></span>
              <div><div>{{ e.titulo }}</div><small class="sx-muted">{{ hace(e.fecha) }}</small></div></div>
          } @empty { <p class="sx-muted">Todavía no hay actividad en este navegador.</p> }
        </section>
      </aside>
    }

    @if (paleta()) { <sx-paleta (cerrar)="paleta.set(false)" /> }`,
  styleUrl: './shell.scss',
})
export class Shell {
  protected store = inject(SentinelStore);
  protected tema = inject(Tema);
  protected sesion = inject(Sesion);
  protected nombreRol = NOMBRE_ROL;
  private router = inject(Router);
  private movil = toSignal(inject(BreakpointObserver).observe('(max-width: 900px)').pipe(map(r => r.matches)), { initialValue: false });
  protected colapsada = signal(false);
  protected contexto = signal(window.innerWidth >= 1400);
  protected paleta = signal(false);
  private visibles = computed(() => DESTINOS.filter(d => this.sesion.puede(d.roles)));
  protected grupos = computed(() => GRUPOS.filter(g => this.visibles().some(d => d.grupo === g)));
  protected destinosDe = (g: string) => this.visibles().filter(d => d.grupo === g);
  protected hace = haceCuanto;
  private url = toSignal(this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(e => (e as NavigationEnd).urlAfterRedirects)),
                         { initialValue: this.router.url });
  protected actual = computed(() => {
    const ruta = this.url().split('?')[0];
    return DESTINOS.find(d => d.ruta === ruta) ?? this.visibles()[0] ?? DESTINOS[0];
  });

  constructor() {
    // En pantallas pequeñas el menú arranca colapsado y se cierra al navegar
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => { if (this.movil()) this.colapsada.set(true); });
    if (window.innerWidth <= 900) this.colapsada.set(true);
  }

  atajo(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); this.paleta.set(!this.paleta()); }
  }
}
