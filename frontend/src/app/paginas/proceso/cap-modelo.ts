// Capítulo 6: enseñarle a predecir. Qué se predice, cómo se probó con el pasado, qué modelos compitieron y una
// calculadora con la fórmula real del modelo v1 (coeficientes de shared/models/v1/metadata.json).
import { Component, computed, signal } from '@angular/core';

import { num } from '../../core/formato';
import { TerminoEnlace } from '../glosario/termino';
import { Revelar } from '../landing/revelar';
import { Pasos } from './pasos';

const ANIOS = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022];
const FALTAN = new Set([2018, 2021]);
// Error medio en el Chocó por año evaluado (docs/justificacion_modelo.md, datos hasta 2022)
const VALIDACION = [
  { anio: 2016, ultimo: 9.98, prom3: 8.74, modelo: 8.74 },
  { anio: 2017, ultimo: 9.14, prom3: 7.64, modelo: 7.70 },
  { anio: 2019, ultimo: 14.25, prom3: 15.38, modelo: 15.18 },
  { anio: 2020, ultimo: 10.86, prom3: 7.54, modelo: 7.38 },
  { anio: 2022, ultimo: 8.56, prom3: 8.57, modelo: 8.34 },
];
const COMPETENCIA = [
  { nombre: 'Muchas variables (puntajes, tamaño, hogar)', mae: 10.81 },
  { nombre: 'Regla: repetir el último año', mae: 10.56, regla: true },
  { nombre: 'Receta anclada, con intercepto', mae: 10.51 },
  { nombre: 'Receta anclada + datos del hogar', mae: 10.31 },
  { nombre: 'Regla: promedio de 3 años', mae: 9.58, regla: true },
  { nombre: 'SENTINEL: receta anclada, sin intercepto', mae: 9.47, gana: true },
];
const PESOS = { ultimo: 0.2528, anterior: -0.1173, prom3: 0.8302, grupo: 0.0343 };
const INTERVALO_MUNICIPIO = 16.8;  // municipio con 30 o más estudiantes, intervalo de 80 %

