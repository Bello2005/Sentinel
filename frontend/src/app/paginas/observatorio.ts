// DATA OBSERVATORY: el EDA convertido en una exploración. Todo sale de POST /api/eda (Crow decide qué analizar según
// el tipo de cada columna); aquí solo se elige cómo contarlo visualmente.
import { Component, computed, inject, signal } from '@angular/core';
import { ApexOptions } from 'apexcharts';

import { VariableEda } from '../core/api';
import { num, pct } from '../core/formato';
import { SentinelStore } from '../core/store';
import { Grafica } from '../shared/grafica';
import { EJEMPLOS_PREDICCION, Ejemplos } from '../shared/ejemplos';
import { Kpi, Vacio, ZonaArchivo } from '../shared/ui';

const ICONO_TIPO: Record<string, string> = { numerica: 'functions', discreta: 'pin', categorica: 'category', temporal: 'calendar_month', identificador: 'fingerprint', texto: 'notes', vacia: 'block' };

@Component({
  selector: 'sx-observatorio',
  imports: [Grafica, Kpi, Vacio, ZonaArchivo, Ejemplos],
  template: `
    <div class="sx-page">
      <header class="sx-page-head">
        <div>
          <div class="sx-eyebrow">EDA automático</div>
          <h1>Data Observatory</h1>
          <p>El análisis se adapta al archivo: detecta el tipo de cada columna y decide qué medir y cómo graficarlo.
             Funciona aunque el archivo no sea compatible con el modelo, para entender qué corregir.</p>
        </div>
        <div class="acciones">
          <sx-ejemplos [ejemplos]="ejemplos" (elegido)="store.fijarArchivo($event); store.analizar()" />
        @if (store.archivo()) {
            @if (r(); as r) { <a class="sx-btn" [href]="r.descargas['eda.html']" target="_blank" rel="noopener"><span class="material-symbols-rounded">download</span>Reporte EDA</a> }
            <button class="sx-btn primary" [disabled]="store.ocupado().eda" (click)="store.analizar()">
              <span class="material-symbols-rounded">{{ store.ocupado().eda ? 'progress_activity' : 'radar' }}</span>
              {{ r() ? 'Volver a analizar' : 'Ejecutar EDA' }}</button>
        }
        </div>
      </header>

      @if (!store.archivo()) {
        <sx-zona-archivo [archivo]="null" titulo="Suelte un dataset para observarlo" (elegido)="store.fijarArchivo($event); store.analizar()" />
      } @else if (!r()) {
        @if (store.ocupado().eda) {
          <div class="sx-grid perfil">@for (i of [1, 2, 3, 4, 5]; track i) { <div class="sx-card"><div class="sx-skeleton" style="height:60px"></div></div> }</div>
        } @else {
          <sx-vacio icono="travel_explore" [titulo]="store.archivo()!.name" texto="El dataset está en sesión. Ejecute el EDA para generar el perfil completo.">
            <button class="sx-btn primary" (click)="store.analizar()"><span class="material-symbols-rounded">radar</span>Ejecutar EDA</button>
          </sx-vacio>
        }
      }

      @if (e(); as e) {
        <div class="perfil sx-grid sx-stagger">
          <sx-kpi etiqueta="Filas" [valor]="e.general.filas" icono="table_rows" />
          <sx-kpi etiqueta="Columnas" [valor]="e.general.columnas" icono="view_column" />
          <sx-kpi etiqueta="Completitud" [valor]="(1 - e.general.proporcion_vacias) * 100" [decimales]="1" sufijo=" %" icono="water_drop"
                  [tono]="e.general.proporcion_vacias > 0.05 ? 'warn' : 'ok'" [detalle]="num(e.general.celdas_vacias) + ' celdas vacías'" />
          <sx-kpi etiqueta="Duplicadas" [valor]="e.general.filas_duplicadas" icono="content_copy" [tono]="e.general.filas_duplicadas ? 'warn' : 'ok'"
                  [detalle]="e.general.filas_duplicadas ? 'Filas exactamente iguales' : 'Sin filas repetidas'" />
          <sx-kpi etiqueta="Posibles atípicos" [valor]="totalAtipicos()" icono="scatter_plot" [tono]="totalAtipicos() ? 'warn' : 'ok'" detalle="Regla de Tukey (1,5·RIC)" />
        </div>

        <div class="fila3">
          <section class="sx-card">
            <div class="cab"><h3>Data quality radar</h3></div>
            <sx-grafica [opciones]="radar()" [alto]="290" etiqueta="Radar de calidad de datos" />
            <p class="nota sx-muted">Índices 0-100 calculados del perfil: completitud, unicidad, validez numérica, ausencia de atípicos y estructura (columnas con tipo reconocible).</p>
          </section>
          <section class="sx-card">
            <div class="cab"><h3>Composición del dataset</h3></div>
            <sx-grafica [opciones]="tipos()" [alto]="290" etiqueta="Variables por tipo" />
          </section>
          <section class="sx-card narrativa">
            <div class="cab"><h3>Lo que dicen los datos</h3><span class="material-symbols-rounded" aria-hidden="true">auto_awesome</span></div>
            <ol>
              @for (o of e.observaciones.slice(0, 9); track $index) { <li [style.animation-delay.ms]="$index * 60">{{ o }}</li> }
              @empty { <li>Sin observaciones: el dataset no presenta vacíos, atípicos ni relaciones destacadas.</li> }
            </ol>
          </section>
        </div>

        <section class="sx-card">
          <div class="cab"><h3>Missing values map</h3><span class="sx-muted">porcentaje de vacíos por variable</span></div>
          <sx-grafica [opciones]="faltantes()" [alto]="150" etiqueta="Mapa de valores faltantes por variable" />
        </section>

        <section class="explorador">
          <nav class="sx-card lista" aria-label="Variables">
            <div class="sx-eyebrow">Variables ({{ e.variables.length }})</div>
            @for (v of e.variables; track v.nombre) {
              <button [class.sel]="sel()?.nombre === v.nombre" (click)="elegida.set(v.nombre)" [attr.aria-pressed]="sel()?.nombre === v.nombre">
                <span class="material-symbols-rounded" aria-hidden="true">{{ icono(v.tipo) }}</span>
                <span class="n mono">{{ v.nombre }}</span><span class="t">{{ v.tipo }}</span>
                @if (v.vacios) { <span class="vac" [title]="v.vacios + ' vacíos'"></span> }
              </button>
            }
          </nav>
          @if (sel(); as v) {
            <div class="sx-card detalle" [attr.aria-live]="'polite'">
              <div class="cab"><div><div class="sx-eyebrow">{{ v.tipo }}</div><h2 class="mono">{{ v.nombre }}</h2></div>
                <div class="chips"><span class="sx-pill">{{ num(v.distintos) }} distintos</span>
                  <span class="sx-pill" [class.warn]="v.vacios">{{ pct(v.proporcion_vacios) }} vacíos</span></div></div>
              @if (v.estadisticas; as s) {
                <div class="stats">
                  @for (x of [['Media', s.media], ['Mediana', s.mediana], ['Desv.', s.desviacion], ['Mín', s.minimo], ['Q1', s.q1], ['Q3', s.q3], ['Máx', s.maximo], ['Asimetría', s.asimetria]]; track x[0]) {
                    <div><span class="sx-eyebrow">{{ x[0] }}</span><b>{{ num(+x[1], 2) }}</b></div>
                  }
                </div>
                <div class="graficas">
                  @if (v.tipo === 'discreta') { <sx-grafica [opciones]="barras(v)" [alto]="260" [etiqueta]="'Frecuencias de ' + v.nombre" /> }
                  @else { <sx-grafica [opciones]="histograma(v)" [alto]="260" [etiqueta]="'Distribución de ' + v.nombre" /> }
                  <sx-grafica [opciones]="caja(v)" [alto]="260" [etiqueta]="'Caja y atípicos de ' + v.nombre" />
                </div>
                <p class="sx-muted nota">Atípicos: {{ s.atipicos.criterio }}@if (s.atipicos.cantidad) { — {{ s.atipicos.cantidad }} valores ({{ pct(s.atipicos.proporcion) }}) fuera de
                  [{{ num(s.atipicos.limite_inferior, 2) }}, {{ num(s.atipicos.limite_superior, 2) }}]; filas {{ s.atipicos.ejemplo_filas.slice(0, 8).join(', ') }}… }</p>
              } @else if (v.frecuencias) {
                <sx-grafica [opciones]="v.tipo === 'temporal' ? linea(v) : barras(v)" [alto]="300" [etiqueta]="'Frecuencias de ' + v.nombre" />
              } @else if (v.texto; as t) {
                <div class="stats"><div><span class="sx-eyebrow">Longitud</span><b>{{ t.longitud_min }}–{{ t.longitud_max }}</b></div>
                  <div><span class="sx-eyebrow">Repetidos</span><b>{{ num(t.repetidos) }}</b></div></div>
                <p class="sx-muted">Ejemplos: @for (x of t.ejemplos; track $index) { <code>{{ x }}</code> } </p>
                <p class="sx-muted nota">Columna de identificación o texto libre: se describe, pero no se grafica ni se correlaciona.</p>
              }
            </div>
          }
        </section>

        @if (e.correlaciones.variables.length > 1) {
          <div class="fila2">
            <section class="sx-card">
              <div class="cab"><h3>Correlaciones</h3><span class="sx-muted">Pearson · asociación, no causalidad</span></div>
              <sx-grafica [opciones]="calor()" [alto]="440" etiqueta="Mapa de calor de correlaciones" />
            </section>
            <section class="sx-card">
              <div class="cab"><h3>Relaciones destacadas</h3></div>
              <ul class="relaciones">
                @for (rel of e.relaciones.slice(0, 8); track $index) {
                  <li><div class="barra"><span [style.width.%]="abs(rel.valor) * 100" [class.neg]="rel.valor < 0"></span></div>
                    <b class="mono">{{ rel.variables[0] }} ↔ {{ rel.variables[1] }}</b>
                    <small class="sx-muted">{{ rel.descripcion }}</small></li>
                } @empty { <li class="sx-muted">No hay asociaciones por encima de los umbrales.</li> }
              </ul>
            </section>
          </div>
        }

        @if (e.dispersion.length) {
          <div class="dispersion">
            @for (d of e.dispersion; track d.x + d.y) {
              <section class="sx-card"><h3 class="mono">{{ d.y }} vs {{ d.x }}</h3>
                <sx-grafica [opciones]="puntos(d)" [alto]="260" [etiqueta]="d.y + ' frente a ' + d.x" /></section>
            }
          </div>
        }
      }
    </div>`,
  styles: `
    .acciones { display: flex; gap: 10px; }
    .perfil { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
    .cab { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; }
    .fila3 { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 16px; }
    .fila2 { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; }
    .nota { font-size: 12px; margin: 6px 0 0; }
    .narrativa .cab span { color: var(--sx-candidate); }
    .narrativa ol { margin: 0; padding: 0; list-style: none; counter-reset: n; display: flex; flex-direction: column; gap: 10px; }
    .narrativa li { counter-increment: n; position: relative; padding-left: 30px; font-size: 13px; animation: sx-rise var(--sx-slow) var(--sx-ease) both; }
    .narrativa li::before { content: counter(n); position: absolute; left: 0; top: 1px; width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center;
                            font: 600 11px var(--sx-mono); background: color-mix(in srgb, var(--sx-accent) 16%, transparent); color: var(--sx-accent); }
    .explorador { display: grid; grid-template-columns: 260px 1fr; gap: 16px; align-items: start; }
    .lista { display: flex; flex-direction: column; gap: 2px; padding: 14px; position: sticky; top: 84px; max-height: calc(100vh - 110px); overflow: auto; }
    .lista .sx-eyebrow { padding: 0 8px 8px; }
    .lista button { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 8px; border: 0; background: none; color: var(--sx-muted); cursor: pointer; text-align: left; font: inherit; }
    .lista button:hover { background: color-mix(in srgb, var(--sx-text) 5%, transparent); color: var(--sx-text); }
    .lista button.sel { background: color-mix(in srgb, var(--sx-accent) 13%, transparent); color: var(--sx-text); }
    .lista button.sel .material-symbols-rounded { color: var(--sx-accent); }
    .lista .material-symbols-rounded { font-size: 18px; } .lista .n { flex: 1; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; }
    .lista .t { font-size: 10.5px; color: var(--sx-faint); } .vac { width: 6px; height: 6px; border-radius: 50%; background: var(--sx-warning); }
    .detalle { animation: sx-rise var(--sx-med) var(--sx-ease); min-width: 0; }
    .detalle h2 { font-size: 22px; } .chips { display: flex; gap: 8px; } .chips .warn { color: var(--sx-warning); }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; margin: 14px 0; }
    .stats div { padding: 10px 12px; border-radius: 10px; background: var(--sx-panel); display: flex; flex-direction: column; gap: 2px; }
    .stats b { font: 600 16px var(--sx-mono); }
    .graficas { display: grid; grid-template-columns: 1.6fr 1fr; gap: 12px; }
    .relaciones { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
    .relaciones li { display: flex; flex-direction: column; gap: 4px; } .relaciones small { font-size: 12px; }
    .barra { height: 6px; border-radius: 3px; background: var(--sx-panel); overflow: hidden; }
    .barra span { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--sx-active), var(--sx-accent)); transition: width 0.8s var(--sx-ease); }
    .barra span.neg { background: linear-gradient(90deg, var(--sx-candidate), var(--sx-danger)); }
    .dispersion { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
    .dispersion h3 { font-size: 14px; margin-bottom: 6px; }
    @media (max-width: 1200px) { .fila3, .fila2 { grid-template-columns: 1fr; } }
    @media (max-width: 860px) { .explorador, .graficas { grid-template-columns: 1fr; } .lista { position: static; max-height: 260px; } }`,
})
export class Observatorio {
  protected store = inject(SentinelStore);
  protected ejemplos = EJEMPLOS_PREDICCION;
  protected r = this.store.eda;
  protected e = computed(() => this.r()?.eda ?? null);
  protected elegida = signal<string | null>(null);
  protected num = num;
  protected pct = pct;
  protected abs = Math.abs;
  protected icono = (t: string) => ICONO_TIPO[t] ?? 'help';

