// Palabra enlazada al glosario: <sx-termino t="brecha">brecha</sx-termino>.
// Con mouse o teclado muestra una vista previa de una línea; al hacer clic (o tocar en el celular) lleva a /glosario#id.
// La vista previa usa position: fixed para que ningún panel con overflow la recorte.
import { Component, ElementRef, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { termino } from './terminos';

let siguiente = 0;

@Component({
  selector: 'sx-termino',
  imports: [RouterLink],
  host: { '(window:scroll)': 'ocultar()' },
  template: `
    <a class="termino" routerLink="/glosario" [fragment]="t()" [attr.aria-describedby]="abierto() ? id : null"
       (mouseenter)="mostrar(true)" (mouseleave)="ocultar()" (focus)="mostrar(false)" (blur)="ocultar()"><ng-content /></a>
    @if (abierto() && def(); as d) {
      <span class="prev" role="tooltip" [id]="id" [class.arriba]="pos().arriba" [style.left.px]="pos().x" [style.top.px]="pos().y">
        <b><span class="material-symbols-rounded" aria-hidden="true">{{ d.icono }}</span>{{ d.termino }}</b>
        <span>{{ d.corto }}</span>
        <small>Clic para leer más en el glosario<span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></small>
      </span>
    }`,
  styles: `
    :host { display: inline; }
    .termino { color: inherit; font-weight: inherit; text-decoration: underline dotted color-mix(in srgb, var(--sx-accent) 75%, transparent);
      text-decoration-thickness: 1.5px; text-underline-offset: 4px; cursor: help; border-radius: 3px;
      background: linear-gradient(color-mix(in srgb, var(--sx-accent) 16%, transparent), color-mix(in srgb, var(--sx-accent) 16%, transparent)) no-repeat 0 100% / 0% 100%;
      transition: background-size var(--sx-med) var(--sx-ease), text-decoration-color var(--sx-fast); }
    .termino:hover, .termino:focus-visible { background-size: 100% 100%; text-decoration-style: solid; text-decoration-color: var(--sx-accent); }
    .termino:focus-visible { outline: 2px solid var(--sx-accent); outline-offset: 2px; }
    .prev { position: fixed; z-index: 1000; width: 300px; display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border-radius: 14px;
      background: var(--sx-glass); backdrop-filter: blur(18px) saturate(140%); border: 1px solid var(--sx-border-strong); box-shadow: var(--sx-shadow-lift);
      color: var(--sx-text); font: 400 14px/1.5 var(--sx-font); letter-spacing: 0; text-align: left; text-transform: none; pointer-events: none;
      animation: entra var(--sx-med) var(--sx-ease) both; }
    .prev.arriba { transform: translateY(-100%); animation-name: entra-arriba; }
    .prev b { display: flex; align-items: center; gap: 8px; font-weight: 650; font-size: 14.5px; }
    .prev b span { font-size: 19px; color: var(--sx-accent); }
    .prev > span { color: var(--sx-muted); }
    .prev small { display: inline-flex; align-items: center; gap: 4px; color: var(--sx-accent); font-weight: 600; font-size: 12px; }
    .prev small span { font-size: 15px; }
    @keyframes entra { from { opacity: 0; translate: 0 4px; } }
    @keyframes entra-arriba { from { opacity: 0; translate: 0 -4px; } }
    @media (prefers-reduced-motion: reduce) { .prev { animation: none; } .termino { transition: none; } }`,
})
export class TerminoEnlace {
  readonly t = input.required<string>();
  protected def = computed(() => termino(this.t()));
  protected abierto = signal(false);
  protected pos = signal({ x: 0, y: 0, arriba: false });
  protected id = `sx-termino-${++siguiente}`;
  private el = inject(ElementRef<HTMLElement>);
  private espera?: ReturnType<typeof setTimeout>;

  /** Con mouse solo en equipos con puntero fino (en el celular el toque navega directo); con teclado, siempre */
  mostrar(mouse: boolean) {
    if (mouse && !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    clearTimeout(this.espera);
    this.espera = setTimeout(() => {
      const r = (this.el.nativeElement as HTMLElement).getBoundingClientRect();
      const ancho = Math.min(300, innerWidth - 24);
      const x = Math.min(Math.max(12, r.left + r.width / 2 - ancho / 2), innerWidth - ancho - 12);
      const arriba = r.bottom + 170 > innerHeight;
      this.pos.set({ x, y: arriba ? r.top - 10 : r.bottom + 10, arriba });
      this.abierto.set(true);
    }, mouse ? 140 : 0);
  }
  ocultar() { clearTimeout(this.espera); this.abierto.set(false); }
}
