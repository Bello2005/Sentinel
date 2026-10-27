// Capítulo 2: conseguir los datos. Del portal público al archivo comprimido, los años incompletos y las fuentes extra.
import { Component, signal } from '@angular/core';

import { num } from '../../core/formato';
import { TerminoEnlace } from '../glosario/termino';
import { Revelar } from '../landing/revelar';
import { Pasos } from './pasos';

// Estudiantes por año en saber11_limpio.parquet (conteo con DuckDB)
const POR_ANIO: [number, number][] = [[2010, 570944], [2011, 572417], [2012, 580551], [2013, 576094], [2014, 569428], [2015, 568397], [2016, 561270],
  [2017, 559279], [2018, 19798], [2019, 558751], [2020, 520307], [2021, 15528], [2022, 552841]];

const ETAPAS = [
  { titulo: 'El portal', texto: 'El ICFES publica los resultados en <b>datos.gov.co</b>: 7.109.704 filas (una por examen) y 55 columnas. Todo viene guardado como texto, incluso los puntajes.' },
  { titulo: 'El archivo CSV', texto: 'Se descarga como un archivo de texto plano (CSV) de unos <b>4 GB</b>: más de lo que cabe en la memoria de muchos computadores.' },
  { titulo: 'Comprimir', texto: 'Lo convertimos a <b>Parquet</b>, un formato que guarda los datos por columnas y comprimidos, como empacar ropa al vacío: queda en <b>425 MB</b>.' },
  { titulo: 'Listo para usar', texto: 'Después de limpiar (capítulo 3) queda en <b>120 MB</b>: 33 veces más liviano que el original y con todo lo necesario.' },
];

