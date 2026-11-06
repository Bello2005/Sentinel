// Palabra enlazada al glosario: <sx-termino t="brecha">brecha</sx-termino>.
// Con mouse o teclado muestra una vista previa de una línea; al hacer clic (o tocar en el celular) lleva a /glosario#id.
// La vista previa se agrega directamente a <body>: así ningún bloque animado, con overflow o con su propio contexto de
// apilamiento la recorta, la desplaza o la deja detrás del texto. Sus estilos están en styles.scss (.sx-termino-prev).
import { Component, DestroyRef, ElementRef, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { termino } from './terminos';

let siguiente = 0;
const ANCHO = 300;
const MARGEN = 12;

@Component({
  selector: 'sx-termino',
  imports: [RouterLink],
  host: { '(window:scroll)': 'ocultar()', '(window:resize)': 'ocultar()' },
  template: `
    <a class="termino" routerLink="/glosario" [fragment]="t()" [attr.aria-describedby]="id"
       (mouseenter)="mostrar(true)" (mouseleave)="ocultar()" (focus)="mostrar(false)" (blur)="ocultar()" (click)="ocultar()"><ng-content /></a>`,
  styles: `
    :host { display: inline; }
    .termino { color: inherit; font-weight: inherit; text-decoration: underline dotted color-mix(in srgb, var(--sx-accent) 75%, transparent);
      text-decoration-thickness: 1.5px; text-underline-offset: 4px; cursor: help; border-radius: 3px;
      background: linear-gradient(color-mix(in srgb, var(--sx-accent) 16%, transparent), color-mix(in srgb, var(--sx-accent) 16%, transparent)) no-repeat 0 100% / 0% 100%;
      transition: background-size var(--sx-med) var(--sx-ease), text-decoration-color var(--sx-fast); }
    .termino:hover, .termino:focus-visible { background-size: 100% 100%; text-decoration-style: solid; text-decoration-color: var(--sx-accent); }
    .termino:focus-visible { outline: 2px solid var(--sx-accent); outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) { .termino { transition: none; } }`,
})
export class TerminoEnlace {
  readonly t = input.required<string>();
  protected def = computed(() => termino(this.t()));
  protected id = `sx-termino-${++siguiente}`;
  private el = inject(ElementRef<HTMLElement>);
  private espera?: ReturnType<typeof setTimeout>;
  private globo?: HTMLElement;

  constructor() { inject(DestroyRef).onDestroy(() => this.ocultar()); }

  /** Con mouse solo en equipos con puntero fino (en el celular el toque navega directo); con teclado, siempre */
  mostrar(mouse: boolean) {
    if (mouse && !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const d = this.def();
    if (!d) return;
    clearTimeout(this.espera);
    this.espera = setTimeout(() => {
      this.quitar();
      const g = document.createElement('div');
      g.className = 'sx-termino-prev';
      g.id = this.id;
      g.setAttribute('role', 'tooltip');
      const titulo = document.createElement('b');
      const icono = document.createElement('span');
      icono.className = 'material-symbols-rounded';
      icono.setAttribute('aria-hidden', 'true');
      icono.textContent = d.icono;
      titulo.append(icono, d.termino);
      const corto = document.createElement('p');
      corto.textContent = d.corto;
      const pie = document.createElement('small');
      pie.textContent = 'Clic para leer más en el glosario →';
      g.append(titulo, corto, pie);
      document.body.appendChild(g);
      this.globo = g;
      this.ubicar(g);
    }, mouse ? 140 : 0);
  }

  /** Abajo de la palabra si cabe; si no, arriba. El piquito apunta al centro de la línea donde está el cursor/foco */
  private ubicar(g: HTMLElement) {
    const enlace = (this.el.nativeElement as HTMLElement).querySelector('a')!;
    const lineas = Array.from(enlace.getClientRects());
    const ancho = Math.min(ANCHO, innerWidth - MARGEN * 2);
    g.style.width = `${ancho}px`;
    const alto = g.offsetHeight;
    const abajo = lineas.at(-1) ?? enlace.getBoundingClientRect();
    const arriba = lineas[0] ?? abajo;
    const vaArriba = abajo.bottom + alto + 14 > innerHeight && arriba.top - alto - 14 > 0;
    const ref = vaArriba ? arriba : abajo;
    const centro = ref.left + ref.width / 2;
    const x = Math.min(Math.max(MARGEN, centro - ancho / 2), innerWidth - ancho - MARGEN);
    g.style.left = `${x}px`;
    g.style.top = `${vaArriba ? ref.top - alto - 10 : ref.bottom + 10}px`;
    g.style.setProperty('--flecha', `${Math.min(Math.max(16, centro - x), ancho - 16)}px`);
    g.classList.add(vaArriba ? 'arriba' : 'abajo');
  }

  ocultar() { clearTimeout(this.espera); this.quitar(); }
  private quitar() { this.globo?.remove(); this.globo = undefined; }
}
