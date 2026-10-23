// COMMAND CENTER: de un vistazo, qué modelo está en producción, qué tan bien predice, si el sistema está sano y qué
// decisión humana está pendiente.
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApexOptions } from 'apexcharts';

import { fecha, haceCuanto, num } from '../core/formato';
import { SentinelStore } from '../core/store';
import { Evolucion } from '../shared/evolucion';
import { Grafica } from '../shared/grafica';
import { Kpi, Vacio } from '../shared/ui';

@Component({
  selector: 'sx-dashboard',
  imports: [RouterLink, Kpi, Grafica, Evolucion, Vacio],
  template: `
    <div class="sx-page">
      <section class="heroe sx-card">
        <div class="texto">
          <div class="sx-eyebrow">Command Center · {{ hoy }}</div>
          <h1>{{ titular() }}</h1>
          <p class="sx-muted">{{ bajada() }}</p>
          <div class="acciones">
            <a class="sx-btn primary lg" routerLink="/validacion"><span class="material-symbols-rounded">upload_file</span>Validar un dataset</a>
            @if (store.candidatas().length) {
              <a class="sx-btn lg sx-animated-border" routerLink="/decision"><span class="material-symbols-rounded">gavel</span>Revisar {{ store.candidatas()[0].id }}</a>
            } @else {
              <a class="sx-btn lg" routerLink="/laboratorio"><span class="material-symbols-rounded">science</span>Reentrenar</a>
            }
          </div>
        </div>
        <div class="escudo" aria-hidden="true">
          <div class="anillo a1"></div><div class="anillo a2"></div><div class="anillo a3"></div>
          <img src="sentinel.svg" alt="" />
        </div>
      </section>

      @if (store.apiOnline() === false) {
        <sx-vacio icono="cloud_off" titulo="Sin conexión con el backend"
                  texto="SENTINEL no puede hablar con Crow. Inicie crow-service/build/saber11_api en el puerto 8080 y vuelva a intentar.">
          <button class="sx-btn primary" (click)="store.cargarModelo()"><span class="material-symbols-rounded">refresh</span>Reintentar</button>
        </sx-vacio>
      }

      <div class="kpis sx-grid sx-stagger">
        @if (meta(); as m) {
          <sx-kpi etiqueta="Modelo activo" [texto]="m.version" icono="deployed_code" tono="active" [detalle]="'Entrenado ' + fechaCorta(m.fecha_entrenamiento)" />
          <sx-kpi etiqueta="Error medio · Chocó" [valor]="m.validacion.mae_choco" [decimales]="2" sufijo=" pts" icono="target" tono="accent"
                  [detalle]="ventaja()" />
          <sx-kpi etiqueta="Registros de entrenamiento" [valor]="m.datos.registros" icono="dataset" tono="accent"
                  [detalle]="'Años ' + m.datos.anios_objetivo.join(', ')" />
          <sx-kpi etiqueta="Decisiones pendientes" [valor]="store.candidatas().length" icono="gavel"
                  [tono]="store.candidatas().length ? 'candidate' : 'ok'"
                  [detalle]="store.candidatas().length ? 'Requiere aprobación humana' : 'Nada esperando revisión'" />
        } @else {
          @for (i of [1, 2, 3, 4]; track i) { <div class="sx-card esqueleto"><div class="sx-skeleton" style="width:40%"></div><div class="sx-skeleton" style="height:32px;width:60%"></div><div class="sx-skeleton" style="width:80%"></div></div> }
        }
      </div>

      <div class="cuerpo">
        <section class="sx-card salud">
          <div class="cab"><h3>Salud del sistema</h3><span class="sx-muted">{{ enOrden() }}/{{ chequeos().length }} en orden</span></div>
          <ul>
            @for (c of chequeos(); track c.nombre) {
              <li><span class="sx-dot" [class.pulse]="c.ok" [style.color]="c.ok ? 'var(--sx-success)' : c.ok === null ? 'var(--sx-muted)' : 'var(--sx-danger)'"></span>
                <div><b>{{ c.nombre }}</b><small class="sx-muted">{{ c.detalle }}</small></div></li>
            }
          </ul>
        </section>

        <section class="sx-card explicacion">
          <div class="cab"><h3>Qué pesa en la predicción</h3><span class="sx-muted">coeficientes del modelo activo</span></div>
          @if (pesos(); as p) { <sx-grafica [opciones]="p" [alto]="220" etiqueta="Peso de cada variable en la predicción" /> }
          @if (meta(); as m) { <p class="formula mono">{{ m.configuracion.formula }}</p> }
        </section>

        <section class="sx-card insights">
          <div class="cab"><h3>Insights del sistema</h3><span class="material-symbols-rounded brillo" aria-hidden="true">auto_awesome</span></div>
          <ul>
            @for (i of insights(); track i) { <li>{{ i }}</li> }
          </ul>
        </section>

        <section class="sx-card intervalos">
          <div class="cab"><h3>Precisión según tamaño</h3><span class="sx-muted">intervalo de 80 % (± puntos)</span></div>
          @if (incertidumbre(); as o) { <sx-grafica [opciones]="o" [alto]="220" etiqueta="Ancho del intervalo según estudiantes" /> }
        </section>
      </div>

      <section class="sx-card">
        <div class="cab"><h3>Model Evolution</h3><a routerLink="/historial" class="sx-muted">Ver historial completo →</a></div>
        <sx-evolucion [versiones]="store.versiones()" />
      </section>

      <section class="sx-card">
        <div class="cab"><h3>Actividad</h3><span class="sx-muted">{{ store.actividad().length }} eventos en este navegador</span></div>
        <ol class="timeline">
          @for (e of store.actividad().slice(0, 7); track e.fecha) {
            <li [attr.data-tono]="e.tono"><span class="sx-dot"></span>
              <div><b>{{ e.titulo }}</b>@if (e.detalle) { <span class="sx-muted"> · {{ e.detalle }}</span> }</div>
              <time class="sx-muted">{{ hace(e.fecha) }}</time></li>
          } @empty { <li class="sx-muted">Aún no hay actividad. Empiece validando un dataset.</li> }
        </ol>
      </section>
    </div>`,
  styles: `
    .heroe { position: relative; overflow: hidden; display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 24px; padding: 32px 36px;
             background: radial-gradient(800px 300px at 0% 0%, var(--sx-aurora-1), transparent), radial-gradient(600px 300px at 100% 100%, var(--sx-aurora-2), transparent), var(--sx-card); }
    .heroe h1 { font-size: clamp(24px, 3vw, 34px); margin: 8px 0 6px; max-width: 760px; }
    .heroe p { margin: 0; max-width: 680px; }
    .acciones { display: flex; gap: 12px; margin-top: 22px; flex-wrap: wrap; }
    .escudo { position: relative; width: 170px; height: 170px; display: grid; place-items: center; }
    .escudo img { width: 74px; height: 74px; filter: drop-shadow(0 0 24px rgba(110, 231, 255, 0.45)); }
    .anillo { position: absolute; inset: 0; border-radius: 50%; border: 1px solid color-mix(in srgb, var(--sx-accent) 35%, transparent); animation: latir 3.6s ease-out infinite; }
    .a2 { animation-delay: 1.2s; } .a3 { animation-delay: 2.4s; }
    @keyframes latir { from { transform: scale(0.45); opacity: 1; } to { transform: scale(1.05); opacity: 0; } }
    .kpis { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .esqueleto { display: flex; flex-direction: column; gap: 12px; min-height: 132px; }
    .cuerpo { display: grid; gap: 16px; grid-template-columns: repeat(12, 1fr); }
    .salud { grid-column: span 4; } .explicacion { grid-column: span 8; } .insights { grid-column: span 7; } .intervalos { grid-column: span 5; }
    .cab { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; gap: 12px; }
    .cab a { text-decoration: none; font-size: 13px; }
    .salud ul, .insights ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
    .salud li { display: flex; gap: 12px; align-items: flex-start; } .salud .sx-dot { margin-top: 7px; flex: none; }
    .salud small { display: block; }
    .insights li { position: relative; padding-left: 22px; } .insights li::before { content: '›'; position: absolute; left: 4px; color: var(--sx-accent); font-weight: 700; }
    .brillo { color: var(--sx-candidate); }
    .formula { margin: 8px 0 0; padding: 10px 12px; border-radius: 10px; background: var(--sx-panel); color: var(--sx-muted); font-size: 12px; overflow-x: auto; }
    .timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .timeline li { display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--sx-border); }
    .timeline li:last-child { border: 0; }
    .timeline .sx-dot { color: var(--sx-muted); } .timeline [data-tono=ok] .sx-dot { color: var(--sx-success); }
    .timeline [data-tono=bad] .sx-dot { color: var(--sx-danger); } .timeline [data-tono=candidate] .sx-dot { color: var(--sx-candidate); }
    .timeline [data-tono=active] .sx-dot { color: var(--sx-active); } .timeline [data-tono=warn] .sx-dot { color: var(--sx-warning); }
    @media (max-width: 1100px) { .salud, .explicacion, .insights, .intervalos { grid-column: span 12; } }
    @media (max-width: 700px) { .heroe { grid-template-columns: 1fr; padding: 24px; } .escudo { display: none; } }`,
})
export class Dashboard {
  protected store = inject(SentinelStore);
  protected meta = this.store.metadata;
  protected hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  protected fechaCorta = (s: string) => fecha(s, false);
  protected hace = haceCuanto;

