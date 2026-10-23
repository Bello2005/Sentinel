// HISTORIAL: trazabilidad completa. La evolución del modelo y cada evento (entrenamiento y decisión) con su
// responsable y justificación, filtrable por estado y texto.
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { EstadoVersion } from '../core/api';
import { fecha, num } from '../core/formato';
import { SentinelStore } from '../core/store';
import { Evolucion } from '../shared/evolucion';
import { Estado } from '../shared/ui';

interface EventoHistorial { fecha: string; version: string; estado: EstadoVersion; tipo: 'entrenamiento' | 'activacion' | 'rechazo' | 'inicial'; titulo: string; detalle: string; responsable?: string; justificacion?: string; mae: number }

@Component({
  selector: 'sx-historial',
  imports: [FormsModule, RouterLink, Evolucion, Estado],
  template: `
    <div class="sx-page">
      <header class="sx-page-head">
        <div>
          <div class="sx-eyebrow">Trazabilidad</div>
          <h1>Historial del modelo</h1>
          <p>Cada versión, cómo se entrenó y quién decidió su destino. Nada se borra: las versiones retiradas quedan como
             históricas y las rechazadas conservan su justificación.</p>
        </div>
      </header>

      <section class="sx-card evol">
        <div class="cab"><h2>Model Evolution Timeline</h2><span class="sx-muted">{{ store.versiones().length }} versiones · use ← → para recorrerla</span></div>
        <sx-evolucion [versiones]="store.versiones()" />
      </section>

      <div class="filtros sx-card" role="search">
        <div class="seg" role="radiogroup" aria-label="Estado">
          @for (e of estados; track e.id) {
            <button role="radio" [attr.aria-checked]="filtro() === e.id" [class.sel]="filtro() === e.id" (click)="filtro.set(e.id)">
              {{ e.texto }} <span class="n">{{ cuenta(e.id) }}</span></button>
          }
        </div>
        <label class="buscar"><span class="material-symbols-rounded" aria-hidden="true">search</span>
          <input [ngModel]="q()" (ngModelChange)="q.set($event)" placeholder="Responsable, justificación o versión…" aria-label="Buscar en el historial" /></label>
      </div>

      <ol class="eventos">
        @for (e of filtrados(); track e.fecha + e.tipo) {
          <li [attr.data-t]="e.tipo">
            <time>{{ f(e.fecha) }}</time>
            <span class="icono"><span class="material-symbols-rounded" aria-hidden="true">{{ iconos[e.tipo] }}</span></span>
            <article class="sx-card">
              <header><b>{{ e.titulo }}</b><sx-estado [estado]="e.estado" /><span class="mono sx-muted mae">MAE {{ num(e.mae, 2) }}</span></header>
              <p class="sx-muted">{{ e.detalle }}</p>
              @if (e.justificacion) {
                <blockquote>“{{ e.justificacion }}”</blockquote>
                <div class="firma"><span class="avatar">{{ ini(e.responsable) }}</span><span>{{ e.responsable || 'Responsable no registrado' }}</span></div>
              }
              @if (e.tipo === 'entrenamiento') { <a routerLink="/comparacion" [queryParams]="{ v: e.version }" class="enlace">Ver comparación →</a> }
            </article>
          </li>
        } @empty { <li class="sx-muted vacio">Sin eventos con ese filtro.</li> }
      </ol>
    </div>`,
  styles: `
    .evol h2 { font-size: 18px; } .cab { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; gap: 12px; flex-wrap: wrap; }
    .filtros { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; padding: 12px; }
    .seg { display: flex; padding: 3px; border-radius: 10px; background: var(--sx-panel); border: 1px solid var(--sx-border); flex-wrap: wrap; }
    .seg button { border: 0; background: none; color: var(--sx-muted); padding: 6px 12px; border-radius: 8px; cursor: pointer; font: 600 12.5px var(--sx-font); }
    .seg button.sel { background: var(--sx-card); color: var(--sx-text); box-shadow: var(--sx-shadow); }
    .n { font: 11px var(--sx-mono); color: var(--sx-faint); margin-left: 4px; }
    .buscar { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 200px; height: 36px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--sx-border); background: var(--sx-panel); }
    .buscar input { flex: 1; border: 0; outline: 0; background: none; color: var(--sx-text); font: inherit; }
    .eventos { list-style: none; margin: 0; padding: 0; position: relative; }
    .eventos::before { content: ''; position: absolute; left: 155px; top: 0; bottom: 0; width: 2px; background: linear-gradient(var(--sx-accent), var(--sx-candidate), transparent); opacity: 0.4; }
    .eventos li { display: grid; grid-template-columns: 130px 52px 1fr; gap: 0; align-items: start; padding-bottom: 16px; animation: sx-rise var(--sx-slow) var(--sx-ease) both; --c: var(--sx-accent); }
    .eventos li[data-t=activacion] { --c: var(--sx-success); } .eventos li[data-t=rechazo] { --c: var(--sx-danger); } .eventos li[data-t=entrenamiento] { --c: var(--sx-candidate); }
    time { color: var(--sx-muted); font-size: 12px; text-align: right; padding: 14px 14px 0 0; }
    .icono { position: relative; z-index: 1; width: 40px; height: 40px; margin: 6px; border-radius: 12px; display: grid; place-items: center; color: var(--c);
             background: color-mix(in srgb, var(--c) 15%, var(--sx-card)); border: 1px solid color-mix(in srgb, var(--c) 45%, transparent); }
    article header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; } .mae { margin-left: auto; font-size: 12px; }
    article p { margin: 6px 0 0; }
    blockquote { margin: 10px 0 0; padding: 8px 12px; border-left: 2px solid var(--c); background: var(--sx-panel); border-radius: 0 8px 8px 0; font-style: italic; }
    .firma { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 13px; }
    .avatar { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font: 700 11px var(--sx-font); background: var(--sx-panel); border: 1px solid var(--sx-border-strong); }
    .enlace { display: inline-block; margin-top: 10px; font-size: 13px; text-decoration: none; }
    .vacio { padding: 20px; }
    @media (max-width: 700px) { .eventos::before { left: 25px; } .eventos li { grid-template-columns: 52px 1fr; } time { grid-column: 2; text-align: left; padding: 0 0 4px; order: -1; } }`,
})
export class Historial {
  protected store = inject(SentinelStore);
  protected num = num;
  protected f = (s: string) => fecha(s);
  protected ini = (s?: string) => (s ?? '?').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
  protected filtro = signal<'todos' | EstadoVersion>('todos');
  protected q = signal('');
  protected estados = [{ id: 'todos', texto: 'Todos' }, { id: 'activo', texto: 'Activa' }, { id: 'candidato', texto: 'Candidatas' },
                       { id: 'historico', texto: 'Históricas' }, { id: 'rechazado', texto: 'Rechazadas' }] as const;
  protected iconos: Record<string, string> = { entrenamiento: 'model_training', activacion: 'rocket_launch', rechazo: 'block', inicial: 'flag' };

