// Mapa del Chocó por municipio: SVG dibujado por Angular con los límites del DANE. Se colorea según el indicador
// elegido, responde al mouse y al teclado (Tab + Enter) y muestra el detalle del municipio seleccionado.
import { Component, ElementRef, computed, input, signal, viewChild } from '@angular/core';

import { num } from '../../core/formato';
import { Estudio, Municipio } from './datos';

interface Indicador { id: keyof Municipio; titulo: string; corto: string; unidad: string; dec: number; mejorAlto: boolean; divergente?: boolean; icono: string }

const INDICADORES: Indicador[] = [
  { id: 'puntaje', titulo: 'Puntaje global Saber 11', corto: 'Puntaje', unidad: ' pts', dec: 1, mejorAlto: true, icono: 'school' },
  { id: 'ipm', titulo: 'Personas en pobreza (censo 2018)', corto: 'Pobreza', unidad: ' %', dec: 1, mejorAlto: false, icono: 'home_work' },
  { id: 'cobertura_media', titulo: 'Jóvenes que estudian 10.° y 11.° (cobertura)', corto: 'Estudian', unidad: ' %', dec: 1, mejorAlto: true, icono: 'groups' },
  { id: 'internet_hogar', titulo: 'Estudiantes con internet en casa', corto: 'Internet', unidad: ' %', dec: 1, mejorAlto: true, icono: 'wifi' },
  { id: 'cambio_z', titulo: '¿Se acercó o se alejó del país desde 2014-2016?', corto: 'Cambio', unidad: '', dec: 2, mejorAlto: true, divergente: true, icono: 'trending_up' },
];

