// COMPARACIÓN: activa frente a candidata, métrica por métrica. Quién gana, por cuánto, dónde mejora y dónde empeora.
// Los números vienen del reporte de actualización que escribe Python (misma métrica principal para las dos).
import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApexOptions } from 'apexcharts';

import { Actualizacion } from '../core/api';
import { fecha, num } from '../core/formato';
import { SentinelStore } from '../core/store';
import { Grafica } from '../shared/grafica';
import { Estado, Vacio } from '../shared/ui';

interface Duelo { metrica: string; activa: number | null; candidata: number | null; ganador: 'activa' | 'candidata' | 'empate' | 'na'; delta: number | null; nota?: string; menorEsMejor: boolean }

@Component({
  selector: 'sx-comparacion',
  imports: [RouterLink, Grafica, Estado, Vacio],
  template: `
    <div class="sx-page">
      <header class="sx-page-head">
        <div>
          <div class="sx-eyebrow">Gobierno de versiones</div>
          <h1>Comparación de modelos</h1>
          <p>La candidata se mide con la misma métrica principal que la activa. Una versión solo llega a producción si una
             persona revisa esta comparación y la aprueba en el Centro de decisión.</p>
        </div>
        @if (opciones().length > 1) {
          <div class="selector" role="radiogroup" aria-label="Versión a comparar">
            @for (o of opciones(); track o.id) {
              <a role="radio" [attr.aria-checked]="o.id === version()?.id" [class.sel]="o.id === version()?.id" routerLink="/comparacion" [queryParams]="{ v: o.id }">
                <span class="mono">{{ o.id }}</span><sx-estado [estado]="o.estado" /></a>
            }
          </div>
        }
      </header>

      @if (!version()) {
        <sx-vacio icono="compare_arrows" titulo="No hay versiones para comparar" texto="Entrene una candidata en el Laboratorio con datos etiquetados nuevos.">
          <a class="sx-btn primary" routerLink="/laboratorio">Ir al Laboratorio</a>
        </sx-vacio>
      } @else if (!c()) {
        <div class="sx-card"><div class="sx-skeleton" style="height:180px"></div></div>
      }

      @if (c(); as c) {
        <section class="split">
          <article class="lado activa">
            <div class="sx-eyebrow">Activa · en producción</div>
            <div class="id mono">{{ c.activa.version }}</div>
            <div class="mae"><b>{{ num(c.comparacion.principal.activa, 2) }}</b><span>MAE principal</span></div>
            <small class="sx-muted">Entrenada {{ f(c.activa.fecha) }}</small>
          </article>
          <div class="vs" aria-hidden="true"><span>VS</span></div>
          <article class="lado candidata sx-animated-border">
            <div class="sx-eyebrow">Candidata · {{ version()!.estado }}</div>
            <div class="id mono">{{ c.candidata.version }}</div>
            <div class="mae"><b>{{ num(c.comparacion.principal.candidata, 2) }}</b><span>MAE principal</span></div>
            <small class="sx-muted">Entrenada {{ f(c.candidata.fecha) }}</small>
          </article>
        </section>

        <section class="veredicto sx-card" [attr.data-g]="principal().ganador">
          <span class="material-symbols-rounded trofeo" aria-hidden="true">emoji_events</span>
          <div>
            <div class="sx-eyebrow">Métrica principal · {{ c.comparacion.principal.metrica }}</div>
            <h2>{{ titularGanador() }}</h2>
          </div>
          <div class="delta-grande" [class.mejor]="(principal().delta ?? 0) < 0" [class.peor]="(principal().delta ?? 0) > 0">
            {{ (principal().delta ?? 0) < 0 ? '▼' : (principal().delta ?? 0) > 0 ? '▲' : '=' }} {{ num(abs(principal().delta ?? 0), 2) }}
            <small>{{ pctCambio() }}</small>
          </div>
        </section>

        <section>
          <h3 class="titulo">Metric battles</h3>
          <div class="duelos sx-stagger">
            @for (d of duelos(); track d.metrica) {
              <article class="sx-card duelo" [attr.data-g]="d.ganador">
                <div class="m">{{ d.metrica }}</div>
                <div class="valores">
                  <div class="v act" [class.gana]="d.ganador === 'activa'"><small>{{ c.activa.version }}</small><b>{{ fmt(d.activa, d) }}</b></div>
                  <div class="barras" aria-hidden="true">
                    <span class="b act" [style.width.%]="ancho(d, d.activa)"></span>
                    <span class="b cand" [style.width.%]="ancho(d, d.candidata)"></span>
                  </div>
                  <div class="v cand" [class.gana]="d.ganador === 'candidata'"><small>{{ c.candidata.version }}</small><b>{{ fmt(d.candidata, d) }}</b></div>
                </div>
                <div class="pie">
                  <span class="sx-pill" [class]="'sx-pill ' + (d.ganador === 'candidata' ? 'candidate' : d.ganador === 'activa' ? 'active' : 'history')">
                    {{ d.ganador === 'na' ? 'referencia' : d.ganador === 'empate' ? 'empate' : 'gana ' + (d.ganador === 'activa' ? c.activa.version : c.candidata.version) }}</span>
                  @if (d.delta !== null && d.ganador !== 'na') { <span class="mono sx-muted">Δ {{ d.delta > 0 ? '+' : '' }}{{ num(d.delta, 2) }}</span> }
                </div>
                @if (d.nota) { <p class="nota sx-muted">{{ d.nota }}</p> }
              </article>
            }
          </div>
        </section>

        <div class="fila2">
          <section class="sx-card">
            <div class="cab"><h3>Cambio en los coeficientes</h3><span class="sx-muted">cuánto pesa cada variable</span></div>
            <sx-grafica [opciones]="coeficientes()" [alto]="280" etiqueta="Coeficientes de la versión activa y de la candidata" />
          </section>
          <section class="sx-card impacto">
            <div class="cab"><h3>Impact analysis</h3></div>
            <ul>
              @for (i of impacto(); track i.texto) {
                <li [attr.data-t]="i.tipo"><span class="material-symbols-rounded" aria-hidden="true">{{ i.tipo === 'mejora' ? 'trending_down' : i.tipo === 'empeora' ? 'trending_up' : 'drag_handle' }}</span>{{ i.texto }}</li>
              }
            </ul>
          </section>
        </div>

        <section class="sx-card resumen">
          <div class="cab"><h3>Executive summary</h3><span class="sx-pill candidate"><span class="material-symbols-rounded" style="font-size:14px">auto_awesome</span>generado</span></div>
          <p>{{ resumen() }}</p>
          <div class="acciones">
            @if (version()!.estado === 'candidato') {
              <a class="sx-btn primary lg" routerLink="/decision" [queryParams]="{ v: c.candidata.version }"><span class="material-symbols-rounded">gavel</span>Llevar al Centro de decisión</a>
            } @else { <sx-estado [estado]="version()!.estado" /><span class="sx-muted">Esta comparación ya tiene una decisión registrada.</span> }
          </div>
        </section>
      }
    </div>`,
  styles: `
    .selector { display: flex; gap: 8px; flex-wrap: wrap; }
    .selector a { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 10px; border: 1px solid var(--sx-border); text-decoration: none; color: inherit; }
    .selector a.sel { border-color: var(--sx-candidate); box-shadow: 0 0 0 1px var(--sx-candidate); }
    .split { display: grid; grid-template-columns: 1fr auto 1fr; gap: 0; align-items: stretch; }
    .lado { padding: 28px; border-radius: var(--sx-radius-lg); display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--sx-border); }
    .activa { background: linear-gradient(135deg, color-mix(in srgb, var(--sx-active) 18%, var(--sx-card)), var(--sx-card)); }
    .candidata { background: linear-gradient(225deg, color-mix(in srgb, var(--sx-candidate) 20%, var(--sx-card)), var(--sx-card)); text-align: right; align-items: flex-end; }
    .id { font-size: 44px; font-weight: 700; line-height: 1; } .activa .id { color: var(--sx-active); } .candidata .id { color: var(--sx-candidate); }
    .mae { display: flex; align-items: baseline; gap: 8px; } .mae b { font: 650 30px var(--sx-mono); } .mae span { color: var(--sx-muted); font-size: 12px; }
    .vs { display: grid; place-items: center; width: 70px; } .vs span { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; letter-spacing: 0.05em;
          background: var(--sx-panel); border: 1px solid var(--sx-border-strong); box-shadow: var(--sx-glow); }
    .veredicto { display: grid; grid-template-columns: auto 1fr auto; gap: 18px; align-items: center; border-left: 3px solid var(--g); --g: var(--sx-muted); }
    .veredicto[data-g=candidata] { --g: var(--sx-candidate); } .veredicto[data-g=activa] { --g: var(--sx-active); }
    .trofeo { font-size: 40px; color: var(--g); animation: sx-pop 600ms var(--sx-ease); } .veredicto h2 { font-size: 20px; margin-top: 4px; }
    .delta-grande { font: 700 30px var(--sx-mono); display: flex; flex-direction: column; align-items: flex-end; } .delta-grande small { font-size: 12px; color: var(--sx-muted); }
    .delta-grande.mejor { color: var(--sx-success); } .delta-grande.peor { color: var(--sx-danger); }
    .titulo { margin: 4px 0 12px; }
    .duelos { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; }
    .duelo { display: flex; flex-direction: column; gap: 12px; }
    .duelo .m { font-weight: 600; font-size: 13px; }
    .valores { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; }
    .v { display: flex; flex-direction: column; } .v.cand { text-align: right; } .v small { color: var(--sx-muted); font: 11px var(--sx-mono); }
    .v b { font: 600 20px var(--sx-mono); } .v.gana.act b { color: var(--sx-active); } .v.gana.cand b { color: var(--sx-candidate); }
    .barras { display: flex; flex-direction: column; gap: 4px; } .b { height: 6px; border-radius: 3px; transition: width 0.9s var(--sx-ease); }
    .b.act { background: var(--sx-active); } .b.cand { background: var(--sx-candidate); margin-left: auto; }
    .pie { display: flex; justify-content: space-between; align-items: center; font-size: 12px; } .nota { margin: 0; font-size: 12px; }
    .fila2 { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; }
    .cab { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 10px; }
    .impacto ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
    .impacto li { display: flex; gap: 10px; align-items: flex-start; } .impacto li span { color: var(--sx-muted); }
    .impacto li[data-t=mejora] span { color: var(--sx-success); } .impacto li[data-t=empeora] span { color: var(--sx-danger); }
    .resumen p { font-size: 15px; line-height: 1.7; margin: 0 0 16px; max-width: 900px; }
    .acciones { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    @media (max-width: 900px) { .split { grid-template-columns: 1fr; gap: 10px; } .vs { width: auto; } .candidata { text-align: left; align-items: flex-start; }
                                .fila2, .veredicto { grid-template-columns: 1fr; } }`,
})
export class Comparacion {
  protected store = inject(SentinelStore);
  readonly v = input<string>();  // ?v=v2
  protected num = num;
  protected abs = Math.abs;
  protected f = (s: string) => fecha(s);
  // Los conteos (registros) van sin decimales; los errores siempre con 2
  protected fmt = (x: number | null, d: Duelo) => (x === null ? '—' : d.metrica.startsWith('Registros') ? num(x) : num(x, 2));

