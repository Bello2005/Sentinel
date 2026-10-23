// PREDICCIONES: vista ejecutiva del pronóstico. Segmenta por tipo de unidad, marca la prioridad (cuartil inferior del
// archivo, el mismo criterio de "25 % más bajo" de la Actividad 3) y muestra cada predicción con su intervalo.
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApexOptions } from 'apexcharts';

import { FilaPrediccion } from '../core/api';
import { num } from '../core/formato';
import { SentinelStore } from '../core/store';
import { Grafica } from '../shared/grafica';
import { Kpi, Vacio } from '../shared/ui';

type Prioridad = 'alta' | 'media' | 'baja';

@Component({
  selector: 'sx-predicciones',
  imports: [FormsModule, RouterLink, Grafica, Kpi, Vacio],
  template: `
    <div class="sx-page">
      <header class="sx-page-head">
        <div>
          <div class="sx-eyebrow">Paso 2 · Pronóstico</div>
          <h1>Predicciones</h1>
          <p>Puntaje global promedio esperado para el año siguiente, con un intervalo que cubre el 80 % de los errores
             observados en la validación. Solo se generan si el archivo superó la validación.</p>
        </div>
        @if (p(); as p) {
          <div class="acciones">
            <a class="sx-btn" [href]="p.descargas['predicciones.csv']" download><span class="material-symbols-rounded">download</span>CSV</a>
            <a class="sx-btn" [href]="p.descargas['compatibilidad.html']" target="_blank" rel="noopener"><span class="material-symbols-rounded">verified_user</span>Validación</a>
          </div>
        }
      </header>

      @if (!p()) {
        @if (store.ocupado().predecir) {
          <div class="sx-card cargando"><span class="material-symbols-rounded giro" aria-hidden="true">progress_activity</span>
            <div><b>Validando y ejecutando el modelo…</b><p class="sx-muted">ONNX Runtime en C++ · {{ store.activa()?.id }}</p></div></div>
        } @else if (store.validacion()?.estado === 'incompatible') {
          <sx-vacio icono="block" titulo="Predicción bloqueada" texto="El archivo es incompatible con el modelo. SENTINEL no ejecuta el modelo sobre datos que no superan la validación.">
            <a class="sx-btn primary" routerLink="/validacion">Ver qué corregir</a>
          </sx-vacio>
        } @else if (store.archivo()) {
          <sx-vacio icono="insights" [titulo]="store.archivo()!.name" texto="Dataset en sesión. SENTINEL lo validará de nuevo antes de predecir.">
            <button class="sx-btn primary" (click)="store.predecir()"><span class="material-symbols-rounded">play_arrow</span>Generar predicciones</button>
          </sx-vacio>
        } @else {
          <sx-vacio icono="upload_file" titulo="No hay dataset en sesión" texto="Cargue y valide un archivo primero.">
            <a class="sx-btn primary" routerLink="/validacion">Ir a Validación</a>
          </sx-vacio>
        }
      }

      @if (p(); as p) {
        <div class="kpis sx-grid sx-stagger">
          <sx-kpi etiqueta="Unidades pronosticadas" [valor]="p.predicciones.length" icono="donut_small" [detalle]="'Modelo ' + p.modelo_version" tono="active" />
          <sx-kpi etiqueta="Puntaje promedio esperado" [valor]="p.resumen.general.promedio" [decimales]="1" icono="trending_flat" [detalle]="'Mediana ' + num(p.resumen.general.mediana, 1)" />
          <sx-kpi etiqueta="Rango" [texto]="num(p.resumen.general.minimo, 0) + ' – ' + num(p.resumen.general.maximo, 0)" icono="height" detalle="Escala 0 a 500" />
          <sx-kpi etiqueta="Prioridad alta" [valor]="conteo().alta" icono="flag" tono="bad" [detalle]="'Cuartil inferior: < ' + num(corte(), 1) + ' pts'" />
        </div>

        <div class="filtros sx-card" role="search">
          <div class="seg" role="radiogroup" aria-label="Tipo de unidad">
            @for (t of ['todos', 'municipio', 'colegio']; track t) {
              <button role="radio" [attr.aria-checked]="tipo() === t" [class.sel]="tipo() === t" (click)="tipo.set(t)">{{ t === 'todos' ? 'Todos' : t === 'municipio' ? 'Municipios' : 'Colegios' }}</button>
            }
          </div>
          <div class="seg" role="radiogroup" aria-label="Prioridad">
            @for (x of ['todas', 'alta', 'media', 'baja']; track x) {
              <button role="radio" [attr.aria-checked]="prio() === x" [class.sel]="prio() === x" [attr.data-p]="x" (click)="prio.set(x)">{{ x === 'todas' ? 'Toda prioridad' : x }}</button>
            }
          </div>
          <label class="buscar"><span class="material-symbols-rounded" aria-hidden="true">search</span>
            <input [ngModel]="q()" (ngModelChange)="q.set($event)" placeholder="Nombre o código…" aria-label="Buscar unidad" /></label>
          <span class="sx-muted total">{{ num(filtradas().length) }} resultados</span>
        </div>

        <div class="graf">
          <section class="sx-card"><div class="cab"><h3>Distribución de puntajes esperados</h3></div>
            <sx-grafica [opciones]="distribucion()" [alto]="260" etiqueta="Distribución de predicciones" /></section>
          <section class="sx-card"><div class="cab"><h3>Extremos con su intervalo</h3><span class="sx-muted">5 más bajos y 5 más altos</span></div>
            <sx-grafica [opciones]="extremos()" [alto]="260" etiqueta="Unidades extremas con intervalo de 80 %" /></section>
        </div>

        <section class="sx-card resultados">
          <div class="encabezado" aria-hidden="true"><span>Unidad</span><span>Predicción e intervalo (0-500)</span><span>Puntaje</span><span>Prioridad</span></div>
          @for (f of visibles(); track f.tipo_unidad + f.codigo) {
            <div class="fila">
              <div class="unidad"><b>{{ f.nombre || f.codigo }}</b><small class="sx-muted mono">{{ f.tipo_unidad }} · {{ f.codigo }}</small></div>
              <div class="escala" [attr.aria-label]="'Entre ' + f.desde + ' y ' + f.hasta">
                <span class="banda" [style.left.%]="pos(f.desde ?? f.prediccion)" [style.width.%]="pos(f.hasta ?? f.prediccion) - pos(f.desde ?? f.prediccion)"></span>
                <span class="marca" [style.left.%]="pos(f.prediccion)"></span>
              </div>
              <div class="valor"><b>{{ num(f.prediccion, 1) }}</b><small class="sx-muted">± {{ num(f.mas_menos, 1) }}</small></div>
              <span class="sx-pill" [class]="'sx-pill ' + (prioridad(f) === 'alta' ? 'bad' : prioridad(f) === 'media' ? 'warn' : 'ok')">{{ prioridad(f) }}</span>
            </div>
          } @empty { <p class="sx-muted vacio">Ningún resultado con esos filtros.</p> }
          @if (filtradas().length > limite()) {
            <button class="sx-btn mas" (click)="limite.set(limite() + 60)">Mostrar {{ num(Math.min(60, filtradas().length - limite())) }} más</button>
          }
        </section>
      }
    </div>`,
  styles: `
    .acciones { display: flex; gap: 10px; }
    .cargando { display: flex; gap: 16px; align-items: center; } .cargando p { margin: 2px 0 0; }
    .giro { animation: girar 1s linear infinite; color: var(--sx-accent); font-size: 32px; } @keyframes girar { to { transform: rotate(360deg); } }
    .kpis { grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }
    .filtros { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; padding: 12px; position: sticky; top: 76px; z-index: 5; }
    .seg { display: flex; padding: 3px; border-radius: 10px; background: var(--sx-panel); border: 1px solid var(--sx-border); }
    .seg button { border: 0; background: none; color: var(--sx-muted); padding: 6px 12px; border-radius: 8px; cursor: pointer; font: 600 12.5px var(--sx-font); text-transform: capitalize; }
    .seg button.sel { background: var(--sx-card); color: var(--sx-text); box-shadow: var(--sx-shadow); }
    .seg button.sel[data-p=alta] { color: var(--sx-danger); } .seg button.sel[data-p=media] { color: var(--sx-warning); } .seg button.sel[data-p=baja] { color: var(--sx-success); }
    .buscar { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 180px; height: 36px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--sx-border); background: var(--sx-panel); }
    .buscar input { flex: 1; border: 0; outline: 0; background: none; color: var(--sx-text); font: inherit; }
    .total { font-size: 12.5px; }
    .graf { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .cab { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
    .resultados { padding: 8px 0; }
    .encabezado, .fila { display: grid; grid-template-columns: minmax(200px, 1.4fr) 2fr 110px 90px; gap: 16px; align-items: center; padding: 10px 20px; }
    .encabezado { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--sx-faint); border-bottom: 1px solid var(--sx-border); }
    .fila { border-bottom: 1px solid var(--sx-border); transition: background var(--sx-fast); }
    .fila:hover { background: color-mix(in srgb, var(--sx-text) 3%, transparent); }
    .unidad { min-width: 0; } .unidad b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .unidad small { font-size: 11.5px; }
    .escala { position: relative; height: 8px; border-radius: 4px; background: var(--sx-panel); }
    .banda { position: absolute; top: 0; bottom: 0; border-radius: 4px; background: linear-gradient(90deg, color-mix(in srgb, var(--sx-accent) 25%, transparent), color-mix(in srgb, var(--sx-candidate) 35%, transparent)); }
    .marca { position: absolute; top: -4px; width: 4px; height: 16px; margin-left: -2px; border-radius: 2px; background: var(--sx-accent); box-shadow: 0 0 10px var(--sx-accent); }
    .valor { display: flex; flex-direction: column; text-align: right; } .valor b { font: 600 16px var(--sx-mono); }
    .vacio { padding: 20px; } .mas { margin: 14px auto 6px; display: flex; }
    @media (max-width: 1000px) { .graf { grid-template-columns: 1fr; } .encabezado { display: none; }
      .fila { grid-template-columns: 1fr auto; } .escala { grid-column: 1 / -1; order: 3; } }`,
})
export class Predicciones {
  protected store = inject(SentinelStore);
  protected p = this.store.prediccion;
  protected num = num;
  protected Math = Math;
  protected tipo = signal('todos');
  protected prio = signal('todas');
  protected q = signal('');
  protected limite = signal(60);

