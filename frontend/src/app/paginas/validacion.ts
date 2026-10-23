// VALIDACIÓN: antes de predecir. Muestra en qué etapa falla el archivo (flujo), qué columnas sobran o faltan
// (diff de esquema) y cada problema con lo esperado frente a lo encontrado. Nunca corrige datos.
import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { Problema } from '../core/api';
import { num } from '../core/formato';
import { SentinelStore } from '../core/store';
import { EJEMPLOS_PREDICCION, Ejemplos } from '../shared/ejemplos';
import { Anillo, Estado, Vacio, ZonaArchivo } from '../shared/ui';

const ETAPAS = [
  { id: 'esquema', titulo: 'Esquema', icono: 'schema', ayuda: 'Columnas obligatorias y adicionales' },
  { id: 'tipo', titulo: 'Tipos', icono: 'data_object', ayuda: 'Número, entero, texto o categoría' },
  { id: 'contenido', titulo: 'Contenido', icono: 'rule', ayuda: 'Vacíos, formatos y categorías' },
  { id: 'dominio', titulo: 'Dominio', icono: 'straighten', ayuda: 'Rangos válidos (0-500, 0-1…)' },
  { id: 'regla', titulo: 'Reglas cruzadas', icono: 'account_tree', ayuda: 'Coherencia entre columnas' },
] as const;