  protected opciones = computed(() => this.store.versiones().filter(v => v.reporte_actualizacion));
  protected version = computed(() => {
    const ops = this.opciones();
    return ops.find(o => o.id === this.v()) ?? ops.find(o => o.estado === 'candidato') ?? ops.at(-1) ?? null;
  });
  protected c = computed<Actualizacion | null>(() => { const v = this.version(); return v ? this.store.comparaciones()[v.id] ?? null : null; });

  constructor() {
    // untracked: cargarComparacion lee y escribe el estado del store; sin esto el effect se dispara sin fin
    effect(() => { const v = this.version(); if (v) untracked(() => this.store.cargarComparacion(v)); });
  }

  private duelo(metrica: string, a: number | null, b: number | null, menorEsMejor: boolean, nota?: string, referencia = false): Duelo {
    const delta = a !== null && b !== null ? b - a : null;
    let ganador: Duelo['ganador'] = 'na';
    if (!referencia && delta !== null) ganador = Math.abs(delta) < 0.005 ? 'empate' : (delta < 0) === menorEsMejor ? 'candidata' : 'activa';
    return { metrica, activa: a, candidata: b, ganador, delta, nota, menorEsMejor };
  }
  protected principal = computed(() => {
    const p = this.c()!.comparacion.principal;
    return this.duelo(p.metrica, p.activa, p.candidata, true);
  });
  protected duelos = computed<Duelo[]>(() => {
    const c = this.c()!;
    return [this.principal(), ...c.comparacion.secundarias.map(s => {
      const registros = s.metrica.startsWith('Registros'), base = s.metrica.startsWith('Líneas base');
      return this.duelo(s.metrica, s.activa, s.candidata, !registros, s.nota, registros || base);
    })];
  });
  ancho(d: Duelo, x: number | null) {
    const m = Math.max(d.activa ?? 0, d.candidata ?? 0);
    return x === null || !m ? 0 : (x / m) * 100;
  }
  protected pctCambio = computed(() => {
    const p = this.principal();
    return p.activa ? `${num(((p.candidata! - p.activa) / p.activa) * 100, 1)} %` : '';
  });
  protected titularGanador = computed(() => {
    const p = this.principal(), c = this.c()!;
    if (p.ganador === 'empate') return 'Empate técnico en la métrica principal.';
    return p.ganador === 'candidata' ? `${c.candidata.version} reduce el error en ${num(Math.abs(p.delta!), 2)} puntos.`
                                     : `${c.activa.version} sigue siendo más precisa por ${num(Math.abs(p.delta!), 2)} puntos.`;
  });