  protected sel = computed<VariableEda | null>(() => {
    const vs = this.e()?.variables ?? [];
    return vs.find(v => v.nombre === this.elegida()) ?? vs.find(v => v.tipo === 'numerica') ?? vs[0] ?? null;
  });
  protected totalAtipicos = computed(() => (this.e()?.variables ?? []).reduce((s, v) => s + (v.estadisticas?.atipicos.cantidad ?? 0), 0));

  protected radar = computed<ApexOptions>(() => {
    const e = this.e()!, vs = e.variables, nums = vs.filter(v => v.estadisticas);
    const validez = nums.length ? 1 - nums.reduce((s, v) => s + v.estadisticas!.valores_no_numericos / Math.max(1, v.no_vacios), 0) / nums.length : 1;
    const atip = nums.length ? 1 - nums.reduce((s, v) => s + v.estadisticas!.atipicos.proporcion, 0) / nums.length : 1;
    const estructura = vs.filter(v => !['texto', 'vacia'].includes(v.tipo)).length / Math.max(1, vs.length);
    const valores = [1 - e.general.proporcion_vacias, 1 - e.general.filas_duplicadas / Math.max(1, e.general.filas), validez, atip, estructura]
      .map(x => Math.round(Math.max(0, x) * 100));
    return {
      chart: { type: 'radar' },
      series: [{ name: 'Calidad', data: valores }],
      labels: ['Completitud', 'Unicidad', 'Validez', 'Sin atípicos', 'Estructura'],
      yaxis: { show: false, min: 0, max: 100 },
      fill: { opacity: 0.25 }, markers: { size: 4 },
      plotOptions: { radar: { polygons: { strokeColors: 'rgba(148,163,184,0.25)', connectorColors: 'rgba(148,163,184,0.25)', fill: { colors: ['transparent'] } } } },
      dataLabels: { enabled: true, background: { enabled: false }, style: { fontSize: '11px' } },
    };
  });