  // Cortes de prioridad: cuartiles de las predicciones del archivo
  private cuartiles = computed(() => {
    const v = (this.p()?.predicciones ?? []).map(f => f.prediccion).sort((a, b) => a - b);
    const q = (x: number) => v[Math.floor(x * (v.length - 1))] ?? 0;
    return { q1: q(0.25), q2: q(0.5) };
  });
  protected corte = computed(() => this.cuartiles().q1);
  prioridad = (f: FilaPrediccion): Prioridad => f.prediccion <= this.cuartiles().q1 ? 'alta' : f.prediccion <= this.cuartiles().q2 ? 'media' : 'baja';
  protected conteo = computed(() => {
    const c = { alta: 0, media: 0, baja: 0 };
    for (const f of this.p()?.predicciones ?? []) c[this.prioridad(f)]++;
    return c;
  });

  protected filtradas = computed(() => {
    const q = this.q().toLowerCase(), t = this.tipo(), pr = this.prio();
    return (this.p()?.predicciones ?? [])
      .filter(f => (t === 'todos' || f.tipo_unidad === t) && (pr === 'todas' || this.prioridad(f) === pr)
                   && (!q || (f.nombre ?? '').toLowerCase().includes(q) || f.codigo.includes(q)))
      .sort((a, b) => a.prediccion - b.prediccion);
  });
  protected visibles = computed(() => this.filtradas().slice(0, this.limite()));
  pos = (x: number) => Math.max(0, Math.min(100, ((x - 100) / 250) * 100));  // escala visible 100-350 pts

