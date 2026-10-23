// LABORATORIO: reentrenamiento controlado. Datos nuevos etiquetados → validación → EDA → integración → candidata.
// Termina siempre en "esperando decisión humana": el laboratorio nunca promueve un modelo.
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { num } from '../core/formato';
import { SentinelStore } from '../core/store';
import { EJEMPLOS_ENTRENAMIENTO, Ejemplos } from '../shared/ejemplos';
import { Estado, ZonaArchivo } from '../shared/ui';

const PASOS = [
  { titulo: 'Validación (modo entrenamiento)', detalle: 'Esquema, tipos, rangos y puntaje_real obligatorio', icono: 'verified_user' },
  { titulo: 'EDA de los registros nuevos', detalle: 'Perfil del lote antes de integrarlo', icono: 'travel_explore' },
  { titulo: 'Integración', detalle: 'Conjunto activo + lote, en un archivo aparte', icono: 'merge' },
  { titulo: 'Entrenamiento', detalle: 'Pipeline scikit-learn → ONNX', icono: 'model_training' },
  { titulo: 'Validación temporal', detalle: 'Cada año se predice con los anteriores', icono: 'timeline' },
  { titulo: 'Comparación con la activa', detalle: 'Misma métrica principal y secundarias', icono: 'compare_arrows' },
  { titulo: 'Decisión humana', detalle: 'La candidata no se activa sola', icono: 'gavel' },
];