@Component({
  selector: 'sx-cap-modelo',
  imports: [Revelar, Pasos, TerminoEnlace],
  host: { class: 'art-cuerpo' },
  template: `
    <div class="resumen"><b><span class="material-symbols-rounded" aria-hidden="true">bolt</span>En 30 segundos</b>
      <ul><li>El modelo calcula el puntaje del año siguiente de cada municipio y colegio, con un rango “entre tanto y tanto”.</li>
          <li>Lo probamos haciéndolo predecir años que ya pasaron, sin dejarlo ver las respuestas.</li>
          <li>Seis modelos compitieron. Ganó la receta más sencilla y fácil de explicar: se equivoca en promedio 9,5 puntos.</li></ul></div>

    <p class="entrada">Entender el pasado es la mitad del trabajo. La otra mitad es mirar hacia adelante: ¿cuánto sacará cada municipio y cada colegio
      el año que viene? Para eso entrenamos un <sx-termino t="modelo">modelo</sx-termino> de <sx-termino t="ia">inteligencia artificial</sx-termino>.</p>

    <h2>Qué aprende y de qué</h2>
    <p>La idea es parecida a la de una abuela que sabe cuánto arroz preparar porque lleva años viendo cuántos llegan a almorzar. El modelo mira la
      historia de cada municipio y colegio y aprende qué tanto se parece el año siguiente a los anteriores. Para cada uno recibe cuatro ingredientes:</p>
    <div class="tarjetas" sxRevelar>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">event</span><b>El último año</b><p>El puntaje del último año con datos.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">history</span><b>El año anterior</b><p>El puntaje del año antes de ese.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">functions</span><b>El promedio de 3 años</b><p>Para no dejarse llevar por un año raro.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">groups</span><b>El grupo</b><p>El promedio de su municipio o departamento.</p></div>
    </div>
    <p>Aprendió de <b>53.604 ejemplos</b> (48.057 de colegios y 5.547 de municipios de todo el país) de los años 2015 a 2020. Cada ejemplo dice: “con esta
      historia, el año siguiente sacó tanto”. A eso se le llama <sx-termino t="entrenar">entrenar</sx-termino>.</p>

    <h2>La prueba con el pasado</h2>
    <p>¿Cómo saber si un modelo sirve antes de usarlo? Poniéndolo a predecir años que <b>ya pasaron</b>, sin dejarlo ver las respuestas. Por ejemplo:
      para predecir 2019 solo puede aprender de los años anteriores; después se compara con lo que de verdad pasó en 2019. Es como estudiar con exámenes
      viejos tapando las respuestas. Se llama <sx-termino t="validacion-temporal">validación temporal</sx-termino>.</p>
    <figure class="fig" sxRevelar aria-labelledby="fig-validacion">
      <div class="fig-cab"><span class="material-symbols-rounded" aria-hidden="true">history</span>
        <div><b id="fig-validacion">Predecir el pasado, año por año</b><small>Error medio en el Chocó, en puntos · menos es mejor</small></div></div>
      <div class="linea-anios">
        @for (a of anios; track a) {
          <div class="anio" [attr.data-e]="estado(a)">
            <span class="cuadro">@if (estado(a) === 'meta') { <span class="material-symbols-rounded" aria-hidden="true">target</span> }
              @else if (estado(a) === 'aprende') { <span class="material-symbols-rounded" aria-hidden="true">school</span> }
              @else if (estado(a) === 'falta') { <span class="material-symbols-rounded" aria-hidden="true">block</span> }</span>
            <small>{{ a }}</small>
          </div>
        }
      </div>
      <div class="leyenda"><span><i class="aprende"></i>Aprende de estos años</span><span><i class="meta"></i>Año que debe predecir</span>
        <span><i class="futuro"></i>No los puede ver</span><span><i class="falta"></i>Sin datos completos</span></div>
      <div class="errores">
        @for (f of filaErrores(); track f.nombre) {
          <div class="err" [class.gana]="f.gana">
            <span>{{ f.nombre }}</span>
            <span class="pista"><span [style.width.%]="(f.mae / 16) * 100"></span></span>
            <b>{{ n(f.mae, 2) }}</b>
          </div>
        }
      </div>
      <p class="explica">{{ textoValidacion() }}</p>
      <div class="fig-pie"><sx-pasos [total]="validacion.length" [etiquetas]="etiquetasValidacion" [(paso)]="pasoV" [intervalo]="3600" /></div>
    </figure>
    <p>Fíjese en 2019: <b>todos</b> se equivocan mucho. Ese año el país entero cambió, y ningún modelo que mire solo la historia podía saberlo.
      Es un recordatorio de humildad: el futuro siempre puede sorprender.</p>

    <h2>Seis modelos compitieron</h2>
    <p>Antes de elegir, probamos varias recetas, de las más sencillas a las más complicadas, siempre con la misma prueba. Dos de ellas no son
      inteligencia artificial sino <sx-termino t="reglas-simples">reglas simples</sx-termino> que cualquiera haría a mano: si un modelo no les gana, no sirve.</p>
    <figure class="fig competencia" sxRevelar aria-labelledby="fig-competencia">
      <div class="fig-cab"><span class="material-symbols-rounded" aria-hidden="true">emoji_events</span>
        <div><b id="fig-competencia">¿Quién se equivoca menos?</b><small><sx-termino t="error-medio">Error medio</sx-termino> en el Chocó, promedio de los años probados</small></div></div>
      <div class="podio">
        @for (c of competencia; track c.nombre; let i = $index) {
          <div class="comp sx-r-hijo" [class.regla]="c.regla" [class.gana]="c.gana">
            <span class="nom">@if (c.gana) { <span class="material-symbols-rounded" aria-hidden="true">emoji_events</span> }{{ c.nombre }}</span>
            <span class="pista"><span [style.--w]="((c.mae - 8) / 3.2) * 100 + '%'"></span></span>
            <b>{{ n(c.mae, 2) }}</b>
          </div>
        }
      </div>
      <figcaption>Las barras empiezan en 8 puntos para que se vean las diferencias. También probamos árboles de decisión (gradient boosting):
        se equivocaron más de 12 puntos, peor que las reglas simples.</figcaption>
    </figure>
    <p>Ganó la receta más sencilla. Parte del promedio de 3 años y lo corrige un poco según cómo le fue los dos últimos años. Agregar datos del hogar
      (internet, estudios de la mamá) <b>no ayudó</b>: explican por qué un colegio está donde está, pero eso ya está dentro de su historia de puntajes.</p>

    <h3>Lo que probamos y no funcionó</h3>
    <p>Intentamos enseñarle cuánto subió o bajó todo el país el último año. Empeoró: el error pasó de 11,5 a 12,7 puntos. Con solo cinco cambios
      nacionales para aprender (−0,2, +8,3, −3,0, −9,0 y +2,1 puntos) el modelo concluía “si el país subió, seguirá subiendo”, y eso es falso.
      Por la misma razón el modelo no tiene <b>intercepto</b>, un número fijo que se suma siempre: así no puede inventar subidas o bajadas para todos.</p>

    <h2>Pruebe la receta</h2>
    <p>Esta es la fórmula real del modelo. Mueva los ingredientes y vea cómo cambia la predicción para un municipio imaginario:</p>
    <figure class="fig" sxRevelar aria-labelledby="fig-receta">
      <div class="fig-cab"><span class="material-symbols-rounded" aria-hidden="true">calculate</span>
        <div><b id="fig-receta">La calculadora de SENTINEL</b><small>Los pesos son los del modelo en uso (versión v1)</small></div></div>
      <div class="calc">
        <div class="deslizadores">
          @for (d of deslizadores; track d.id) {
            <label>
              <span class="fila-d"><span>{{ d.nombre }}</span><b>{{ valores()[d.id] }}</b></span>
              <input type="range" min="150" max="300" step="1" [value]="valores()[d.id]" (input)="mover(d.id, $any($event.target).valueAsNumber)"
                     [attr.aria-label]="d.nombre" />
              <small>{{ d.peso < 0 ? 'resta' : 'pesa' }} {{ n(abs(d.peso) * 100, 0) }} %{{ d.peso < 0 ? ': corrige los saltos de un año a otro' : '' }}</small>
            </label>
          }
        </div>
        <div class="resultado-calc">
          <small>El año siguiente sacaría</small>
          <b>{{ n(prediccion(), 1) }}</b>
          <span class="rango">entre <b>{{ n(prediccion() - intervalo, 0) }}</b> y <b>{{ n(prediccion() + intervalo, 0) }}</b> puntos</span>
          <div class="regla-rango" aria-hidden="true">
            <span class="banda" [style.left.%]="pos(prediccion() - intervalo)" [style.width.%]="pos(prediccion() + intervalo) - pos(prediccion() - intervalo)"></span>
            <span class="marca" [style.left.%]="pos(prediccion())"></span>
          </div>
          <p>El rango acierta 8 de cada 10 veces: es el <sx-termino t="intervalo">intervalo</sx-termino>, como el pronóstico del clima.</p>
        </div>
      </div>
      <figcaption>Los cuatro pesos suman 1. Por eso, si los cuatro ingredientes valen lo mismo, la predicción es ese mismo valor: la receta no inventa subidas ni bajadas.</figcaption>
    </figure>

    <h2>Siendo honestos</h2>
    <p>El modelo le gana al promedio de 3 años por poco: 9,47 frente a 9,58 puntos, alrededor de 1 %. ¿Vale la pena? Creemos que sí, por tres razones:
      se puede explicar en una frase, se puede vigilar (cada versión se compara con las reglas simples) y es estable. Un modelo más complicado que
      nadie entiende, y que encima se equivoca más, sería peor.</p>

    <div class="clave"><span class="material-symbols-rounded" aria-hidden="true">push_pin</span>
      <div><b>Para recordar</b><p>Un buen modelo no es el más complicado: es el que se equivoca menos en una prueba justa y que se puede explicar a cualquiera.</p></div></div>`,
  styles: `
    .linea-anios { display: grid; grid-template-columns: repeat(9, 1fr); gap: 6px; }
    .anio { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .cuadro { width: 100%; height: 44px; border-radius: 10px; display: grid; place-items: center; border: 1px solid var(--sx-border); background: var(--sx-bg);
      transition: background var(--sx-med), border-color var(--sx-med), transform var(--sx-med) var(--sx-ease); }
    .cuadro span { font-size: 19px; }
    .anio small { font: 600 11.5px var(--sx-mono); color: var(--sx-muted); }
    .anio[data-e='aprende'] .cuadro { background: color-mix(in srgb, var(--sx-accent) 22%, transparent); border-color: color-mix(in srgb, var(--sx-accent) 50%, transparent); color: var(--sx-accent); }
    .anio[data-e='meta'] .cuadro { background: var(--sx-warning); border-color: transparent; color: #1b1203; transform: translateY(-4px); box-shadow: 0 8px 22px color-mix(in srgb, var(--sx-warning) 40%, transparent); }
    .anio[data-e='meta'] small { color: var(--sx-warning); }
    .anio[data-e='futuro'] .cuadro { opacity: 0.45; }
    .anio[data-e='falta'] .cuadro { border-style: dashed; color: var(--sx-faint);
      background: repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--sx-text) 6%, transparent) 6px 8px); }
    .leyenda { display: flex; flex-wrap: wrap; gap: 14px; margin: 12px 0 16px; font-size: 12.5px; color: var(--sx-muted); }
    .leyenda span { display: inline-flex; align-items: center; gap: 6px; }
    .leyenda i { width: 12px; height: 12px; border-radius: 4px; }
    .leyenda .aprende { background: color-mix(in srgb, var(--sx-accent) 40%, transparent); } .leyenda .meta { background: var(--sx-warning); }
    .leyenda .futuro { background: var(--sx-border-strong); } .leyenda .falta { border: 1px dashed var(--sx-faint); }
    .errores { display: flex; flex-direction: column; gap: 8px; }
    .err, .comp { display: grid; grid-template-columns: minmax(150px, 1.2fr) 2fr 52px; gap: 12px; align-items: center; font-size: 14px; color: var(--sx-muted); }
    .err b, .comp b { font: 700 14.5px var(--sx-mono); text-align: right; color: var(--sx-text); }
    .pista { height: 12px; border-radius: 99px; background: color-mix(in srgb, var(--sx-text) 5%, transparent); overflow: hidden; }
    .err .pista span { display: block; height: 100%; border-radius: 99px; background: var(--sx-faint); transition: width 800ms var(--sx-ease); }
    .err.gana { color: var(--sx-text); font-weight: 600; } .err.gana .pista span { background: var(--sx-accent); }
    .podio { display: flex; flex-direction: column; gap: 10px; }
    .comp .nom { display: flex; align-items: center; gap: 6px; }
    .comp .pista span { display: block; height: 100%; border-radius: 99px; width: 0; background: var(--sx-candidate); transition: width 1s var(--sx-ease); transition-delay: calc(var(--sx-r-i, 0) * 90ms + 200ms); }
    .competencia.sx-visible .comp .pista span { width: var(--w); }
    .comp.regla .pista span { background: var(--sx-faint); }
    .comp.gana { color: var(--sx-text); font-weight: 650; } .comp.gana .nom span { color: var(--sx-warning); font-size: 19px; }
    .comp.gana .pista span { background: linear-gradient(90deg, var(--sx-accent), var(--sx-active)); box-shadow: 0 0 14px color-mix(in srgb, var(--sx-accent) 45%, transparent); }
    .calc { display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; align-items: center; }
    .deslizadores { display: flex; flex-direction: column; gap: 16px; }
    .deslizadores label { display: flex; flex-direction: column; gap: 6px; }
    .fila-d { display: flex; justify-content: space-between; font-size: 14.5px; } .fila-d b { font-family: var(--sx-mono); }
    .deslizadores small { font-size: 12px; color: var(--sx-faint); }
    input[type='range'] { width: 100%; accent-color: var(--sx-accent); cursor: pointer; }
    .resultado-calc { display: flex; flex-direction: column; gap: 6px; padding: 22px; border-radius: 18px; text-align: center;
      background: linear-gradient(150deg, color-mix(in srgb, var(--sx-accent) 12%, var(--sx-bg)), color-mix(in srgb, var(--sx-candidate) 10%, var(--sx-bg)));
      border: 1px solid color-mix(in srgb, var(--sx-accent) 30%, transparent); }
    .resultado-calc > small { color: var(--sx-muted); font-size: 13px; }
    .resultado-calc > b { font: 750 52px var(--sx-font); letter-spacing: -0.04em; line-height: 1; }
    .rango { font-size: 14.5px; color: var(--sx-muted); } .rango b { color: var(--sx-text); }
    .regla-rango { position: relative; height: 10px; margin: 10px 4px 4px; border-radius: 99px; background: color-mix(in srgb, var(--sx-text) 7%, transparent); }
    .banda { position: absolute; top: 0; bottom: 0; border-radius: 99px; background: color-mix(in srgb, var(--sx-accent) 40%, transparent); transition: left 200ms, width 200ms; }
    .marca { position: absolute; top: -4px; width: 4px; height: 18px; margin-left: -2px; border-radius: 2px; background: var(--sx-accent); transition: left 200ms; }
    .resultado-calc p { margin: 8px 0 0; font-size: 13.5px; line-height: 1.5; color: var(--sx-muted); }
    @media (max-width: 680px) {
      .calc { grid-template-columns: 1fr; }
      .err, .comp { grid-template-columns: 1fr 52px; } .err .pista, .comp .pista { grid-column: 1 / -1; grid-row: 2; }
      .linea-anios { gap: 3px; } .cuadro { height: 36px; } .cuadro span { font-size: 16px; } .anio small { font-size: 9.5px; }
    }
    @media (prefers-reduced-motion: reduce) { .comp .pista span, .err .pista span { transition: none; } }`,
})
export class CapModelo {
  protected n = num;
  protected abs = Math.abs;
  protected anios = ANIOS;
  protected validacion = VALIDACION;
  protected etiquetasValidacion = VALIDACION.map(v => `predecir ${v.anio}`);
  protected competencia = COMPETENCIA;
  protected pasoV = signal(0);
  protected intervalo = INTERVALO_MUNICIPIO;