@Component({
  selector: 'sx-validacion',
  imports: [ZonaArchivo, Anillo, Estado, Vacio, RouterLink, Ejemplos],
  template: `
    <div class="sx-page">
      <header class="sx-page-head">
        <div>
          <div class="sx-eyebrow">Paso 1 · Antes de predecir</div>
          <h1>Validación de compatibilidad</h1>
          <p>SENTINEL compara el archivo con el esquema del modelo activo. Si encuentra un error, bloquea la predicción y
             explica qué corregir: nunca modifica sus datos en silencio.</p>
        </div>
        <sx-ejemplos [ejemplos]="ejemplos" (elegido)="store.fijarArchivo($event); store.validar()" />
      </header>

      <div class="carga">
        <sx-zona-archivo [archivo]="store.archivo()" (elegido)="store.fijarArchivo($event)" />
        <div class="lado sx-card">
          <div class="sx-eyebrow">Modelo de referencia</div>
          <b class="mono">{{ store.activa()?.id ?? '—' }}</b>
          <p class="sx-muted">{{ esperadas() }} columnas obligatorias · reglas en <code>reglas_dominio.json</code></p>
          <button class="sx-btn primary lg" [disabled]="!store.archivo() || store.ocupado().validar" (click)="store.validar()">
            <span class="material-symbols-rounded">{{ store.ocupado().validar ? 'progress_activity' : 'verified_user' }}</span>
            {{ store.ocupado().validar ? 'Validando…' : 'Validar compatibilidad' }}
          </button>
        </div>
      </div>

      @if (v(); as v) {
        <section class="resumen sx-card" [attr.data-estado]="v.estado">
          <sx-anillo [valor]="store.saludDatos()" etiqueta="Data health" />
          <div class="veredicto">
            <sx-estado [estado]="v.estado" />
            <h2>{{ veredicto() }}</h2>
            <p class="sx-muted">{{ v.archivo }} · {{ fmt(v.filas) }} filas · {{ fmt(v.filas_con_errores) }} con errores · modelo {{ v.modelo_version }}</p>
            <div class="acciones">
              @if (v.estado !== 'incompatible') {
                <button class="sx-btn primary" (click)="predecir()"><span class="material-symbols-rounded">insights</span>Generar predicciones</button>
              }
              <a class="sx-btn" routerLink="/observatorio"><span class="material-symbols-rounded">travel_explore</span>Explorar en el Observatory</a>
              <a class="sx-btn" [href]="v.descargas['compatibilidad.html']" target="_blank" rel="noopener"><span class="material-symbols-rounded">download</span>Reporte</a>
            </div>
          </div>
          <div class="cifras">
            <div><b class="bad">{{ v.resumen.errores }}</b><span>errores</span></div>
            <div><b class="warn">{{ v.resumen.advertencias }}</b><span>advertencias</span></div>
            <div><b>{{ v.columnas.recibidas.length }}</b><span>columnas</span></div>
          </div>
        </section>

        <section>
          <h3 class="titulo">Validation flow</h3>
          <ol class="flujo">
            @for (e of etapas(); track e.id; let i = $index) {
              <li [attr.data-r]="e.resultado" [style.animation-delay.ms]="i * 110">
                <span class="nodo"><span class="material-symbols-rounded" aria-hidden="true">{{ e.resultado === 'ok' ? 'check' : e.resultado === 'warn' ? 'priority_high' : 'close' }}</span></span>
                <b>{{ e.titulo }}</b>
                <small class="sx-muted">{{ e.resumen }}</small>
              </li>
            }
          </ol>
        </section>

        <section class="sx-card">
          <div class="cab"><h3>Schema diff</h3>
            <div class="leyenda"><span class="ok">● coincide</span><span class="bad">● falta</span><span class="warn">● adicional (se ignora)</span></div></div>
          <div class="esquema">
            @for (c of diff(); track c.nombre) {
              <div class="col" [attr.data-s]="c.estado" [title]="c.nota">
                <span class="material-symbols-rounded" aria-hidden="true">{{ c.estado === 'ok' ? 'check_circle' : c.estado === 'falta' ? 'remove_circle' : c.estado === 'tipo' ? 'error' : 'add_circle' }}</span>
                <div><b class="mono">{{ c.nombre }}</b><small>{{ c.nota }}</small></div>
              </div>
            }
          </div>
        </section>

        <section>
          <h3 class="titulo">Hallazgos ({{ v.problemas.length }})</h3>
          <div class="problemas sx-stagger">
            @for (p of v.problemas; track $index) {
              <article class="sx-card problema" [attr.data-nivel]="p.nivel">
                <header>
                  <span class="material-symbols-rounded" aria-hidden="true">{{ p.nivel === 'error' ? 'dangerous' : 'warning' }}</span>
                  <b class="mono">{{ p.variable || 'archivo' }}</b><span class="sx-pill" [class]="p.nivel === 'error' ? 'sx-pill bad' : 'sx-pill warn'">{{ p.categoria }}</span>
                  @if (p.filas_afectadas) { <span class="sx-muted filas">{{ fmt(p.filas_afectadas) }} filas</span> }
                </header>
                <p>{{ p.mensaje }}</p>
                @if (p.esperado || p.encontrado) {
                  <div class="comparar">
                    <div><span class="sx-eyebrow">Esperado</span><code>{{ p.esperado || '—' }}</code></div>
                    <span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span>
                    <div><span class="sx-eyebrow">Encontrado</span><code>{{ p.encontrado || '—' }}</code></div>
                  </div>
                }
                @if (p.ejemplo_filas.length) {
                  <div class="ejemplos"><span class="sx-muted">Filas:</span>
                    @for (f of p.ejemplo_filas.slice(0, 12); track f) { <span class="chip mono">{{ f }}</span> }
                    @if (p.ejemplo_filas.length > 12) { <span class="sx-muted">…</span> }
                  </div>
                }
              </article>
            } @empty {
              <sx-vacio icono="verified" titulo="Sin hallazgos" texto="El archivo cumple todas las reglas del modelo. Puede generar predicciones." />
            }
          </div>
        </section>
      } @else if (!store.archivo()) {
        <sx-vacio icono="fact_check" titulo="Cargue un dataset para empezar"
                  texto="Use los archivos de sistema-web/pruebas/ para ver cada escenario: compatible, columnas faltantes, tipos incorrectos, vacíos, categorías nuevas…" />
      }
    </div>`,
  styles: `
    .carga { display: grid; grid-template-columns: 1fr 300px; gap: 16px; }
    .lado { display: flex; flex-direction: column; gap: 8px; justify-content: center; } .lado p { margin: 0 0 8px; }
    .resumen { display: grid; grid-template-columns: auto 1fr auto; gap: 28px; align-items: center; border-left: 3px solid var(--e); }
    .resumen { --e: var(--sx-success); } .resumen[data-estado=incompatible] { --e: var(--sx-danger); }
    .resumen[data-estado=compatible_con_advertencias] { --e: var(--sx-warning); }
    .veredicto h2 { margin: 10px 0 4px; font-size: 22px; } .veredicto p { margin: 0; }
    .acciones { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
    .cifras { display: flex; gap: 24px; } .cifras div { display: flex; flex-direction: column; align-items: center; }
    .cifras b { font-size: 30px; font-weight: 650; } .cifras span { color: var(--sx-muted); font-size: 12px; }
    .bad { color: var(--sx-danger); } .warn { color: var(--sx-warning); } .ok { color: var(--sx-success); }
    .titulo { margin: 4px 0 12px; }
    .flujo { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; }
    .flujo li { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 0 8px;
                animation: sx-rise var(--sx-slow) var(--sx-ease) both; --c: var(--sx-success); }
    .flujo li[data-r=warn] { --c: var(--sx-warning); } .flujo li[data-r=bad] { --c: var(--sx-danger); }
    .flujo li:not(:last-child)::after { content: ''; position: absolute; top: 22px; left: calc(50% + 26px); right: calc(-50% + 26px); height: 2px;
                                        background: linear-gradient(90deg, var(--c), var(--sx-border-strong)); }
    .nodo { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; background: color-mix(in srgb, var(--c) 16%, var(--sx-card));
            border: 1px solid color-mix(in srgb, var(--c) 50%, transparent); color: var(--c); box-shadow: 0 0 18px color-mix(in srgb, var(--c) 25%, transparent); }
    .cab { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; gap: 12px; flex-wrap: wrap; }
    .leyenda { display: flex; gap: 14px; font-size: 12px; }
    .esquema { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
    .col { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--sx-border); background: var(--sx-panel); --c: var(--sx-success); }
    .col span { color: var(--c); } .col small { display: block; color: var(--sx-muted); font-size: 11.5px; }
    .col[data-s=falta] { --c: var(--sx-danger); border-style: dashed; border-color: color-mix(in srgb, var(--sx-danger) 50%, transparent); opacity: 0.95; }
    .col[data-s=extra] { --c: var(--sx-warning); } .col[data-s=tipo] { --c: var(--sx-danger); }
    .problemas { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 12px; }
    .problema { border-left: 3px solid var(--c); --c: var(--sx-warning); display: flex; flex-direction: column; gap: 10px; }
    .problema[data-nivel=error] { --c: var(--sx-danger); }
    .problema header { display: flex; align-items: center; gap: 8px; } .problema header > span:first-child { color: var(--c); }
    .problema .filas { margin-left: auto; font-size: 12px; } .problema p { margin: 0; }
    .comparar { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; padding: 10px; border-radius: 10px; background: var(--sx-panel); }
    .comparar div { display: flex; flex-direction: column; gap: 2px; min-width: 0; } .comparar code { word-break: break-word; }
    .comparar > span { color: var(--sx-faint); }
    .ejemplos { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 12px; }
    .chip { padding: 1px 8px; border-radius: 6px; background: color-mix(in srgb, var(--c) 14%, transparent); color: var(--c); }
    @media (max-width: 900px) { .carga, .resumen { grid-template-columns: 1fr; } .flujo { grid-template-columns: 1fr; gap: 12px; }
                                .flujo li { flex-direction: row; text-align: left; } .flujo li::after { display: none; } .problemas { grid-template-columns: 1fr; } }`,
})
export class Validacion {
  protected store = inject(SentinelStore);
  protected ejemplos = EJEMPLOS_PREDICCION;
  private router = inject(Router);
  protected v = this.store.validacion;
  protected fmt = (x: number) => num(x);
  protected esperadas = computed(() => (this.store.metadata()?.variables_predictoras.length ?? 0) + (this.store.metadata()?.variables_auxiliares.length ?? 0) + 6);