  protected tipos = computed<ApexOptions>(() => {
    const t = this.e()!.general.variables_por_tipo;
    return { chart: { type: 'donut' }, series: Object.values(t), labels: Object.keys(t), legend: { position: 'bottom' },
             plotOptions: { pie: { donut: { size: '68%', labels: { show: true, total: { show: true, label: 'variables' } } } } }, stroke: { width: 0 } };
  });

  protected faltantes = computed<ApexOptions>(() => {
    const vs = this.e()!.variables;
    return {
      chart: { type: 'heatmap' },
      series: [{ name: '% vacíos', data: vs.map(v => ({ x: v.nombre, y: +(v.proporcion_vacios * 100).toFixed(2) })) }],
      plotOptions: { heatmap: { radius: 4, enableShades: false, colorScale: { ranges: [
        { from: 0, to: 0, color: '#22C55E', name: 'completa' }, { from: 0.0001, to: 5, color: '#F59E0B', name: '< 5 %' },
        { from: 5.0001, to: 100, color: '#EF4444', name: '≥ 5 %' }] } } },
      dataLabels: { enabled: true, formatter: (v: number) => (v ? `${v}%` : '') },
      xaxis: { labels: { rotate: -40, style: { fontSize: '10px' } } }, legend: { position: 'top' }, stroke: { width: 2, colors: ['transparent'] },
    };
  });