  protected coeficientes = computed<ApexOptions>(() => {
    const c = this.c()!, k = Object.keys(c.candidata.coeficientes);
    return { chart: { type: 'bar' }, series: [{ name: c.activa.version, data: k.map(x => c.activa.coeficientes[x] ?? 0) },
                                              { name: c.candidata.version, data: k.map(x => c.candidata.coeficientes[x]) }],
             xaxis: { categories: k }, colors: [this.token('active'), this.token('candidate')],
             plotOptions: { bar: { borderRadius: 5, columnWidth: '55%' } }, legend: { position: 'top' },
             yaxis: { labels: { formatter: (x: number) => num(x, 2) } } };
  });

  protected impacto = computed(() => {
    const c = this.c()!, out: { tipo: 'mejora' | 'empeora' | 'igual'; texto: string }[] = [];
    for (const d of this.duelos()) {
      if (d.ganador === 'na' || d.delta === null) continue;
      const tipo = d.ganador === 'candidata' ? 'mejora' : d.ganador === 'activa' ? 'empeora' : 'igual';
      out.push({ tipo, texto: `${d.metrica}: ${tipo === 'igual' ? 'sin cambio' : `${tipo === 'mejora' ? 'mejora' : 'empeora'} ${num(Math.abs(d.delta), 2)}`}.` });
    }
    out.push({ tipo: 'mejora', texto: `Incorpora ${num(c.lote.nuevos)} registros nuevos (años ${c.lote.anios_objetivo.join(', ')}).` });
    if (!c.recomendacion.vence_lineas_base) out.push({ tipo: 'empeora', texto: 'No le gana a las líneas base simples.' });
    return out;
  });