@Component({
  selector: 'sx-laboratorio',
  imports: [ZonaArchivo, RouterLink, Estado, Ejemplos],
  template: `
    <div class="sx-page">
      <header class="sx-page-head">
        <div>
          <div class="sx-eyebrow">Reentrenamiento controlado</div>
          <h1>Laboratorio</h1>
          <p>Cuando llegan resultados reales (por ejemplo, Saber 11 de un año nuevo), se entrena una versión candidata con
             la misma validación y se compara con la activa. El laboratorio no promueve modelos: eso lo decide una persona.</p>
        </div>
        <sx-ejemplos [ejemplos]="ejemplos" (elegido)="store.fijarArchivoEntrenamiento($event)" />
      </header>

      <section class="fusion">
        <article class="sx-card dataset actual">
          <div class="sx-eyebrow">Dataset actual · {{ store.activa()?.id }}</div>
          <div class="cifra">{{ num(meta()?.datos?.registros) }}</div>
          <span class="sx-muted">registros · años {{ meta()?.datos?.anios_objetivo?.join(', ') }}</span>
          <code class="sx-muted">{{ store.activa()?.datos }}</code>
        </article>
        <div class="mas" aria-hidden="true"><span class="material-symbols-rounded">add</span></div>
        <sx-zona-archivo class="dataset" [archivo]="store.archivoEntrenamiento()" titulo="Datos nuevos etiquetados"
                         ayuda="CSV con la columna puntaje_real (p. ej. 08_novedades_2022_etiquetadas.csv)"
                         (elegido)="store.fijarArchivoEntrenamiento($event)" />
        <div class="mas" aria-hidden="true"><span class="material-symbols-rounded">arrow_forward</span></div>
        <article class="sx-card dataset resultado" [class.listo]="!!a()">
          <div class="sx-eyebrow">Conjunto actualizado</div>
          @if (a(); as a) {
            <div class="cifra">{{ num(a.conjunto_actualizado.registros) }}</div>
            <span class="sx-muted"><b class="verde">+{{ num(a.lote.nuevos) }}</b> nuevos · {{ num(a.lote.reemplazados) }} reemplazados</span>
            <code class="sx-muted">{{ a.conjunto_actualizado.archivo }}</code>
          } @else { <div class="cifra tenue">—</div><span class="sx-muted">Se crea al entrenar la candidata</span> }
        </article>
      </section>

      <div class="lanzar">
        <button class="sx-btn primary lg" [disabled]="!store.archivoEntrenamiento() || store.ocupado().actualizar" (click)="iniciar()">
          <span class="material-symbols-rounded">{{ store.ocupado().actualizar ? 'progress_activity' : 'rocket_launch' }}</span>
          {{ store.ocupado().actualizar ? 'Entrenando candidata…' : 'Entrenar versión candidata' }}
        </button>
        <span class="sx-muted">Solo corre un entrenamiento a la vez. Tarda unos segundos.</span>
      </div>

      <section class="sx-card pipeline">
        <h3>Pipeline</h3>
        <ol>
          @for (p of pasos; track p.titulo; let i = $index) {
            <li [attr.data-s]="estadoPaso(i)">
              <span class="nodo"><span class="material-symbols-rounded" aria-hidden="true">{{ estadoPaso(i) === 'hecho' ? 'check' : estadoPaso(i) === 'error' ? 'close' : p.icono }}</span></span>
              <div><b>{{ p.titulo }}</b><small class="sx-muted">{{ p.detalle }}</small></div>
              <span class="tag">{{ etiqueta(i) }}</span>
            </li>
          }
        </ol>
      </section>

      @if (a(); as a) {
        <section class="sx-card candidata sx-animated-border">
          <div class="izq">
            <sx-estado estado="candidato" [pulso]="true" />
            <h2 class="mono">{{ a.candidata.version }}</h2>
            <p class="sx-muted">Entrenada con {{ num(a.conjunto_actualizado.registros) }} registros · años {{ a.conjunto_actualizado.anios_objetivo.join(', ') }}</p>
          </div>
          <div class="metricas">
            <div><span class="sx-eyebrow">MAE activa</span><b>{{ num(a.comparacion.principal.activa, 2) }}</b></div>
            <span class="material-symbols-rounded flecha" aria-hidden="true">east</span>
            <div><span class="sx-eyebrow">MAE candidata</span><b class="morado">{{ num(a.comparacion.principal.candidata, 2) }}</b></div>
          </div>
          <div class="reco" [attr.data-r]="a.recomendacion.accion_sugerida">
            <span class="material-symbols-rounded" aria-hidden="true">auto_awesome</span>
            <div><b>Recomendación del sistema: {{ a.recomendacion.accion_sugerida }}</b><small class="sx-muted">{{ a.recomendacion.nota }}</small></div>
          </div>
          <div class="acciones">
            <a class="sx-btn primary" routerLink="/comparacion" [queryParams]="{ v: a.candidata.version }"><span class="material-symbols-rounded">compare_arrows</span>Comparar</a>
            <a class="sx-btn" routerLink="/decision" [queryParams]="{ v: a.candidata.version }"><span class="material-symbols-rounded">gavel</span>Ir a decisión</a>
            @if (r(); as r) {
              <a class="sx-btn" [href]="r.descargas['eda_nuevos.html']" target="_blank" rel="noopener">EDA nuevos</a>
              <a class="sx-btn" [href]="r.descargas['eda_conjunto.html']" target="_blank" rel="noopener">EDA conjunto</a>
              <a class="sx-btn" [href]="r.descargas['actualizacion.html']" target="_blank" rel="noopener">Reporte</a>
            }
          </div>
        </section>
      }

      @if (rechazado()) {
        <section class="sx-card bloqueo">
          <span class="material-symbols-rounded" aria-hidden="true">block</span>
          <div><b>Los datos no superaron la validación.</b>
            <p class="sx-muted">{{ store.validacion()?.resumen?.errores }} errores. No se integró nada ni se entrenó una candidata.
              @for (p of erroresTop(); track $index) { <br>· <code>{{ p.variable }}</code>: {{ p.mensaje }} }</p>
            <a class="sx-btn" [href]="store.validacion()?.descargas?.['compatibilidad.html']" target="_blank" rel="noopener">Ver reporte de compatibilidad</a></div>
        </section>
      }
    </div>`,
  styles: `
    .fusion { display: grid; grid-template-columns: 1fr auto 1.3fr auto 1fr; gap: 12px; align-items: stretch; }
    .dataset { display: flex; flex-direction: column; gap: 4px; justify-content: center; }
    .cifra { font: 650 34px var(--sx-font); letter-spacing: -0.03em; } .cifra.tenue { color: var(--sx-faint); }
    .dataset code { font-size: 11.5px; margin-top: 6px; word-break: break-all; }
    .actual { border-top: 3px solid var(--sx-active); } .resultado { border-top: 3px solid var(--sx-border-strong); }
    .resultado.listo { border-top-color: var(--sx-candidate); animation: sx-pop 500ms var(--sx-ease); }
    .verde { color: var(--sx-success); }
    .mas { display: grid; place-items: center; color: var(--sx-faint); }
    .lanzar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .pipeline ol { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; }
    .pipeline li { position: relative; display: grid; grid-template-columns: 40px 1fr auto; gap: 14px; align-items: center; padding: 10px 0; --c: var(--sx-faint); }
    .pipeline li:not(:last-child)::after { content: ''; position: absolute; left: 19px; top: 46px; bottom: -10px; width: 2px; background: var(--c); opacity: 0.4; }
    .pipeline li[data-s=hecho] { --c: var(--sx-success); } .pipeline li[data-s=curso] { --c: var(--sx-accent); }
    .pipeline li[data-s=espera] { --c: var(--sx-candidate); } .pipeline li[data-s=error] { --c: var(--sx-danger); }
    .pipeline small { display: block; }
    .nodo { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; color: var(--c);
            background: color-mix(in srgb, var(--c) 14%, var(--sx-card)); border: 1px solid color-mix(in srgb, var(--c) 45%, transparent); transition: all var(--sx-med); }
    .pipeline li[data-s=curso] .nodo { box-shadow: 0 0 0 0 var(--sx-accent); animation: sx-pulse 1.2s infinite; color: var(--sx-accent); }
    .pipeline li[data-s=curso] .nodo span { animation: girar 1.6s linear infinite; } @keyframes girar { to { transform: rotate(360deg); } }
    .tag { font: 600 11px var(--sx-mono); color: var(--c); text-transform: uppercase; letter-spacing: 0.06em; }
    .candidata { display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: center; }
    .candidata h2 { font-size: 34px; margin: 8px 0 2px; } .candidata p { margin: 0; }
    .metricas { display: flex; align-items: center; gap: 16px; } .metricas div { display: flex; flex-direction: column; }
    .metricas b { font: 650 28px var(--sx-mono); } .morado { color: var(--sx-candidate); } .flecha { color: var(--sx-faint); }
    .reco { grid-column: 1 / -1; display: flex; gap: 12px; padding: 12px 14px; border-radius: 12px; background: color-mix(in srgb, var(--sx-candidate) 10%, transparent); }
    .reco span { color: var(--sx-candidate); } .reco small { display: block; } .reco[data-r=activar] b { color: var(--sx-success); }
    .acciones { grid-column: 1 / -1; display: flex; gap: 10px; flex-wrap: wrap; }
    .bloqueo { display: flex; gap: 14px; border-left: 3px solid var(--sx-danger); } .bloqueo > span { color: var(--sx-danger); font-size: 30px; }
    .bloqueo p { margin: 4px 0 12px; }
    @media (max-width: 1100px) { .fusion { grid-template-columns: 1fr; } .mas { transform: rotate(90deg); } .candidata { grid-template-columns: 1fr; } }`,
})
export class Laboratorio {
  protected store = inject(SentinelStore);
  protected pasos = PASOS;
  protected ejemplos = EJEMPLOS_ENTRENAMIENTO;
  protected num = num;
  protected meta = this.store.metadata;
  protected r = this.store.actualizacion;
  protected a = computed(() => this.r()?.actualizacion ?? null);
  private paso = signal(-1);             // avance visual mientras Crow y Python trabajan
  protected rechazado = signal(false);
  protected erroresTop = computed(() => (this.store.validacion()?.problemas ?? []).filter(p => p.nivel === 'error').slice(0, 4));
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    effect(() => { if (!this.store.ocupado().actualizar && this.timer) { clearInterval(this.timer); this.timer = undefined; } });
  }

  async iniciar() {
    this.rechazado.set(false);
    this.paso.set(0);
    this.timer = setInterval(() => this.paso.set(Math.min(5, this.paso() + 1)), 650);
    await this.store.actualizar();
    this.rechazado.set(!this.a() && this.store.validacion()?.estado === 'incompatible');
    this.paso.set(-1);
  }

  estadoPaso(i: number): 'hecho' | 'curso' | 'espera' | 'error' | 'pendiente' {
    if (this.store.ocupado().actualizar) return i < this.paso() ? 'hecho' : i === this.paso() ? 'curso' : 'pendiente';
    if (this.rechazado()) return i === 0 ? 'error' : 'pendiente';
    if (this.a()) return i === PASOS.length - 1 ? 'espera' : 'hecho';
    return 'pendiente';
  }
  etiqueta(i: number) {
    return { hecho: 'listo', curso: 'en curso', espera: 'pendiente', error: 'falló', pendiente: '' }[this.estadoPaso(i)];
  }
}