  protected veredicto = computed(() => ({
    compatible: 'Listo para predecir. El archivo cumple el contrato del modelo.',
    compatible_con_advertencias: 'Se puede procesar, pero revise las advertencias.',
    incompatible: 'Bloqueado: el modelo no se ejecutará sobre estos datos.',
  })[this.v()!.estado]);

  protected etapas = computed(() => {
    const ps = this.v()?.problemas ?? [];
    return ETAPAS.map(e => {
      const de = ps.filter((p: Problema) => p.categoria === e.id);
      const err = de.filter(p => p.nivel === 'error').length, adv = de.length - err;
      return { ...e, resultado: err ? 'bad' : adv ? 'warn' : 'ok',
               resumen: err ? `${err} error${err > 1 ? 'es' : ''}` : adv ? `${adv} advertencia${adv > 1 ? 's' : ''}` : e.ayuda };
    });
  });

  protected diff = computed(() => {
    const v = this.v();
    if (!v) return [];
    const tipos = new Map(v.tipos.map(t => [t.variable, t]));
    const conTipoMalo = new Set(v.problemas.filter(p => p.categoria === 'tipo').map(p => p.variable));
    return [
      ...v.columnas.esperadas.map(n => {
        if (v.columnas.faltantes.includes(n)) return { nombre: n, estado: 'falta', nota: 'obligatoria · no está en el archivo' };
        const t = tipos.get(n);
        if (conTipoMalo.has(n)) return { nombre: n, estado: 'tipo', nota: `esperado ${t?.esperado} · llegó ${t?.detectado}` };
        return { nombre: n, estado: 'ok', nota: t ? `${t.esperado}` : 'presente' };
      }),
      ...v.columnas.adicionales.map(n => ({ nombre: n, estado: 'extra', nota: 'no la usa el modelo · se ignora' })),
    ];
  });

  predecir() {
    this.router.navigateByUrl('/predicciones');
    this.store.predecir();
  }
}
