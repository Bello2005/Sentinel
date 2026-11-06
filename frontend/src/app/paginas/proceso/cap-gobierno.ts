// Capítulo 8: una persona decide. El ciclo de una versión nueva del modelo y cómo se protege el acceso.
import { Component, computed, signal } from '@angular/core';

import { TerminoEnlace } from '../glosario/termino';
import { Revelar } from '../landing/revelar';
import { Pasos } from './pasos';

const ETAPAS = [
  { titulo: 'Datos nuevos', icono: 'upload_file', texto: 'Llegan los resultados de un año nuevo, con su puntaje real. Con ellos el modelo podría aprender algo más.' },
  { titulo: 'Revisión', icono: 'verified_user', texto: 'El archivo pasa por las cinco revisiones. Si algo está mal, el proceso se detiene aquí.' },
  { titulo: 'Exploración', icono: 'travel_explore', texto: 'SENTINEL resume y grafica los datos nuevos para que una persona vea si hay algo raro.' },
  { titulo: 'Nace una candidata', icono: 'science', texto: 'Se entrena una versión nueva, la v2. Nace como <b>candidata</b>: existe, pero todavía no se usa para nada.' },
  { titulo: 'Comparación', icono: 'compare_arrows', texto: 'La v2 y la v1 se miden con la <b>misma prueba</b>, métrica por métrica: dónde mejora, dónde empeora y por cuánto.' },
  { titulo: 'Decisión', icono: 'gavel', texto: 'Una persona del equipo revisa todo y decide. Tiene que <b>escribir por qué</b>, y la decisión queda firmada con su nombre.' },
  { titulo: 'Historial', icono: 'history', texto: 'Si aprueba, la v2 pasa a ser la activa y la v1 queda guardada. Si rechaza, nada cambia. Todo queda registrado.' },
];

