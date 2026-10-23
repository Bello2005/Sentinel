// MODEL EVOLUTION TIMELINE: la historia del modelo como una línea viva v1 → v2 → v3…
// Cada nodo muestra estado, fecha, métrica principal y su cambio frente a la versión anterior, y la decisión humana
// que la llevó (o no) a producción. Se navega con el teclado (flechas) y al elegir un nodo se ve su detalle.
import { Component, computed, input, signal } from '@angular/core';
import { ApexOptions } from 'apexcharts';

import { Version } from '../core/api';
import { fecha, num } from '../core/formato';
import { Grafica } from './grafica';
import { Estado } from './ui';

@Component({
  selector: 'sx-evolucion',
  imports: [Estado, Grafica],
  template: `
    @if (versiones().length) {
      <div class="pista" role="listbox" aria-label="Evolución del modelo" (keydown)="teclado($event)">
        <div class="riel" aria-hidden="true"><div class="flujo"></div></div>
        @for (n of nodos(); track n.v.id; let i = $index) {
          <button class="nodo" role="option" [attr.aria-selected]="seleccion() === i" [class.sel]="seleccion() === i"
                  [attr.data-estado]="n.v.estado" (click)="seleccion.set(i)" [style.animation-delay.ms]="i * 90"
                  [attr.aria-label]="n.v.id + ', ' + n.v.estado + ', MAE ' + n.mae">
            <span class="punto"><span class="nucleo"></span></span>
            <span class="id">{{ n.v.id }}</span>
            <sx-estado [estado]="n.v.estado" [pulso]="n.v.estado === 'activo'" />
            <span class="mae"><b>{{ n.mae }}</b> MAE</span>
            @if (n.delta !== null) {
              <span class="delta" [class.mejor]="n.delta < 0" [class.peor]="n.delta > 0">
                {{ n.delta < 0 ? '▼' : n.delta > 0 ? '▲' : '=' }} {{ n.deltaTxt }}
              </span>
            } @else { <span class="delta neutro">origen</span> }
            <span class="fecha">{{ n.fecha }}</span>
          </button>
        }
      </div>

      @if (detalle(); as d) {
        <div class="detalle sx-card" [attr.data-estado]="d.v.estado">
          <div class="col">
            <div class="sx-eyebrow">Versión {{ d.v.id }} · {{ d.fecha }}</div>
            <h3>{{ d.titulo }}</h3>
            <p class="sx-muted">{{ d.v.algoritmo }}</p>
            <div class="datos">
              <div><span class="sx-eyebrow">Registros</span><b>{{ d.registros }}</b></div>
              <div><span class="sx-eyebrow">MAE Chocó</span><b>{{ d.mae }}</b></div>
              <div><span class="sx-eyebrow">MAE país</span><b>{{ d.maePais }}</b></div>
              <div><span class="sx-eyebrow">Datos</span><b class="mono">{{ d.v.datos ?? '—' }}</b></div>
            </div>
          </div>
          <div class="col decision">
            <div class="sx-eyebrow">Decisión humana</div>
            @if (d.v.decision; as dec) {
              <div class="dec" [class.rechazo]="dec.accion === 'rechazar'">
                <span class="material-symbols-rounded" aria-hidden="true">{{ dec.accion === 'activar' ? 'verified' : 'block' }}</span>
                <div>
                  <b>{{ dec.accion === 'activar' ? 'Activada' : 'Rechazada' }}</b>
                  @if (dec.responsable) { por <b>{{ dec.responsable }}</b> }
                  <div class="sx-muted">{{ formatear(dec.fecha) }} · antes estaba activa {{ dec.activo_previo ?? '—' }}</div>
                  <blockquote>“{{ dec.justificacion }}”</blockquote>
                </div>
              </div>
            } @else if (d.v.estado === 'candidato') {
              <p class="sx-muted">Pendiente de aprobación. No entra a producción sin una decisión humana.</p>
            } @else {
              <p class="sx-muted">Versión inicial: se activó al crear el sistema.</p>
            }
          </div>
        </div>
      }

      @if (versiones().length > 1) {
        <sx-grafica [opciones]="curva()" [alto]="170" etiqueta="Error de cada versión frente a las líneas base" />
      }
    }`,
  styles: `
    :host { display: flex; flex-direction: column; gap: 16px; }
    .pista { position: relative; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(170px, 1fr); gap: 16px;
             overflow-x: auto; padding: 8px 4px 12px; scroll-snap-type: x mandatory; }
    .riel { position: absolute; left: 40px; right: 40px; top: 32px; height: 2px; background: var(--sx-border-strong); overflow: hidden; }
    .flujo { position: absolute; inset: 0; width: 40%;
             background: linear-gradient(90deg, transparent, var(--sx-accent), var(--sx-candidate), transparent);
             animation: flujo 3.2s linear infinite; }
    @keyframes flujo { from { transform: translateX(-100%); } to { transform: translateX(260%); } }
    .nodo { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 0 8px 14px;
            background: none; border: 0; color: inherit; font: inherit; cursor: pointer; scroll-snap-align: center;
            animation: sx-rise var(--sx-slow) var(--sx-ease) both; border-radius: var(--sx-radius); }
    .nodo:hover .punto { transform: scale(1.08); }
    .nodo.sel { background: color-mix(in srgb, var(--c) 8%, transparent); }
    .nodo { --c: var(--sx-muted); }
    .nodo[data-estado=activo] { --c: var(--sx-active); } .nodo[data-estado=candidato] { --c: var(--sx-candidate); }
    .nodo[data-estado=rechazado] { --c: var(--sx-danger); }
    .punto { width: 50px; height: 50px; margin-top: 7px; border-radius: 50%; display: grid; place-items: center; background: var(--sx-panel);
             border: 2px solid var(--c); box-shadow: 0 0 0 6px var(--sx-bg), 0 0 22px color-mix(in srgb, var(--c) 45%, transparent);
             transition: transform var(--sx-med) var(--sx-ease); }
    .nucleo { width: 16px; height: 16px; border-radius: 50%; background: var(--c); }
    .nodo[data-estado=activo] .nucleo { animation: sx-pulse 2s infinite; color: var(--c); }
    .nodo[data-estado=candidato] .punto { border-style: dashed; animation: girar 8s linear infinite; }
    .nodo[data-estado=rechazado] .id { text-decoration: line-through; opacity: 0.7; }
    @keyframes girar { to { transform: rotate(360deg); } }
    .id { font: 650 20px var(--sx-mono); }
    .mae { color: var(--sx-muted); font-size: 12px; } .mae b { color: var(--sx-text); font-size: 15px; }
    .delta { font: 600 12px var(--sx-mono); padding: 2px 8px; border-radius: 999px; background: var(--sx-card); border: 1px solid var(--sx-border); }
    .delta.mejor { color: var(--sx-success); } .delta.peor { color: var(--sx-danger); } .delta.neutro { color: var(--sx-muted); }
    .fecha { color: var(--sx-faint); font-size: 12px; }
    .detalle { display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; animation: sx-rise var(--sx-med) var(--sx-ease); border-left: 3px solid var(--c); }
    .detalle { --c: var(--sx-muted); } .detalle[data-estado=activo] { --c: var(--sx-active); } .detalle[data-estado=candidato] { --c: var(--sx-candidate); }
    .detalle[data-estado=rechazado] { --c: var(--sx-danger); }
    .detalle h3 { margin: 6px 0 2px; }
    .datos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 12px; }
    .datos div { display: flex; flex-direction: column; gap: 2px; } .datos b { font-size: 15px; word-break: break-all; }
    .dec { display: flex; gap: 12px; margin-top: 8px; } .dec > span { color: var(--sx-success); font-size: 28px; }
    .dec.rechazo > span { color: var(--sx-danger); }
    blockquote { margin: 8px 0 0; padding: 8px 12px; border-left: 2px solid var(--c); background: var(--sx-panel); border-radius: 0 8px 8px 0; font-style: italic; }
    @media (max-width: 760px) { .detalle { grid-template-columns: 1fr; } }`,
})
export class Evolucion {
  readonly versiones = input.required<Version[]>();
  protected seleccion = signal<number | null>(null);
  protected formatear = (iso: string) => fecha(iso);