@Component({
  selector: 'sx-cap-datos',
  imports: [Revelar, Pasos, TerminoEnlace],
  host: { class: 'art-cuerpo' },
  template: `
    <div class="resumen"><b><span class="material-symbols-rounded" aria-hidden="true">bolt</span>En 30 segundos</b>
      <ul><li>Descargamos más de 7 millones de resultados del examen desde un portal público del Estado.</li>
          <li>Los comprimimos 33 veces para poder trabajar en un computador normal.</li>
          <li>Descubrimos que faltan casi todos los datos de 2018 y 2021, y los sumamos a otras fuentes: pobreza, cobertura e internet.</li></ul></div>

    <p class="entrada">Todo empezó en <b>datos.gov.co</b>, el portal donde el Estado colombiano publica información para que cualquiera la use. Allí el
      <sx-termino t="icfes">ICFES</sx-termino> deja los resultados del Saber 11 de todos los estudiantes desde 2010, sin nombres.</p>
    <p>Cada fila es un examen: en qué colegio y municipio se presentó, algunas preguntas sobre el hogar (el <sx-termino t="estrato">estrato</sx-termino>,
      los estudios de los papás, si hay internet en casa) y los puntajes de cada materia.</p>

    <figure class="fig" sxRevelar aria-labelledby="fig-descarga">
      <div class="fig-cab"><span class="material-symbols-rounded" aria-hidden="true">cloud_download</span>
        <div><b id="fig-descarga">Del portal a nuestro computador</b><small>Cuatro pasos para tener 7 millones de filas en un archivo liviano</small></div></div>
      <div class="tamanos">
        <div class="portal" [class.on]="paso() >= 0">
          <span class="material-symbols-rounded" aria-hidden="true">public</span>
          <div><b>7.109.704</b><small>filas</small></div><div><b>55</b><small>columnas</small></div><div><b>Texto</b><small>todo</small></div>
        </div>
        @for (b of barras; track b.nombre; let i = $index) {
          <div class="fila" [class.on]="paso() > i">
            <span class="nombre">{{ b.nombre }}</span>
            <span class="pista"><span class="relleno" [style.width.%]="paso() > i ? b.pct : 0" [style.background]="b.color"></span></span>
            <b>{{ b.tam }}</b>
          </div>
        }
      </div>
      @for (x of [paso()]; track x) { <p class="explica" [innerHTML]="etapas[x].texto"></p> }
      <div class="fig-pie"><sx-pasos [total]="etapas.length" [etiquetas]="titulos" [(paso)]="paso" /></div>
    </figure>

    <h2>El primer susto: faltan años</h2>
    <p>Al contar cuántos estudiantes había cada año apareció algo raro. Casi todos los años tienen entre 520.000 y 580.000 exámenes, pero
      <b>2018 y 2021 tienen menos de 20.000</b>.</p>
    <figure class="fig" sxRevelar aria-labelledby="fig-anios">
      <div class="fig-cab"><span class="material-symbols-rounded" aria-hidden="true">bar_chart</span>
        <div><b id="fig-anios">Exámenes por año en los datos públicos</b><small>Las barras punteadas son los años incompletos</small></div></div>
      <div class="anios" role="img" [attr.aria-label]="resumenAnios">
        @for (a of anios; track a.anio; let i = $index) {
          <div class="col" [class.falta]="a.falta" [style.--i]="i">
            <span class="valor">{{ a.etiqueta }}</span>
            <span class="barra"><span [style.height.%]="a.pct"></span></span>
            <span class="anio">{{ a.anio }}</span>
          </div>
        }
      </div>
      <figcaption>En 2018 el portal retiró el periodo principal y el de 2021 nunca se publicó: solo quedaron los colegios de
        <sx-termino t="calendario-a">calendario B</sx-termino>, que casi no existen en el Chocó.</figcaption>
    </figure>
    <p>¿Qué hicimos? Lo más honesto: <b>no usar esos dos años</b> y decirlo en todas partes. Rellenarlos con datos inventados habría sido más cómodo,
      pero habría escondido el problema. Si algún día el ICFES los publica completos, el sistema está preparado para incluirlos solo
      (ver <sx-termino t="anios-incompletos">años incompletos</sx-termino>).</p>

    <h2>Más allá del examen</h2>
    <p>El examen dice cómo le fue a cada estudiante, pero no cómo es el lugar donde vive. Para eso sumamos otras fuentes públicas, todas por municipio:</p>
    <div class="tarjetas" sxRevelar>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">school</span><b>Ministerio de Educación</b>
        <p>Cuántos jóvenes estudian 10.° y 11.° (<sx-termino t="cobertura">cobertura</sx-termino>), <sx-termino t="extraedad">extraedad</sx-termino> y profesores.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">home_work</span><b>DANE</b>
        <p><sx-termino t="pobreza-multidimensional">Pobreza multidimensional</sx-termino> del censo 2018 y los límites de cada municipio para los mapas.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">directions_walk</span><b>Unidad para las Víctimas</b>
        <p>Cuántas personas han tenido que dejar su municipio por el conflicto.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">wifi</span><b>MinTIC</b>
        <p>Cuántos hogares tienen internet fijo en cada municipio.</p></div>
    </div>

    <h2>Las herramientas</h2>
    <p>Todo se hizo en un portátil, sin servidores especiales. Usamos <b>Python</b>, un lenguaje de programación muy usado para analizar datos, y
      <b>DuckDB</b>, un programa que permite hacerle preguntas a millones de filas en segundos. Cada paso quedó escrito como un programa que se puede
      volver a correr: si se descargan los datos de nuevo, se llega exactamente al mismo resultado.</p>

    <div class="clave"><span class="material-symbols-rounded" aria-hidden="true">push_pin</span>
      <div><b>Para recordar</b><p>Los datos reales casi nunca están completos. Lo importante es notarlo, no taparlo, y contarle a quien los use qué falta y por qué.</p></div></div>`,
  styles: `
    .tamanos { display: flex; flex-direction: column; gap: 12px; }
    .portal { display: flex; align-items: center; gap: 22px; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--sx-border);
      background: color-mix(in srgb, var(--sx-accent) 6%, transparent); }
    .portal > span { font-size: 28px; color: var(--sx-accent); }
    .portal b { display: block; font-size: 18px; } .portal small { color: var(--sx-muted); font-size: 12.5px; }
    .fila { display: grid; grid-template-columns: 130px 1fr 72px; gap: 12px; align-items: center; opacity: 0.35; transition: opacity var(--sx-med); }
    .fila.on { opacity: 1; }
    .nombre { font-size: 14px; color: var(--sx-muted); } .fila b { font: 600 14px var(--sx-mono); text-align: right; }
    .pista { height: 14px; border-radius: 99px; background: color-mix(in srgb, var(--sx-text) 6%, transparent); overflow: hidden; }
    .relleno { display: block; height: 100%; border-radius: 99px; min-width: 0; transition: width 1s var(--sx-ease); }
    .anios { display: grid; grid-template-columns: repeat(13, 1fr); gap: 6px; align-items: end; height: 220px; }
    .col { display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; }
    .valor { font: 600 10.5px var(--sx-mono); color: var(--sx-muted); white-space: nowrap; }
    .barra { flex: 1; width: 100%; max-width: 34px; display: flex; align-items: flex-end; }
    .barra span { display: block; width: 100%; border-radius: 6px 6px 2px 2px; background: linear-gradient(var(--sx-accent), color-mix(in srgb, var(--sx-accent) 45%, transparent));
      transform-origin: bottom; transform: scaleY(0); transition: transform 0.9s var(--sx-ease); transition-delay: calc(var(--i) * 60ms); }
    .sx-visible .barra span { transform: scaleY(1); }
    .falta .barra span { min-height: 6px; background: transparent; border: 1.5px dashed var(--sx-danger); }
    .falta .valor, .falta .anio { color: var(--sx-danger); }
    .anio { font: 600 11px var(--sx-mono); color: var(--sx-faint); }
    @media (max-width: 600px) {
      .fila { grid-template-columns: 96px 1fr 62px; }
      .portal { gap: 14px; flex-wrap: wrap; }
      .anios { gap: 3px; height: 190px; } .valor { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 9.5px; } .anio { font-size: 9px; }
    }
    @media (prefers-reduced-motion: reduce) { .barra span, .relleno { transition: none; } }`,
})
export class CapDatos {
  protected etapas = ETAPAS;
  protected titulos = ETAPAS.map(e => e.titulo);
  protected paso = signal(0);
  protected barras = [
    { nombre: 'CSV', tam: '≈ 4 GB', pct: 100, color: 'var(--sx-danger)' },
    { nombre: 'Parquet', tam: '425 MB', pct: 10.6, color: 'var(--sx-warning)' },
    { nombre: 'Parquet limpio', tam: '120 MB', pct: 3, color: 'var(--sx-success)' },
  ];
  private max = Math.max(...POR_ANIO.map(([, n]) => n));
  protected anios = POR_ANIO.map(([anio, n]) => ({ anio, falta: n < 100000, pct: (n / this.max) * 100, etiqueta: num(n / 1000, 0) + ' mil' }));
  protected resumenAnios = 'Exámenes por año: ' + POR_ANIO.map(([a, n]) => `${a}: ${num(n)}`).join('; ');
}
