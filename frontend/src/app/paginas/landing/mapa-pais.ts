// Colombia por departamento, año a año: el mapa se colorea con la distancia al promedio nacional (desviaciones) y el
// ranking se reordena con animación. Se puede reproducir 2014 → 2022 o elegir un año con el control deslizante.
import { Component, OnDestroy, computed, input, signal } from '@angular/core';

import { num } from '../../core/formato';
import { Estudio } from './datos';

const ALTO_FILA = 26;

@Component({
  selector: 'sx-mapa-pais',
  template: `
    <div class="controles">
      <button class="play" (click)="alternar()" [attr.aria-label]="reproduciendo() ? 'Pausar' : 'Reproducir los años'">
        <span class="material-symbols-rounded">{{ reproduciendo() ? 'pause' : 'play_arrow' }}</span></button>
      <div class="linea">
        <input type="range" min="0" [max]="anios().length - 1" step="1" [value]="indice()" (input)="fijar(+$any($event.target).value)"
               [attr.aria-valuetext]="anio()" aria-label="Año" />
        <div class="marcas">@for (a of anios(); track a; let k = $index) { <button [class.sel]="k === i()" (click)="fijar(k)">{{ a }}</button> }</div>
      </div>
      <div class="anio" aria-live="polite">{{ anio() }}</div>
    </div>

    <div class="cuerpo">
      <div class="lienzo" (mouseleave)="hover.set(null)">
        <svg [attr.viewBox]="e().departamentos.mapa.viewBox" role="img" [attr.aria-label]="'Colombia por departamento y Bogotá en ' + anio() + '. El Chocó es el último.'">
          @for (t of trazos(); track t.cod) {
            <path [attr.d]="t.d" [style.fill]="t.color" [class.choco]="t.cod === '27'" [class.hover]="hover() === t.cod"
                  (mouseenter)="hover.set(t.cod)" />
          }
          @if (choco(); as c) {
            <g class="etiqueta" [attr.transform]="'translate(' + c.cx + ',' + c.cy + ')'" aria-hidden="true">
              <circle r="4" /><circle r="9" class="pulso" />
              <line x1="-6" y1="0" x2="-46" y2="-22" /><text x="-50" y="-26" text-anchor="end">Chocó · {{ puestoChoco() }}/{{ filas().length }}</text>
            </g>
          }
        </svg>
        <div class="leyenda" aria-hidden="true"><span>por debajo del país</span><i></i><span>por encima</span></div>
      </div>

      <div class="carrera" role="list" [attr.aria-label]="'Ranking de los departamentos y Bogotá en ' + anio()" [style.height.px]="filas().length * alto">
        @for (f of filas(); track f.nombre) {
          <div class="fila" role="listitem" [class.choco]="f.cod === '27'" [class.hover]="hover() === f.cod"
               [style.transform]="'translateY(' + f.puesto * alto + 'px)'" (mouseenter)="hover.set(f.cod)" (mouseleave)="hover.set(null)">
            <span class="pos">{{ f.puesto + 1 }}</span>
            <span class="nom">{{ f.nombre }}</span>
            <span class="barra"><span class="centro"></span>
              <span class="valor" [style.left.%]="f.z < 0 ? 50 + f.z / limite() * 50 : 50" [style.width.%]="(abs(f.z) / limite()) * 50"
                    [class.neg]="f.z < 0"></span></span>
            <span class="z">{{ f.z > 0 ? '+' : '' }}{{ fmt(f.z) }}</span>
          </div>
        }
      </div>
    </div>`,
  styles: `
    :host { display: block; }
    .controles { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
    .play { width: 46px; height: 46px; border-radius: 50%; border: 0; cursor: pointer; display: grid; place-items: center; flex: none;
            background: var(--sx-accent); color: var(--sx-accent-ink); box-shadow: var(--sx-glow); transition: transform var(--sx-fast); }
    .play:hover { transform: scale(1.06); }
    .linea { flex: 1; min-width: 0; }
    input[type=range] { width: 100%; accent-color: var(--sx-accent); }
    .marcas { display: flex; justify-content: space-between; }
    .marcas button { border: 0; background: none; color: var(--sx-faint); font: 600 11px var(--sx-mono); cursor: pointer; padding: 2px; }
    .marcas button.sel { color: var(--sx-accent); }
    .anio { font: 700 34px var(--sx-mono); letter-spacing: -0.04em; min-width: 90px; text-align: right;
            background: linear-gradient(120deg, var(--sx-text), var(--sx-accent)); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .cuerpo { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 24px; align-items: start; }
    .lienzo { position: relative; padding: 12px; border-radius: var(--sx-radius-lg); border: 1px solid var(--sx-border);
              background: radial-gradient(400px 400px at 40% 40%, var(--sx-aurora-1), transparent), var(--sx-card); }
    svg { display: block; width: 100%; max-height: 620px; overflow: visible; }
    path { stroke: var(--sx-bg); stroke-width: 0.8; transition: fill 700ms var(--sx-ease), opacity 200ms; }
    path.hover { stroke: var(--sx-text); stroke-width: 1.4; }
    path.choco { stroke: var(--sx-text); stroke-width: 1.8; }
    .etiqueta { pointer-events: none; } .etiqueta circle { fill: var(--sx-text); }
    .etiqueta .pulso { fill: none; stroke: var(--sx-text); animation: pulso 2s ease-out infinite; transform-box: fill-box; transform-origin: center; }
    @keyframes pulso { from { transform: scale(0.4); opacity: 1; } to { transform: scale(1.8); opacity: 0; } }
    .etiqueta line { stroke: var(--sx-text); stroke-width: 1; }
    .etiqueta text { fill: var(--sx-text); font: 700 12px var(--sx-font); paint-order: stroke; stroke: var(--sx-bg); stroke-width: 3px; }
    .leyenda { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 11.5px; color: var(--sx-muted); }
    .leyenda i { width: 130px; height: 8px; border-radius: 4px; background: linear-gradient(90deg, var(--sx-danger), var(--sx-panel), var(--sx-accent)); }
    .carrera { position: relative; }
    .fila { position: absolute; left: 0; right: 0; height: 24px; display: grid; grid-template-columns: 26px 150px 1fr 54px; gap: 8px; align-items: center;
            padding: 0 8px; border-radius: 6px; font-size: 12px; transition: transform 800ms var(--sx-ease), background 200ms; }
    .fila.hover { background: color-mix(in srgb, var(--sx-text) 6%, transparent); }
    .fila.choco { background: color-mix(in srgb, var(--sx-danger) 14%, transparent); font-weight: 700; }
    .pos { font: 11px var(--sx-mono); color: var(--sx-faint); } .nom { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .barra { position: relative; height: 8px; }
    .centro { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 1px; background: var(--sx-border-strong); }
    .valor { position: absolute; top: 0; height: 100%; border-radius: 4px; background: var(--sx-accent); transition: left 800ms var(--sx-ease), width 800ms var(--sx-ease); }
    .valor.neg { background: var(--sx-danger); opacity: 0.85; }
    .choco .valor.neg { opacity: 1; box-shadow: 0 0 10px var(--sx-danger); }
    .z { text-align: right; font: 600 11.5px var(--sx-mono); }
    @media (max-width: 1000px) { .cuerpo { grid-template-columns: 1fr; } .fila { grid-template-columns: 24px 110px 1fr 48px; } }`,
})
export class MapaPais implements OnDestroy {
  readonly e = input.required<Estudio>();
  protected alto = ALTO_FILA;
  protected i = signal(-1);  // -1 = último año
  protected hover = signal<string | null>(null);
  protected reproduciendo = signal(false);
  protected abs = Math.abs;
  protected fmt = (x: number) => num(x, 2);
  private reloj?: ReturnType<typeof setInterval>;