  protected nodos = computed(() => this.versiones().map((v, i, arr) => {
    // El cambio se mide contra la versión que estaba activa antes (la anterior aprobada), no contra un rechazo
    const previa = [...arr.slice(0, i)].reverse().find(p => p.estado !== 'rechazado' && p.estado !== 'candidato');
    const delta = previa ? v.metricas.mae_choco - previa.metricas.mae_choco : null;
    return { v, mae: num(v.metricas.mae_choco, 2), delta, deltaTxt: delta === null ? '' : num(Math.abs(delta), 2), fecha: fecha(v.fecha, false) };
  }));

  protected detalle = computed(() => {
    const i = this.seleccion() ?? this.nodos().findIndex(n => n.v.estado === 'candidato');
    const n = this.nodos()[i >= 0 ? i : this.nodos().findIndex(x => x.v.estado === 'activo')];
    if (!n) return null;
    const titulos: Record<string, string> = { activo: 'En producción', candidato: 'Esperando aprobación', historico: 'Retirada', rechazado: 'Rechazada' };
    return { ...n, titulo: titulos[n.v.estado], registros: num(n.v.registros), maePais: num(n.v.metricas.mae_pais, 2) };
  });

  protected curva = computed<ApexOptions>(() => {
    const vs = this.versiones();
    return {
      chart: { type: 'line', sparkline: { enabled: false } },
      series: [
        { name: 'Modelo', data: vs.map(v => v.metricas.mae_choco) },
        { name: 'Promedio 3 años', data: vs.map(v => v.metricas.lineas_base.promedio_3_mae_choco) },
        { name: 'Persistencia', data: vs.map(v => v.metricas.lineas_base.persistencia_mae_choco) },
      ],
      xaxis: { categories: vs.map(v => v.id) },
      yaxis: { title: { text: 'MAE Chocó' }, labels: { formatter: (x: number) => num(x, 1) } },
      stroke: { width: [3, 2, 2], dashArray: [0, 5, 5] },
      markers: { size: [5, 0, 0] },
      legend: { position: 'top', horizontalAlign: 'right' },
    };
  });

  teclado(e: KeyboardEvent) {
    const n = this.nodos().length, i = this.seleccion() ?? 0;
    if (e.key === 'ArrowRight') { this.seleccion.set(Math.min(n - 1, i + 1)); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { this.seleccion.set(Math.max(0, i - 1)); e.preventDefault(); }
  }
}