@Component({
  selector: 'sx-cap-gobierno',
  imports: [Revelar, Pasos, TerminoEnlace],
  host: { class: 'art-cuerpo' },
  template: `
    <div class="resumen"><b><span class="material-symbols-rounded" aria-hidden="true">bolt</span>En 30 segundos</b>
      <ul><li>El modelo puede aprender con datos nuevos, pero cada versión nueva nace “en espera”.</li>
          <li>Solo una persona puede aprobarla, escribiendo por qué y firmando con su nombre.</li>
          <li>La plataforma pide usuario y contraseña, y guarda las contraseñas de forma que ni el servidor las conoce.</li></ul></div>

    <p class="entrada">Este es el principio que guió todo el proyecto: <b>ninguna inteligencia artificial decide sola</b>. SENTINEL calcula, compara y
      recomienda, pero la última palabra la tiene una persona. A esto se le llama <sx-termino t="aprobacion-humana">gobierno del modelo</sx-termino>.</p>
    <p>¿Por qué tanto cuidado? Porque una predicción mala puede llevar a malas decisiones sobre colegios reales. Y porque un modelo nuevo puede parecer mejor
      en general y, sin embargo, empeorar justo en el Chocó. Eso solo lo nota alguien que mira con atención.</p>

    <h2>La vida de una versión</h2>
    <figure class="fig" sxRevelar aria-labelledby="fig-ciclo">
      <div class="fig-cab"><span class="material-symbols-rounded" aria-hidden="true">account_tree</span>
        <div><b id="fig-ciclo">De datos nuevos a versión activa</b><small>Siete pasos, y solo uno lo da una persona</small></div></div>
      <div class="ciclo">
        <ol class="etapas">
          @for (e of etapas; track e.titulo; let i = $index) {
            <li [class.on]="paso() === i" [class.hecho]="paso() > i" [class.humano]="i === 5">
              <span class="material-symbols-rounded" aria-hidden="true">{{ paso() > i ? 'check' : e.icono }}</span>{{ e.titulo }}</li>
          }
        </ol>
        <div class="versiones">
          <div class="version" [attr.data-e]="estadoV1()">
            <div class="v-cab"><b>v1</b><span class="insignia">{{ etiqueta(estadoV1()) }}</span></div>
            <small>Entrenada con 2015–2020</small>
          </div>
          <div class="version" [attr.data-e]="estadoV2()">
            <div class="v-cab"><b>v2</b><span class="insignia">{{ etiqueta(estadoV2()) }}</span></div>
            <small>Entrenada con 2015–2022</small>
          </div>
          <div class="firma" [class.on]="paso() >= 5">
            <span class="material-symbols-rounded" aria-hidden="true">draw</span>
            <div><b>Aprobada por una persona del equipo</b><small>“Incorpora 2022 y no empeora en el Chocó.”</small></div>
          </div>
        </div>
      </div>
      @for (x of [paso()]; track x) { <p class="explica" [innerHTML]="etapas[x].texto"></p> }
      <div class="fig-pie"><sx-pasos [total]="etapas.length" [etiquetas]="titulos" [(paso)]="paso" [intervalo]="3400" /></div>
    </figure>
    <p>Cada <sx-termino t="version-candidata">versión</sx-termino> queda guardada con todo: con qué datos se entrenó, cómo le fue en la prueba, quién decidió
      y por qué. Si algún día algo sale mal, se puede saber exactamente qué modelo estaba en uso y volver atrás.</p>

    <h2>Quién puede entrar</h2>
    <p>Los resultados del estudio son públicos. La plataforma, no: solo entra el equipo autorizado, con usuario y contraseña. Algunos cuidados que tomamos:</p>
    <div class="tarjetas" sxRevelar>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">fingerprint</span><b>Contraseñas irreconocibles</b>
        <p>No se guardan tal cual: se guarda una “huella” que se calcula 210.000 veces seguidas. Ni quien maneja el servidor puede saber la contraseña.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">timer</span><b>Sesiones que vencen</b>
        <p>Al entrar se abre una sesión de 8 horas. Después hay que volver a iniciar sesión.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">block</span><b>Freno a los intentos</b>
        <p>Tras 5 contraseñas equivocadas en 15 minutos, el acceso se bloquea un rato desde ese lugar.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">signature</span><b>Firma verdadera</b>
        <p>El nombre de quien aprueba sale de su sesión, no de lo que escriba: nadie puede firmar por otro.</p></div>
    </div>

    <blockquote class="cita">La IA calcula y recomienda. Una persona entiende, decide y responde por esa decisión.</blockquote>

    <div class="clave"><span class="material-symbols-rounded" aria-hidden="true">push_pin</span>
      <div><b>Para recordar</b><p>Un modelo nuevo no entra en uso por ser nuevo. Entra solo si demuestra que es mejor y una persona lo aprueba con su nombre.</p></div></div>`,
  styles: `
    .ciclo { display: grid; grid-template-columns: 210px 1fr; gap: 20px; align-items: start; }
    .etapas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .etapas li { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 12px; font-size: 14px; color: var(--sx-muted); border: 1px solid transparent;
      transition: all var(--sx-med) var(--sx-ease); }
    .etapas li span { font-size: 19px; }
    .etapas li.hecho span { color: var(--sx-success); }
    .etapas li.on { color: var(--sx-text); border-color: var(--sx-accent); background: color-mix(in srgb, var(--sx-accent) 9%, transparent); transform: translateX(4px); }
    .etapas li.on span { color: var(--sx-accent); }
    .etapas li.humano.on { border-color: var(--sx-warning); background: color-mix(in srgb, var(--sx-warning) 10%, transparent); }
    .etapas li.humano.on span { color: var(--sx-warning); }
    .versiones { display: flex; flex-direction: column; gap: 12px; }
    .version { padding: 16px 18px; border-radius: 16px; border: 1px solid var(--sx-border-strong); background: var(--sx-bg); transition: all 500ms var(--sx-ease); }
    .v-cab { display: flex; align-items: center; justify-content: space-between; }
    .v-cab b { font: 700 22px var(--sx-mono); }
    .version small { color: var(--sx-muted); font-size: 13px; }
    .insignia { padding: 4px 10px; border-radius: 99px; font-size: 12px; font-weight: 650; transition: all 500ms; }
    .version[data-e='nada'] { opacity: 0.3; border-style: dashed; transform: scale(0.97); }
    .version[data-e='nada'] .insignia { background: var(--sx-border); color: var(--sx-muted); }
    .version[data-e='activa'] { border-color: color-mix(in srgb, var(--sx-success) 50%, transparent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--sx-success) 25%, transparent); }
    .version[data-e='activa'] .insignia { background: color-mix(in srgb, var(--sx-success) 16%, transparent); color: var(--sx-success); }
    .version[data-e='candidata'] { border-color: color-mix(in srgb, var(--sx-candidate) 50%, transparent); animation: nace 600ms var(--sx-ease); }
    .version[data-e='candidata'] .insignia { background: color-mix(in srgb, var(--sx-candidate) 16%, transparent); color: var(--sx-candidate); }
    .version[data-e='historica'] { opacity: 0.6; } .version[data-e='historica'] .insignia { background: var(--sx-border); color: var(--sx-muted); }
    @keyframes nace { from { transform: scale(0.94); opacity: 0.4; } }
    .firma { display: flex; gap: 12px; align-items: center; padding: 14px 16px; border-radius: 16px; border: 1px dashed var(--sx-border-strong); opacity: 0.3; transition: all 500ms var(--sx-ease); }
    .firma > span { font-size: 24px; color: var(--sx-faint); }
    .firma b { display: block; font-size: 14px; } .firma small { color: var(--sx-muted); font-size: 13px; font-style: italic; }
    .firma.on { opacity: 1; border-style: solid; border-color: color-mix(in srgb, var(--sx-warning) 50%, transparent); background: color-mix(in srgb, var(--sx-warning) 7%, transparent); }
    .firma.on > span { color: var(--sx-warning); }
    @media (max-width: 680px) { .ciclo { grid-template-columns: 1fr; } .etapas { flex-direction: row; overflow-x: auto; } .etapas li { flex: none; } .etapas li.on { transform: none; } }
    @media (prefers-reduced-motion: reduce) { .version[data-e='candidata'] { animation: none; } }`,
})
export class CapGobierno {
  protected etapas = ETAPAS;
  protected titulos = ETAPAS.map(e => e.titulo);
  protected paso = signal(0);
  protected estadoV1 = computed(() => (this.paso() >= 6 ? 'historica' : 'activa'));
  protected estadoV2 = computed(() => (this.paso() >= 6 ? 'activa' : this.paso() >= 3 ? 'candidata' : 'nada'));
  etiqueta(e: string) { return { activa: 'Activa', candidata: 'Candidata', historica: 'Guardada', nada: 'Aún no existe' }[e] ?? e; }
}