  protected anios = computed(() => this.e().departamentos.z_por_anio.anios);
  protected indice = computed(() => (this.i() < 0 ? this.anios().length - 1 : this.i()));
  protected anio = computed(() => this.anios()[this.indice()]);

  protected filas = computed(() => {
    const k = this.indice();
    const orden = this.e().departamentos.z_por_anio.series.filter(s => s.z[k] !== null)
      .map(s => ({ cod: s.cod, nombre: s.nombre, z: s.z[k] as number })).sort((a, b) => b.z - a.z);
    return orden.map((o, puesto) => ({ ...o, puesto }));
  });
  /** Escala común de las barras: el mayor valor absoluto de todos los años, para que el cambio entre años se vea */
  protected limite = computed(() => Math.max(0.5, ...this.e().departamentos.z_por_anio.series.flatMap(s => s.z.filter((x): x is number => x !== null).map(Math.abs))));
  protected puestoChoco = computed(() => (this.filas().find(f => f.cod === '27')?.puesto ?? 0) + 1);
  private zPorCod = computed(() => new Map(this.filas().map(f => [f.cod, f.z])));

  protected trazos = computed(() => this.e().departamentos.mapa.deptos.map(t => {
    const z = this.zPorCod().get(t.cod);
    let color = 'var(--sx-panel)';
    if (z !== undefined) {
      const k = Math.min(1, Math.abs(z) / 0.9);
      color = `color-mix(in oklab, ${z < 0 ? 'var(--sx-danger)' : 'var(--sx-accent)'} ${Math.round(12 + k * 88)}%, var(--sx-panel))`;
    }
    return { ...t, color };
  }));
  protected choco = computed(() => this.e().departamentos.mapa.deptos.find(t => t.cod === '27') ?? null);

  fijar(k: number) { this.i.set(k); this.detener(); }
  alternar() {
    if (this.reproduciendo()) { this.detener(); return; }
    this.reproduciendo.set(true);
    if (this.indice() === this.anios().length - 1) this.i.set(0);
    this.reloj = setInterval(() => {
      const sig = this.indice() + 1;
      if (sig >= this.anios().length) { this.detener(); return; }
      this.i.set(sig);
    }, 1300);
  }
  private detener() { clearInterval(this.reloj); this.reproduciendo.set(false); }
  ngOnDestroy() { clearInterval(this.reloj); }
}