@Component({
  selector: 'sx-mapa-choco',
  template: `
    <div class="indicadores" role="radiogroup" aria-label="Indicador del mapa">
      @for (i of indicadores; track i.id) {
        <button role="radio" [attr.aria-checked]="ind().id === i.id" [class.sel]="ind().id === i.id" (click)="indId.set(i.id)">
          <span class="material-symbols-rounded" aria-hidden="true">{{ i.icono }}</span>{{ i.corto }}</button>
      }
    </div>

    <div class="cuerpo">
      <div class="lienzo" #lienzo (mouseleave)="hover.set(null)">
        <svg [attr.viewBox]="e().municipios.mapa.viewBox" role="group" [attr.aria-label]="'Mapa del Chocó: ' + ind().titulo">
          <defs>
            <filter id="brillo-mpio"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          @for (t of trazos(); track t.cod; let i = $index) {
            <path [attr.d]="t.d" [style.fill]="t.color" [class.sin-dato]="t.sinDato" [class.sel]="sel()?.cod === t.cod" [class.hover]="hover()?.cod === t.cod"
                  [style.animation-delay.ms]="i * 28" tabindex="0" role="button"
                  [attr.aria-label]="t.etiqueta" [attr.aria-pressed]="sel()?.cod === t.cod"
                  (mouseenter)="hover.set(t.m)" (mousemove)="mover($event)" (focus)="hover.set(t.m)" (blur)="hover.set(null)"
                  (click)="elegir(t.m)" (keydown.enter)="elegir(t.m)" (keydown.space)="$event.preventDefault(); elegir(t.m)" />
          }
          @if (quibdo(); as q) {
            <g class="capital" [attr.transform]="'translate(' + q.cx + ',' + q.cy + ')'" aria-hidden="true">
              <circle r="5" /><circle r="11" class="pulso" /><text x="10" y="-8">Quibdó</text>
            </g>
          }
        </svg>
        @if (hover(); as h) {
          <div class="tooltip" [style.left.px]="pos().x" [style.top.px]="pos().y" role="status">
            <b>{{ h.nombre }}</b><span>{{ ind().corto }}: <b>{{ valorTxt(h) }}</b></span>
            @if (h.puesto_pais) { <small>Puesto {{ h.puesto_pais }} de {{ e().municipios.total_municipios_pais }} en el país</small> }
          </div>
        }
        <div class="leyenda" aria-hidden="true">
          <span>{{ ind().divergente ? 'se alejó' : (ind().mejorAlto ? 'bajo' : 'alto') }}</span>
          <i [class.div]="ind().divergente"></i>
          <span>{{ ind().divergente ? 'se acercó' : (ind().mejorAlto ? 'alto' : 'bajo') }}</span>
          <span class="sd"><em></em>sin dato</span>
        </div>
      </div>

      <aside class="detalle" aria-live="polite">
        @if (sel(); as m) {
          <div class="sx-eyebrow">Municipio seleccionado</div>
          <h3>{{ m.nombre }}</h3>
          @if (m.en_10_mas_bajo) { <span class="sx-pill bad"><span class="sx-dot"></span>Entre los más bajos del país</span> }
          @else { <span class="sx-pill ok"><span class="sx-dot"></span>Fuera del grupo más bajo</span> }
          <div class="grande"><b>{{ fmt(m.puntaje, 1) }}</b><span>puntaje global promedio</span></div>
          <dl>
            <div><dt>Puesto en el país</dt><dd>{{ m.puesto_pais ?? '—' }} <small>de {{ e().municipios.total_municipios_pais }}</small></dd></div>
            <div><dt>Estudiantes</dt><dd>{{ fmt(m.estudiantes) }}</dd></div>
            <div><dt>Personas en pobreza</dt><dd>{{ fmt(m.ipm, 1) }} %</dd></div>
            <div><dt>Jóvenes que estudian 10.° y 11.°</dt><dd>{{ fmt(m.cobertura_media, 1) }} %</dd></div>
            <div><dt>Internet en casa</dt><dd>{{ fmt(m.internet_hogar, 1) }} %</dd></div>
            <div><dt>Cambio frente al país</dt><dd [class.pos]="(m.cambio_z ?? 0) > 0" [class.neg]="(m.cambio_z ?? 0) < 0">{{ (m.cambio_z ?? 0) > 0 ? '+' : '' }}{{ fmt(m.cambio_z, 2) }}</dd></div>
          </dl>
        } @else {
          <div class="sx-eyebrow">{{ ind().titulo }}</div>
          <p class="sx-muted">Pase el cursor por el mapa o toque un municipio para ver su ficha.</p>
        }
        <div class="ranking">
          <div class="sx-eyebrow">Ranking · {{ ind().corto }}</div>
          <ol>
            @for (m of ranking(); track m.cod; let i = $index) {
              <li [class.sel]="sel()?.cod === m.cod" (click)="elegir(m)" (mouseenter)="hover.set(m)" (mouseleave)="hover.set(null)">
                <span class="pos">{{ i + 1 }}</span><span class="nom">{{ m.nombre }}</span>
                <span class="barra"><span [style.width.%]="anchoBarra(m)" [style.background]="colorDe(m)"></span></span>
                <span class="val">{{ valorTxt(m) }}</span>
              </li>
            }
          </ol>
        </div>
      </aside>
    </div>`,
  styles: `
    :host { display: block; }
    .indicadores { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
    .indicadores button { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 999px; cursor: pointer;
                          border: 1px solid var(--sx-border-strong); background: var(--sx-card); color: var(--sx-muted); font: 600 13px var(--sx-font);
                          transition: all var(--sx-fast) var(--sx-ease); }
    .indicadores button span { font-size: 18px; }
    .indicadores button:hover { color: var(--sx-text); border-color: var(--sx-accent); }
    .indicadores button.sel { color: var(--sx-accent-ink); background: var(--sx-accent); border-color: transparent; box-shadow: var(--sx-glow); }
    .cuerpo { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 20px; align-items: start; }
    .lienzo { position: relative; border-radius: var(--sx-radius-lg); border: 1px solid var(--sx-border); padding: 16px;
              background: radial-gradient(500px 400px at 50% 40%, var(--sx-aurora-1), transparent), var(--sx-card); }
    svg { display: block; width: 100%; max-height: 640px; overflow: visible; }
    path { stroke: var(--sx-bg); stroke-width: 1; cursor: pointer; outline: none; opacity: 0; transform-box: fill-box; transform-origin: center;
           animation: aparecer 600ms var(--sx-ease) forwards; transition: fill 500ms var(--sx-ease), filter 200ms, stroke 200ms; }
    @keyframes aparecer { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: none; } }
    path.hover, path:focus-visible { stroke: var(--sx-text); stroke-width: 1.6; filter: url(#brillo-mpio); }
    path.sel { stroke: var(--sx-text); stroke-width: 2.4; }
    path.sin-dato { stroke: var(--sx-faint); stroke-dasharray: 3 3; }
    .capital { pointer-events: none; } .capital circle { fill: var(--sx-text); }
    .capital .pulso { fill: none; stroke: var(--sx-text); stroke-width: 1.2; animation: pulso 2.2s ease-out infinite; transform-box: fill-box; transform-origin: center; }
    @keyframes pulso { from { transform: scale(0.4); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }
    .capital text { fill: var(--sx-text); font: 700 11px var(--sx-font); paint-order: stroke; stroke: var(--sx-bg); stroke-width: 3px; }
    .tooltip { position: absolute; z-index: 2; pointer-events: none; transform: translate(14px, -50%); display: flex; flex-direction: column; gap: 2px;
               padding: 10px 12px; border-radius: 10px; background: var(--sx-glass); backdrop-filter: blur(10px); border: 1px solid var(--sx-border-strong);
               box-shadow: var(--sx-shadow-lift); font-size: 12.5px; white-space: nowrap; }
    .tooltip small { color: var(--sx-muted); }
    .leyenda { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 11.5px; color: var(--sx-muted); flex-wrap: wrap; }
    .leyenda i { width: 140px; height: 8px; border-radius: 4px; background: linear-gradient(90deg, var(--sx-danger), var(--sx-warning), var(--sx-accent)); }
    .leyenda i.div { background: linear-gradient(90deg, var(--sx-danger), var(--sx-panel), var(--sx-success)); }
    .leyenda .sd { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
    .leyenda em { width: 14px; height: 10px; border-radius: 2px; background: var(--sx-panel); border: 1px dashed var(--sx-faint); }
    .detalle { display: flex; flex-direction: column; gap: 10px; padding: 20px; border-radius: var(--sx-radius-lg); border: 1px solid var(--sx-border);
               background: var(--sx-card); box-shadow: var(--sx-shadow); }
    .detalle h3 { font-size: 22px; margin: -2px 0 2px; }
    .grande { display: flex; align-items: baseline; gap: 8px; } .grande b { font: 700 40px var(--sx-font); letter-spacing: -0.03em; }
    .grande span { color: var(--sx-muted); font-size: 12.5px; }
    dl { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 0; }
    dl div { padding: 8px 10px; border-radius: 10px; background: var(--sx-panel); }
    dt { font-size: 11px; color: var(--sx-muted); } dd { margin: 2px 0 0; font: 600 15px var(--sx-mono); } dd small { color: var(--sx-faint); font-size: 11px; }
    dd.pos { color: var(--sx-success); } dd.neg { color: var(--sx-danger); }
    kbd { font: 11px var(--sx-mono); padding: 1px 6px; border-radius: 6px; border: 1px solid var(--sx-border-strong); }
    .ranking ol { list-style: none; margin: 8px 0 0; padding: 0; max-height: 290px; overflow: auto; display: flex; flex-direction: column; gap: 2px; }
    .ranking li { display: grid; grid-template-columns: 20px minmax(0, 1fr) 56px 74px; gap: 8px; align-items: center; padding: 5px 6px; border-radius: 8px;
                  font-size: 12.5px; cursor: pointer; transition: background var(--sx-fast); }
    .ranking li:hover, .ranking li.sel { background: color-mix(in srgb, var(--sx-accent) 12%, transparent); }
    .pos { color: var(--sx-faint); font: 11px var(--sx-mono); } .nom { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .barra { height: 6px; border-radius: 3px; background: var(--sx-panel); overflow: hidden; }
    .barra span { display: block; height: 100%; border-radius: 3px; transition: width 600ms var(--sx-ease), background 500ms; }
    .val { text-align: right; font: 600 12px var(--sx-mono); white-space: nowrap; }
    @media (max-width: 1000px) { .cuerpo { grid-template-columns: 1fr; } svg { max-height: 520px; } }`,
})
export class MapaChoco {
  readonly e = input.required<Estudio>();
  protected indicadores = INDICADORES;
  protected indId = signal<keyof Municipio>('puntaje');
  protected ind = computed(() => INDICADORES.find(i => i.id === this.indId())!);
  protected hover = signal<Municipio | null>(null);
  protected sel = signal<Municipio | null>(null);
  protected pos = signal({ x: 0, y: 0 });
  private lienzo = viewChild.required<ElementRef<HTMLElement>>('lienzo');
  protected fmt = (x: number | null | undefined, d = 0) => num(x ?? null, d);