  protected distribucion = computed<ApexOptions>(() => {
    const f = this.filtradas(), ancho = 10, min = 100, max = 350;
    const bins = Array.from({ length: (max - min) / ancho }, (_, i) => min + i * ancho);
    const cuenta = (t: string) => bins.map(b => f.filter(x => x.tipo_unidad === t && x.prediccion >= b && x.prediccion < b + ancho).length);
    return { chart: { type: 'bar', stacked: true }, series: [{ name: 'Colegios', data: cuenta('colegio') }, { name: 'Municipios', data: cuenta('municipio') }],
             xaxis: { categories: bins.map(b => `${b}`), title: { text: 'Puntaje esperado' }, tickAmount: 10 },
             plotOptions: { bar: { columnWidth: '92%', borderRadius: 2 } }, legend: { position: 'top' },
             annotations: { xaxis: [{ x: `${Math.floor(this.corte() / ancho) * ancho}`, borderColor: '#EF4444', label: { text: 'cuartil inferior', style: { color: '#fff', background: '#EF4444' } } }] } };
  });

  protected extremos = computed<ApexOptions>(() => {
    const f = this.filtradas(), sel = [...f.slice(0, 5), ...f.slice(-5)].filter((x, i, a) => a.indexOf(x) === i);
    return { chart: { type: 'rangeBar' }, plotOptions: { bar: { horizontal: true, barHeight: '45%', borderRadius: 4 } },
             series: [{ name: 'Intervalo 80 %', data: sel.map(x => ({ x: (x.nombre ?? x.codigo).slice(0, 26), y: [x.desde ?? x.prediccion, x.hasta ?? x.prediccion],
                                                                       fillColor: this.prioridad(x) === 'alta' ? '#EF4444' : '#06B6D4' })) }],
             xaxis: { min: 100, max: 350 }, dataLabels: { enabled: false }, yaxis: { labels: { style: { fontSize: '10.5px' } } } };
  });
}