  protected titular = computed(() => {
    if (this.store.apiOnline() === false) return 'El sistema está desconectado del backend.';
    const c = this.store.candidatas();
    if (c.length) return `${c[0].id} espera su decisión antes de llegar a producción.`;
    const a = this.store.activa();
    return a ? `${a.id} está en producción y bajo control.` : 'Cargando el estado del sistema…';
  });
  protected bajada = computed(() =>
    'SENTINEL valida cada dataset, explica el modelo y exige aprobación humana antes de promover cualquier versión. ' +
    'Ningún modelo entra a producción por sí solo.');

  protected ventaja = computed(() => {
    const m = this.meta();
    if (!m) return '';
    const d = m.validacion.lineas_base.promedio_3_mae_choco - m.validacion.mae_choco;
    return d >= 0 ? `${num(d, 2)} pts mejor que el promedio de 3 años` : `${num(-d, 2)} pts peor que el promedio de 3 años`;
  });

  protected chequeos = computed(() => {
    const ok = this.store.apiOnline(), m = this.meta();
    const ultimaAct = this.store.actividad().find(e => e.tipo === 'actualizacion' || (e.tipo === 'error' && e.titulo.includes('entren')));
    return [
      { nombre: 'API Crow', ok, detalle: ok === null ? 'Consultando…' : ok ? 'Respondiendo en /api' : 'No responde' },
      { nombre: 'Modelo ONNX', ok: ok ? !!m : null, detalle: m ? `${m.version} cargado · ${m.variables_predictoras.length} entradas` : 'Sin modelo activo' },
      { nombre: 'Validador de esquema', ok: ok ? !!m : null, detalle: 'reglas_dominio.json + metadatos del modelo' },
      { nombre: 'Pipeline de entrenamiento', ok: ultimaAct ? ultimaAct.tipo === 'actualizacion' : ok ? true : null,
        detalle: ultimaAct ? `Último: ${ultimaAct.titulo} (${haceCuanto(ultimaAct.fecha)})` : 'Listo para reentrenar' },
    ];
  });