  private porCod = computed(() => new Map(this.e().municipios.lista.map(m => [m.cod, m])));
  private rango = computed(() => {
    const v = this.e().municipios.lista.map(m => m[this.ind().id] as number | null).filter((x): x is number => x !== null);
    return { min: Math.min(...v), max: Math.max(...v) };
  });

  colorDe(m: Municipio): string {
    const v = m[this.ind().id] as number | null;
    if (v === null || v === undefined) return 'color-mix(in srgb, var(--sx-faint) 35%, var(--sx-panel))';  // sin dato: ver .sin-dato
    const { min, max } = this.rango(), ind = this.ind();
    if (ind.divergente) {
      const lim = Math.max(Math.abs(min), Math.abs(max)) || 1, t = Math.min(1, Math.abs(v) / lim);
      return `color-mix(in oklab, ${v >= 0 ? 'var(--sx-success)' : 'var(--sx-danger)'} ${Math.round(18 + t * 82)}%, var(--sx-panel))`;
    }
    let t = max > min ? (v - min) / (max - min) : 0.5;
    if (!ind.mejorAlto) t = 1 - t;
    // Escala de tres paradas: peligro → advertencia → acento
    return t < 0.5 ? `color-mix(in oklab, var(--sx-warning) ${Math.round(t * 200)}%, var(--sx-danger))`
                   : `color-mix(in oklab, var(--sx-accent) ${Math.round((t - 0.5) * 200)}%, var(--sx-warning))`;
  }

