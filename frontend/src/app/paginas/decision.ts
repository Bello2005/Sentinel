// CENTRO DE DECISIÓN: aprobar una candidata se siente como hacer merge a producción. Verificaciones automáticas,
// recomendación del sistema, riesgos y beneficios, checklist obligatorio, responsable y justificación escrita.
import { Component, computed, effect, inject, input, untracked, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Actualizacion } from '../core/api';
import { fecha, num } from '../core/formato';
import { SentinelStore } from '../core/store';
import { Vacio } from '../shared/ui';

const CHECKLIST = [
  'Revisé la comparación entre la versión activa y la candidata.',
  'Revisé los riesgos y las limitaciones del modelo.',
  'Los datos nuevos superaron la validación y el EDA no muestra problemas graves.',
  'Entiendo que, si la activo, reemplaza a la versión en producción.',
];

@Component({
  selector: 'sx-decision',
  imports: [FormsModule, RouterLink, Vacio],
  template: `
    <div class="sx-page">
      @if (!cand()) {
        <header class="sx-page-head"><div><div class="sx-eyebrow">Aprobación humana</div><h1>Centro de decisión</h1></div></header>
        <sx-vacio icono="task_alt" titulo="Nada pendiente de aprobación"
                  texto="Todas las versiones tienen una decisión registrada. Cuando el Laboratorio entrene una candidata, aparecerá aquí.">
          <a class="sx-btn primary" routerLink="/laboratorio">Ir al Laboratorio</a><a class="sx-btn" routerLink="/historial">Ver historial</a>
        </sx-vacio>
      } @else {
        <header class="pr">
          <div class="estado-pr"><span class="material-symbols-rounded" aria-hidden="true">merge_type</span>Abierta</div>
          <div>
            <h1>Promover <span class="mono morado">{{ cand()!.id }}</span> a producción</h1>
            <p class="sx-muted">
              <span class="mono rama">{{ store.activa()?.id }}</span> ← <span class="mono rama cand">{{ cand()!.id }}</span>
              · propuesta por el pipeline de entrenamiento · {{ f(cand()!.fecha) }}
            </p>
          </div>
        </header>

        <div class="cuerpo">
          <div class="principal">
            <section class="sx-card">
              <h3>Verificaciones</h3>
              <ul class="checks">
                @for (k of checks(); track k.nombre) {
                  <li [attr.data-ok]="k.ok"><span class="material-symbols-rounded" aria-hidden="true">{{ k.ok ? 'check_circle' : 'cancel' }}</span>
                    <div><b>{{ k.nombre }}</b><small class="sx-muted">{{ k.detalle }}</small></div></li>
                }
              </ul>
            </section>

            @if (a(); as a) {
              <section class="sx-card reco" [attr.data-r]="a.recomendacion.accion_sugerida">
                <div class="cab"><span class="material-symbols-rounded" aria-hidden="true">auto_awesome</span>
                  <div><div class="sx-eyebrow">Recomendación del sistema</div><h2>{{ a.recomendacion.accion_sugerida === 'activar' ? 'Activar' : 'Revisar con cuidado' }}</h2></div></div>
                <p class="sx-muted">{{ a.recomendacion.criterio }}</p>
                <p class="aviso">{{ a.recomendacion.nota }}</p>
              </section>

              <div class="rb">
                <section class="sx-card"><h3 class="ok"><span class="material-symbols-rounded" aria-hidden="true">add_circle</span>Beneficios</h3>
                  <ul>@for (b of beneficios(); track b) { <li>{{ b }}</li> }</ul></section>
                <section class="sx-card"><h3 class="warn"><span class="material-symbols-rounded" aria-hidden="true">report</span>Riesgos</h3>
                  <ul>@for (r of riesgos(); track r) { <li>{{ r }}</li> }</ul></section>
              </div>
            }

            <section class="sx-card firma">
              <h3>Revisión humana</h3>
              <fieldset class="checklist">
                <legend class="sx-muted">Confirme cada punto antes de activar</legend>
                @for (item of checklist; track item; let i = $index) {
                  <label><input type="checkbox" [checked]="marcas()[i]" (change)="marcar(i)" [attr.aria-label]="item" /><span>{{ item }}</span></label>
                }
              </fieldset>
              <label class="campo"><span class="sx-eyebrow">Responsable</span>
                <input [ngModel]="responsable()" (ngModelChange)="responsable.set($event)" placeholder="Nombre de quien decide" autocomplete="name" /></label>
              <label class="campo"><span class="sx-eyebrow">Justificación (mínimo 15 caracteres)</span>
                <textarea rows="4" [ngModel]="justificacion()" (ngModelChange)="justificacion.set($event)"
                          placeholder="Por qué se activa o se rechaza esta versión…"></textarea>
                <small class="sx-muted">{{ justificacion().trim().length }}/15</small></label>

              <div class="botones">
                <button class="sx-btn danger lg" [disabled]="!puedeRechazar() || store.ocupado().decidir" (click)="confirmar.set('rechazar')">
                  <span class="material-symbols-rounded">block</span>Rechazar</button>
                <button class="sx-btn success lg activar" [disabled]="!puedeActivar() || store.ocupado().decidir" (click)="confirmar.set('activar')">
                  <span class="material-symbols-rounded">rocket_launch</span>Activar {{ cand()!.id }}</button>
              </div>
              @if (!puedeActivar()) { <p class="sx-muted pista">Para activar: marque los 4 puntos, indique el responsable y escriba la justificación.</p> }
            </section>
          </div>

          <aside class="lateral">
            <section class="sx-card">
              <div class="sx-eyebrow">Métrica principal</div>
              @if (a(); as a) {
                <div class="mini"><span class="mono">{{ a.activa.version }}</span><b>{{ num(a.comparacion.principal.activa, 2) }}</b></div>
                <div class="mini cand"><span class="mono">{{ a.candidata.version }}</span><b>{{ num(a.comparacion.principal.candidata, 2) }}</b></div>
                <a routerLink="/comparacion" [queryParams]="{ v: cand()!.id }" class="enlace">Ver comparación completa →</a>
              }
            </section>
            <section class="sx-card">
              <div class="sx-eyebrow">Revisores</div>
              <div class="revisor"><span class="avatar">IA</span><div><b>SENTINEL</b><small class="sx-muted">recomienda {{ a()?.recomendacion?.accion_sugerida ?? '…' }}</small></div></div>
              <div class="revisor"><span class="avatar humano">{{ iniciales() }}</span><div><b>{{ responsable() || 'Responsable humano' }}</b><small class="sx-muted">decisión final · obligatoria</small></div></div>
            </section>
            <section class="sx-card"><div class="sx-eyebrow">Política</div>
              <p class="sx-muted">Ninguna versión entra a producción automáticamente. La activa anterior queda como histórica y se puede consultar en el historial.</p></section>
          </aside>
        </div>
      }

      @if (confirmar(); as accion) {
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-t">
          <div class="velo" (click)="confirmar.set(null)"></div>
          <div class="caja sx-card" [attr.data-a]="accion">
            <span class="material-symbols-rounded grande" aria-hidden="true">{{ accion === 'activar' ? 'rocket_launch' : 'block' }}</span>
            <h2 id="confirm-t">{{ accion === 'activar' ? 'Promover ' + cand()!.id + ' a producción' : 'Rechazar ' + cand()!.id }}</h2>
            <p class="sx-muted">{{ accion === 'activar' ? store.activa()?.id + ' pasará a histórico y las predicciones usarán ' + cand()!.id + ' desde la próxima solicitud.'
                                                     : 'La candidata quedará rechazada. ' + store.activa()?.id + ' sigue en producción.' }}</p>
            <div class="botones">
              <button class="sx-btn" (click)="confirmar.set(null)">Cancelar</button>
              <button class="sx-btn lg" [class.success]="accion === 'activar'" [class.danger]="accion === 'rechazar'" (click)="decidir(accion)" cdkFocusInitial>
                {{ store.ocupado().decidir ? 'Registrando…' : 'Confirmar' }}</button>
            </div>
          </div>
        </div>
      }

      @if (celebrar(); as v) {
        <div class="celebracion" role="status" aria-live="assertive">
          <div class="ondas" aria-hidden="true"><i></i><i></i><i></i></div>
          <div class="sello"><span class="material-symbols-rounded" aria-hidden="true">verified</span></div>
          <h2>{{ v }} está en producción</h2>
          <p class="sx-muted">Decisión registrada con responsable y justificación.</p>
        </div>
      }
    </div>`,
  styles: `
    .pr { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
    .pr h1 { font-size: clamp(22px, 2.6vw, 30px); } .pr p { margin: 6px 0 0; }
    .estado-pr { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 999px; background: var(--sx-success); color: #fff; font-weight: 600; margin-top: 4px; }
    .morado { color: var(--sx-candidate); }
    .rama { padding: 2px 8px; border-radius: 6px; background: color-mix(in srgb, var(--sx-active) 14%, transparent); color: var(--sx-active); }
    .rama.cand { background: color-mix(in srgb, var(--sx-candidate) 14%, transparent); color: var(--sx-candidate); }
    .cuerpo { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 20px; align-items: start; }
    .principal { display: flex; flex-direction: column; gap: 16px; } .lateral { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 84px; }
    .checks { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; }
    .checks li { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--sx-border); } .checks li:last-child { border: 0; }
    .checks small { display: block; } .checks [data-ok=true] span { color: var(--sx-success); } .checks [data-ok=false] span { color: var(--sx-danger); }
    .reco { border-left: 3px solid var(--sx-candidate); } .reco .cab { display: flex; gap: 12px; align-items: center; } .reco .cab > span { font-size: 30px; color: var(--sx-candidate); }
    .reco[data-r=activar] h2 { color: var(--sx-success); } .reco[data-r=revisar] h2 { color: var(--sx-warning); }
    .reco p { margin: 10px 0 0; } .aviso { font-weight: 600; }
    .rb { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .rb h3 { display: flex; gap: 8px; align-items: center; font-size: 15px; } .ok { color: var(--sx-success); } .warn { color: var(--sx-warning); }
    .rb ul { margin: 10px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; font-size: 13.5px; }
    .firma { display: flex; flex-direction: column; gap: 16px; }
    .checklist { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; } .checklist legend { margin-bottom: 8px; }
    .checklist label { display: flex; gap: 10px; align-items: flex-start; cursor: pointer; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--sx-border); background: var(--sx-panel); }
    .checklist input { width: 18px; height: 18px; accent-color: var(--sx-success); margin-top: 1px; }
    .campo { display: flex; flex-direction: column; gap: 6px; }
    .campo input, .campo textarea { background: var(--sx-panel); border: 1px solid var(--sx-border-strong); border-radius: 10px; padding: 10px 12px; color: var(--sx-text); font: 14px var(--sx-font); resize: vertical; }
    .campo input:focus, .campo textarea:focus { outline: none; border-color: var(--sx-accent); box-shadow: var(--sx-glow); }
    .botones { display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap; }
    .activar:not(:disabled) { box-shadow: 0 0 0 0 var(--sx-success); animation: sx-pulse 2.2s infinite; color: #fff; }
    .pista { margin: 0; text-align: right; font-size: 12.5px; }
    .mini { display: flex; justify-content: space-between; align-items: baseline; padding: 8px 0; } .mini b { font: 600 20px var(--sx-mono); color: var(--sx-active); }
    .mini.cand b { color: var(--sx-candidate); } .enlace { font-size: 13px; text-decoration: none; }
    .revisor { display: flex; gap: 10px; align-items: center; margin-top: 12px; } .revisor small { display: block; }
    .avatar { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font: 700 12px var(--sx-font);
              background: linear-gradient(135deg, var(--sx-accent), var(--sx-candidate)); color: #0b1020; }
    .avatar.humano { background: var(--sx-panel); color: var(--sx-text); border: 1px solid var(--sx-border-strong); }
    .lateral p { margin: 8px 0 0; font-size: 13px; }
    .modal { position: fixed; inset: 0; z-index: 900; display: grid; place-items: center; padding: 16px; }
    .velo { position: absolute; inset: 0; background: rgba(5, 8, 18, 0.6); backdrop-filter: blur(4px); }
    .caja { position: relative; max-width: 480px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; animation: sx-pop 260ms var(--sx-ease); }
    .caja .grande { font-size: 44px; color: var(--sx-success); } .caja[data-a=rechazar] .grande { color: var(--sx-danger); }
    .caja p { margin: 0 0 8px; }
    .celebracion { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; align-content: center; gap: 10px; text-align: center;
                   background: radial-gradient(circle at center, color-mix(in srgb, var(--sx-success) 20%, var(--sx-bg)), var(--sx-bg) 60%); animation: sx-rise 300ms ease both; }
    .celebracion h2 { font-size: 30px; } .celebracion p { margin: 0; }
    .sello { width: 120px; height: 120px; border-radius: 50%; display: grid; place-items: center; background: var(--sx-success); box-shadow: 0 0 60px color-mix(in srgb, var(--sx-success) 60%, transparent);
             animation: sx-pop 700ms var(--sx-ease) both; }
    .sello span { font-size: 64px; color: #fff; }
    .ondas { position: absolute; width: 120px; height: 120px; top: calc(50% - 110px); left: calc(50% - 60px); }
    .ondas i { position: absolute; inset: 0; border-radius: 50%; border: 2px solid var(--sx-success); animation: onda 1.8s ease-out infinite; }
    .ondas i:nth-child(2) { animation-delay: 0.6s; } .ondas i:nth-child(3) { animation-delay: 1.2s; }
    @keyframes onda { from { transform: scale(1); opacity: 0.9; } to { transform: scale(3.2); opacity: 0; } }
    @media (max-width: 1000px) { .cuerpo, .rb { grid-template-columns: 1fr; } .lateral { position: static; } }`,
})
export class Decision {
  protected store = inject(SentinelStore);
  private router = inject(Router);
  readonly v = input<string>();
  protected checklist = CHECKLIST;
  protected num = num;
  protected f = (s: string) => fecha(s);
  protected marcas = signal(CHECKLIST.map(() => false));
  protected responsable = signal('');
  protected justificacion = signal('');
  protected confirmar = signal<'activar' | 'rechazar' | null>(null);
  protected celebrar = signal<string | null>(null);