  protected enOrden = computed(() => this.chequeos().filter(c => c.ok).length);

  protected pesos = computed<ApexOptions | null>(() => {
    const c = this.meta()?.configuracion.coeficientes;
    if (!c) return null;
    const nombres: Record<string, string> = { puntaje_ultimo: 'Último año', puntaje_anterior: 'Año anterior', promedio_3: 'Promedio 3 años', puntaje_grupo: 'Municipio/depto.' };
    return {
      chart: { type: 'bar' },
      series: [{ name: 'Peso', data: Object.values(c).map(v => +v.toFixed(3)) }],
      xaxis: { categories: Object.keys(c).map(k => nombres[k] ?? k) },
      plotOptions: { bar: { horizontal: true, borderRadius: 6, distributed: true, barHeight: '58%' } },
      legend: { show: false },
      dataLabels: { enabled: true, formatter: (v: number) => num(v, 3), style: { fontWeight: 600 } },
    };
  });

  protected incertidumbre = computed<ApexOptions | null>(() => {
    const iv = this.meta()?.intervalo_80;
    if (!iv) return null;
    const tramos = ['<10', '10-29', '>=30'];
    return {
      chart: { type: 'bar' },
      series: Object.entries(iv).map(([tipo, v]) => ({ name: tipo === 'colegio' ? 'Colegios' : 'Municipios', data: tramos.map(t => v[t] ?? 0) })),
      xaxis: { categories: ['< 10 estudiantes', '10 a 29', '30 o más'] },
      plotOptions: { bar: { borderRadius: 6, columnWidth: '55%' } },
      yaxis: { labels: { formatter: (x: number) => `±${num(x, 0)}` } },
      legend: { position: 'top' },
    };
  });

  protected insights = computed(() => {
    const m = this.meta();
    if (!m) return ['Conectando con el modelo activo…'];
    const v = m.validacion, iv = m.intervalo_80;
    const c = m.configuracion.coeficientes;
    return [
      `El modelo se equivoca en promedio ${num(v.mae_choco, 2)} puntos en Chocó (escala 0-500) al predecir el año siguiente.`,
      `Supera a repetir el último año por ${num(v.lineas_base.persistencia_mae_choco - v.mae_choco, 2)} puntos y al promedio de 3 años por ${num(v.lineas_base.promedio_3_mae_choco - v.mae_choco, 2)}.`,
      `La predicción se apoya en el promedio de 3 años (peso ${num(c['promedio_3'], 2)}) y corrige con el último año (${num(c['puntaje_ultimo'], 2)}).`,
      `Los colegios con menos de 10 estudiantes son los menos predecibles: ±${num(iv['colegio']?.['<10'], 1)} puntos.`,
      `Sin intercepto: el modelo no puede inventar subidas o bajadas de todo el país.`,
    ];
  });
}