  histograma(v: VariableEda): ApexOptions {
    const h = v.estadisticas!.histograma;
    const etiqueta = (i: number) => `${num(h.bordes[i], Math.abs(h.bordes[i]) < 10 ? 2 : 0)}–${num(h.bordes[i + 1], Math.abs(h.bordes[i + 1]) < 10 ? 2 : 0)}`;
    return { chart: { type: 'bar' }, series: [{ name: 'Filas', data: h.conteos }], xaxis: { categories: h.conteos.map((_, i) => etiqueta(i)), labels: { rotate: -35, style: { fontSize: '10px' } } },
             plotOptions: { bar: { columnWidth: '96%', borderRadius: 3 } }, fill: { type: 'gradient', gradient: { shade: 'dark', type: 'vertical', opacityFrom: 1, opacityTo: 0.55 } } };
  }
  caja(v: VariableEda): ApexOptions {
    const s = v.estadisticas!;
    return { chart: { type: 'boxPlot' },
             series: [{ name: 'Caja', type: 'boxPlot', data: [{ x: v.nombre, y: [s.caja.min, s.caja.q1, s.caja.mediana, s.caja.q3, s.caja.max] }] },
                      { name: 'Atípicos', type: 'scatter', data: s.atipicos.ejemplos.map(y => ({ x: v.nombre, y })) }],
             plotOptions: { boxPlot: { colors: { upper: this.color('accent'), lower: this.color('active') } } }, markers: { size: 5 }, colors: [this.color('accent'), this.color('warning')] };
  }
  barras(v: VariableEda): ApexOptions {
    const f = v.frecuencias!;
    return { chart: { type: 'bar' }, series: [{ name: 'Filas', data: f.map(x => x.conteo) }], xaxis: { categories: f.map(x => x.valor), labels: { rotate: -35 } },
             plotOptions: { bar: { borderRadius: 6, distributed: true, columnWidth: '60%' } }, legend: { show: false },
             tooltip: { y: { formatter: (c: number, o?: { dataPointIndex: number }) => `${num(c)} (${pct(f[o?.dataPointIndex ?? 0].proporcion)})` } } };
  }
  linea(v: VariableEda): ApexOptions {
    const f = v.frecuencias!;
    return { chart: { type: 'area' }, series: [{ name: 'Registros', data: f.map(x => x.conteo) }], xaxis: { categories: f.map(x => x.valor) },
             fill: { type: 'gradient', gradient: { opacityFrom: 0.45, opacityTo: 0.02 } }, markers: { size: 4 } };
  }
  protected calor = computed<ApexOptions>(() => {
    const c = this.e()!.correlaciones;
    return {
      chart: { type: 'heatmap' },
      series: [...c.variables].reverse().map((fila, ir) => {
        const i = c.variables.length - 1 - ir;
        return { name: fila, data: c.variables.map((col, j) => ({ x: col, y: c.matriz[i][j] ?? 0 })) };
      }),
      plotOptions: { heatmap: { radius: 3, colorScale: { ranges: [
        { from: -1, to: -0.5, color: '#EF4444' }, { from: -0.5, to: -0.15, color: '#F59E0B' }, { from: -0.15, to: 0.15, color: '#334155' },
        { from: 0.15, to: 0.5, color: '#06B6D4' }, { from: 0.5, to: 1, color: '#6EE7FF' }] } } },
      dataLabels: { enabled: c.variables.length <= 10, style: { fontSize: '10px' }, formatter: (v: number) => num(v, 2) },
      xaxis: { labels: { rotate: -45, style: { fontSize: '10px' } } }, legend: { show: false }, stroke: { width: 1, colors: ['transparent'] },
    };
  });
  puntos(d: { x: string; y: string; puntos: [number, number][] }): ApexOptions {
    return { chart: { type: 'scatter', zoom: { enabled: true, type: 'xy' } }, series: [{ name: d.y, data: d.puntos }],
             xaxis: { type: 'numeric', title: { text: d.x }, tickAmount: 6, labels: { formatter: (x: string) => num(+x, 1) } },
             yaxis: { title: { text: d.y }, labels: { formatter: (x: number) => num(x, 1) } }, markers: { size: 4, strokeWidth: 0, fillOpacity: 0.65 } };
  }
  private color(n: string) { return getComputedStyle(document.documentElement).getPropertyValue(`--sx-${n}`).trim(); }
}