  protected cand = computed(() => this.store.candidatas().find(c => c.id === this.v()) ?? this.store.candidatas()[0] ?? null);
  protected a = computed<Actualizacion | null>(() => { const c = this.cand(); return c ? this.store.comparaciones()[c.id] ?? null : null; });
  protected iniciales = computed(() => this.responsable().trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase() || '?');

  constructor() {
    // untracked: cargarComparacion lee y escribe el estado del store; sin esto el effect se dispara sin fin
    effect(() => { const c = this.cand(); if (c) untracked(() => this.store.cargarComparacion(c)); });
  }

  protected checks = computed(() => {
    const a = this.a(), c = this.cand();
    return [
      { nombre: 'Datos nuevos validados', ok: true, detalle: 'El lote superó el validador de Crow en modo entrenamiento (si no, no habría candidata).' },
      { nombre: 'Le gana a las líneas base', ok: a?.recomendacion.vence_lineas_base ?? false, detalle: 'Persistencia y promedio de 3 años, en validación temporal.' },
      { nombre: 'No empeora frente a la activa', ok: a?.recomendacion.no_empeora ?? false, detalle: 'MAE principal dentro de la tolerancia del 5 %.' },
      { nombre: 'Exportada a ONNX y registrada', ok: !!c, detalle: `${c?.ruta ?? ''} · estado candidato` },
      { nombre: 'Reporte de actualización generado', ok: !!c?.reporte_actualizacion, detalle: 'Comparación, métricas y EDA descargables.' },
    ];
  });
  protected beneficios = computed(() => {
    const a = this.a(); if (!a) return [];
    const p = a.comparacion.principal, out = [`Incorpora ${num(a.lote.nuevos)} registros reales de ${a.lote.anios_objetivo.join(', ')}: el modelo aprende de datos más recientes.`];
    if (p.candidata < p.activa) out.push(`MAE principal ${num(p.candidata, 2)} frente a ${num(p.activa, 2)}.`);
    if (a.recomendacion.vence_lineas_base) out.push('Sigue superando a las reglas simples (persistencia y promedio de 3 años).');
    return out;
  });
  protected riesgos = computed(() => {
    const a = this.a(); if (!a) return [];
    const mismos = a.comparacion.secundarias[0], out: string[] = [];
    if (mismos?.activa !== null && mismos?.candidata !== null && Math.abs(mismos.activa! - mismos.candidata!) < 0.05)
      out.push('En los mismos años que la activa el error es igual: la mejora viene del año nuevo, no de un modelo mejor.');
    if (!a.recomendacion.no_empeora) out.push('La métrica principal empeora más de lo tolerado.');
    out.push('Ningún modelo puede anticipar choques nacionales (cambios del examen, años atípicos).');
    out.push('Los colegios pequeños (< 10 estudiantes) siguen siendo poco predecibles.');
    return out;
  });

  protected puedeRechazar = computed(() => this.responsable().trim().length >= 3 && this.justificacion().trim().length >= 15);
  protected puedeActivar = computed(() => this.puedeRechazar() && this.marcas().every(Boolean));
  marcar(i: number) { this.marcas.update(m => m.map((x, j) => (j === i ? !x : x))); }

  async decidir(accion: 'activar' | 'rechazar') {
    const v = this.cand()!.id;
    try {
      await this.store.decidir(v, accion, this.justificacion().trim(), this.responsable().trim());
    } catch { this.confirmar.set(null); return; }
    this.confirmar.set(null);
    if (accion === 'activar') {
      this.celebrar.set(v);
      setTimeout(() => { this.celebrar.set(null); this.router.navigateByUrl('/historial'); }, 2600);
    } else {
      this.router.navigateByUrl('/historial');
    }
  }
}