  protected resumen = computed(() => {
    const c = this.c()!, p = this.principal(), mismos = c.comparacion.secundarias[0];
    const parte1 = p.ganador === 'candidata'
      ? `La candidata ${c.candidata.version} obtiene un error medio de ${num(p.candidata!, 2)} puntos frente a ${num(p.activa!, 2)} de ${c.activa.version} (${this.pctCambio()}).`
      : `La candidata ${c.candidata.version} no mejora la métrica principal (${num(p.candidata!, 2)} frente a ${num(p.activa!, 2)}).`;
    const parte2 = mismos && mismos.activa !== null && mismos.candidata !== null
      ? ` En los mismos años que validó la versión activa el error es ${num(mismos.activa, 2)} contra ${num(mismos.candidata, 2)}: ${Math.abs(mismos.activa - mismos.candidata) < 0.05 ? 'parte de la diferencia viene de que el año nuevo es más fácil de predecir, no de un modelo distinto' : 'la diferencia se mantiene en el pasado'}.`
      : '';
    const parte3 = ` Entrena con ${num(c.conjunto_actualizado.registros)} registros e incorpora ${num(c.lote.nuevos)} nuevos. El sistema sugiere «${c.recomendacion.accion_sugerida}»; la decisión final es humana.`;
    return parte1 + parte2 + parte3;
  });

  private token(n: string) { return getComputedStyle(document.documentElement).getPropertyValue(`--sx-${n}`).trim(); }
}