  protected trazos = computed(() => this.e().municipios.mapa.municipios.map(t => {
    const m = this.porCod().get(t.cod) ?? ({ cod: t.cod, nombre: (t.nombre_mapa ?? t.cod) + ' (sin datos propios)' } as Municipio);
    const v = m[this.ind().id];
    return { ...t, m, sinDato: v === null || v === undefined, color: this.colorDe(m), etiqueta: `${m.nombre}: ${this.ind().corto} ${this.valorTxt(m)}` };
  }));
  protected quibdo = computed(() => this.e().municipios.mapa.puntos?.['quibdo'] ?? this.e().municipios.mapa.municipios.find(t => t.cod === '27001') ?? null);

  protected ranking = computed(() => {
    const id = this.ind().id, mejorAlto = this.ind().mejorAlto;
    return this.e().municipios.lista.filter(m => m[id] !== null)
      .sort((a, b) => ((b[id] as number) - (a[id] as number)) * (mejorAlto ? 1 : -1));
  });

  valorTxt(m: Municipio) {
    const v = m[this.ind().id] as number | null | undefined;
    if (v === null || v === undefined) return 'sin dato';
    return (this.ind().divergente && v > 0 ? '+' : '') + num(v, this.ind().dec) + this.ind().unidad;
  }
  anchoBarra(m: Municipio) {
    const v = m[this.ind().id] as number, { min, max } = this.rango();
    if (this.ind().divergente) return 50 + (v / (Math.max(Math.abs(min), Math.abs(max)) || 1)) * 50;
    return 12 + ((v - min) / ((max - min) || 1)) * 88;
  }
  mover(ev: MouseEvent) {
    const r = this.lienzo().nativeElement.getBoundingClientRect();
    this.pos.set({ x: ev.clientX - r.left, y: ev.clientY - r.top });
  }
  elegir(m: Municipio) { this.sel.set(this.sel()?.cod === m.cod ? null : m); }
}