  private eventos = computed<EventoHistorial[]>(() => this.store.versiones().flatMap(v => {
    const base = { version: v.id, estado: v.estado, mae: v.metricas.mae_choco };
    const out: EventoHistorial[] = [{
      ...base, fecha: v.fecha, tipo: v.reporte_actualizacion ? 'entrenamiento' : 'inicial',
      titulo: v.reporte_actualizacion ? `${v.id} entrenada como candidata` : `${v.id} creada como versión inicial`,
      detalle: `${num(v.registros)} registros · ${v.algoritmo}`,
    }];
    if (v.decision) out.push({
      ...base, fecha: v.decision.fecha, tipo: v.decision.accion === 'activar' ? 'activacion' : 'rechazo',
      titulo: `${v.id} ${v.decision.accion === 'activar' ? 'activada' : 'rechazada'}`,
      detalle: `Activa antes de la decisión: ${v.decision.activo_previo ?? '—'}`,
      responsable: v.decision.responsable, justificacion: v.decision.justificacion,
    });
    return out;
  }).sort((a, b) => b.fecha.localeCompare(a.fecha)));

  protected filtrados = computed(() => {
    const q = this.q().toLowerCase(), fil = this.filtro();
    return this.eventos().filter(e => (fil === 'todos' || e.estado === fil) &&
      (!q || [e.version, e.titulo, e.responsable, e.justificacion].some(x => x?.toLowerCase().includes(q))));
  });
  cuenta(id: string) { return id === 'todos' ? this.store.versiones().length : this.store.versiones().filter(v => v.estado === id).length; }
}
