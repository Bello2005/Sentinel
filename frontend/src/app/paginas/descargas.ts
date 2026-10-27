// DESCARGAS: la ficha del modelo activo y sus archivos (ONNX, metadatos, ejemplo de entrada y LEEME).
// Es la única página de las cuentas con rol "descarga"; el resto del equipo también la ve.
import { Component, computed, inject, signal } from '@angular/core';

import { Cuentas, FichaDescarga } from '../core/cuentas';
import { fecha, num } from '../core/formato';
import { NOMBRE_ROL, Sesion } from '../core/sesion';

const ICONOS: Record<string, string> = { 'modelo.onnx': 'deployed_code', 'metadata.json': 'data_object', 'ejemplo_entrada.csv': 'table', 'LEEME.txt': 'description' };

@Component({
  selector: 'sx-descargas',
  template: `
    <div class="sx-page">
      <header class="sx-page-head">
        <div>
          <div class="sx-eyebrow">Modelo · {{ rolTexto() }}</div>
          <h1>Descargar el modelo</h1>
          <p>El modelo en uso, listo para ejecutarlo con ONNX Runtime en Python, C++, C#, Java o JavaScript, con su ficha técnica y un
             archivo de ejemplo. Si publica resultados, cite la fuente de los datos: ICFES, Saber 11 (CC BY-SA 4.0).</p>
        </div>
      </header>

      @if (error()) {
        <div class="sx-card aviso" role="alert"><span class="material-symbols-rounded" aria-hidden="true">cloud_off</span>{{ error() }}</div>
      } @else if (ficha(); as f) {
        <section class="resumen">
          <div class="sx-card dato"><span class="material-symbols-rounded" aria-hidden="true">verified</span><b>{{ f.version }}</b><small>versión activa</small></div>
          <div class="sx-card dato"><span class="material-symbols-rounded" aria-hidden="true">target</span><b>{{ n(f.validacion.mae_choco, 2) }} pts</b><small>error medio en el Chocó</small></div>
          <div class="sx-card dato"><span class="material-symbols-rounded" aria-hidden="true">dataset</span><b>{{ n(f.registros) }}</b><small>ejemplos de entrenamiento</small></div>
          <div class="sx-card dato"><span class="material-symbols-rounded" aria-hidden="true">event</span><b>{{ fecha(f.fecha_entrenamiento, false) }}</b><small>fecha de entrenamiento</small></div>
        </section>

        <section class="sx-card">
          <h2>Archivos</h2>
          <ul class="archivos">
            @for (a of f.archivos; track a.nombre) {
              <li>
                <span class="ico material-symbols-rounded" aria-hidden="true">{{ icono(a.nombre) }}</span>
                <div><b>{{ a.nombre }}</b><small>{{ a.descripcion }} · {{ tamano(a.bytes) }}</small></div>
                <a class="sx-btn" [href]="'/api/descargas/' + a.nombre" [attr.download]="'sentinel_' + f.version + '_' + a.nombre"
                   [attr.aria-label]="'Descargar ' + a.nombre"><span class="material-symbols-rounded" aria-hidden="true">download</span>Descargar</a>
              </li>
            }
          </ul>
        </section>

        <section class="dos">
          <div class="sx-card">
            <h2>Qué recibe y qué entrega</h2>
            <p class="sx-muted">Cuatro números por municipio o colegio (float32, forma [n, 1]), con estos nombres:</p>
            <ul class="vars">@for (v of f.variables; track v) { <li><code>{{ v }}</code><span>{{ explicar(v) }}</span></li> }</ul>
            <p class="sx-muted">Devuelve <code>variable</code>: el puntaje global promedio predicho para el año siguiente (0 a 500).</p>
          </div>
          <div class="sx-card">
            <h2>Úselo en Python</h2>
            <pre><code>{{ ejemplo }}</code></pre>
            <button class="sx-btn" (click)="copiar()"><span class="material-symbols-rounded" aria-hidden="true">{{ copiado() ? 'check' : 'content_copy' }}</span>{{ copiado() ? 'Copiado' : 'Copiar código' }}</button>
          </div>
        </section>
      } @else {
        <div class="sx-card sx-skeleton cargando"></div>
      }
    </div>`,
  styles: `
    .resumen { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
    .dato { display: flex; flex-direction: column; gap: 4px; } .dato span { color: var(--sx-accent); font-size: 22px; }
    .dato b { font-size: 22px; letter-spacing: -0.02em; } .dato small { color: var(--sx-muted); font-size: 12.5px; }
    h2 { font-size: 16px; margin: 0 0 12px; }
    .archivos { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .archivos li { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-top: 1px solid var(--sx-border); }
    .archivos li:first-child { border-top: 0; }
    .ico { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; color: var(--sx-accent); background: color-mix(in srgb, var(--sx-accent) 10%, transparent); }
    .archivos div { flex: 1; min-width: 0; } .archivos b { display: block; font-family: var(--sx-mono); font-size: 14px; }
    .archivos small { color: var(--sx-muted); font-size: 12.5px; }
    .dos { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .vars { list-style: none; padding: 0; margin: 0 0 12px; display: flex; flex-direction: column; gap: 8px; }
    .vars li { display: flex; flex-direction: column; } .vars span { font-size: 13px; color: var(--sx-muted); }
    code { font-family: var(--sx-mono); font-size: 13px; color: var(--sx-accent); }
    pre { margin: 0 0 12px; padding: 14px; border-radius: 12px; background: var(--sx-bg); border: 1px solid var(--sx-border); overflow-x: auto; }
    pre code { color: var(--sx-text); white-space: pre; }
    .aviso { display: flex; gap: 10px; color: var(--sx-danger); } .cargando { height: 240px; }
    @media (max-width: 1000px) { .resumen { grid-template-columns: 1fr 1fr; } .dos { grid-template-columns: 1fr; } }
    @media (max-width: 560px) { .archivos li { flex-wrap: wrap; } .archivos .sx-btn { width: 100%; justify-content: center; } }`,
})
export class Descargas {
  private cuentas = inject(Cuentas);
  private sesion = inject(Sesion);
  protected ficha = signal<FichaDescarga | null>(null);
  protected error = signal<string | null>(null);
  protected copiado = signal(false);
  protected n = num;
  protected fecha = fecha;
  protected rolTexto = computed(() => { const r = this.sesion.rol(); return r ? NOMBRE_ROL[r] : ''; });
  protected ejemplo = `import onnxruntime as ort
import numpy as np

sesion = ort.InferenceSession("modelo.onnx")
# Un municipio: últimos puntajes y promedios (puntos, 0-500)
datos = {"puntaje_ultimo": 212, "puntaje_anterior": 196,
         "promedio_3": 200, "puntaje_grupo": 205}
entrada = {k: np.array([[v]], dtype=np.float32) for k, v in datos.items()}
print(sesion.run(None, entrada)[0])  # ≈ 203,7`;

  constructor() {
    this.cuentas.ficha().then(f => this.ficha.set(f)).catch(e => this.error.set((e as Error).message));
  }

  icono(nombre: string) { return ICONOS[nombre] ?? 'draft'; }
  tamano(b: number) { return b < 1024 ? `${b} B` : b < 1048576 ? `${num(b / 1024, 1)} KB` : `${num(b / 1048576, 1)} MB`; }
  explicar(v: string) {
    return ({ puntaje_ultimo: 'Puntaje del último año con datos', puntaje_anterior: 'Puntaje del año anterior a ese',
              promedio_3: 'Promedio de los últimos 3 años con datos', puntaje_grupo: 'Promedio de su municipio (colegios) o departamento (municipios)' } as Record<string, string>)[v] ?? '';
  }
  async copiar() {
    try { await navigator.clipboard.writeText(this.ejemplo); this.copiado.set(true); setTimeout(() => this.copiado.set(false), 2000); } catch { /* sin portapapeles */ }
  }
}