  private meta = computed(() => VALIDACION[this.pasoV()]);
  estado(a: number) {
    const t = this.meta().anio;
    if (FALTAN.has(a)) return 'falta';
    return a === t ? 'meta' : a < t ? 'aprende' : 'futuro';
  }
  protected filaErrores = computed(() => {
    const v = this.meta();
    return [{ nombre: 'Repetir el último año', mae: v.ultimo }, { nombre: 'Promedio de 3 años', mae: v.prom3 }, { nombre: 'SENTINEL', mae: v.modelo, gana: true }];
  });
  protected textoValidacion = computed(() => {
    const v = this.meta();
    const mejor = Math.min(v.ultimo, v.prom3, v.modelo);
    const gana = v.modelo === mejor ? 'SENTINEL se equivoca menos.' : v.modelo - mejor < 0.1 ? 'SENTINEL queda prácticamente empatado con la mejor regla.' : 'Una regla simple gana este año, por poco.';
    return `Para predecir ${v.anio}, el modelo solo aprende de los años anteriores. ${gana}`;
  });

  protected deslizadores = [
    { id: 'prom3' as const, nombre: 'Promedio de los últimos 3 años', peso: PESOS.prom3 },
    { id: 'ultimo' as const, nombre: 'Puntaje del último año', peso: PESOS.ultimo },
    { id: 'anterior' as const, nombre: 'Puntaje del año anterior', peso: PESOS.anterior },
    { id: 'grupo' as const, nombre: 'Promedio de su departamento', peso: PESOS.grupo },
  ];
  protected valores = signal<Record<'prom3' | 'ultimo' | 'anterior' | 'grupo', number>>({ prom3: 200, ultimo: 212, anterior: 196, grupo: 205 });
  protected prediccion = computed(() => {
    const v = this.valores();
    return PESOS.prom3 * v.prom3 + PESOS.ultimo * v.ultimo + PESOS.anterior * v.anterior + PESOS.grupo * v.grupo;
  });
  mover(id: 'prom3' | 'ultimo' | 'anterior' | 'grupo', valor: number) { this.valores.update(v => ({ ...v, [id]: valor })); }
  /** Posición en la regla de 130 a 320 puntos */
  pos(x: number) { return Math.min(100, Math.max(0, ((x - 130) / 190) * 100)); }
}
