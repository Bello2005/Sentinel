// Capítulo 5: buscar las causas. La brecha se encoge a medida que se comparan estudiantes cada vez más parecidos.
import { Component, computed, inject, signal } from '@angular/core';

import { num } from '../../core/formato';
import { TerminoEnlace } from '../glosario/termino';
import { DatosEstudio } from '../landing/datos';
import { Revelar } from '../landing/revelar';
import { Pasos } from './pasos';

// Un título y una explicación sencilla para cada paso de 1_brecha_paso_a_paso.csv (mismo orden)
const EXPLICACION = [
  { titulo: 'Tal cual', icono: 'straighten', texto: 'Sin tener nada en cuenta, un estudiante del Chocó saca en promedio esta cantidad de puntos menos que uno del resto del país.' },
  { titulo: 'La casa', icono: 'cottage', texto: 'Comparando estudiantes con hogares parecidos (edad, sexo, estudios de los papás y cosas en la casa) la diferencia baja bastante.' },
  { titulo: 'Tipo de colegio', icono: 'apartment', texto: 'Que el colegio sea público o privado, rural o urbano, casi no cambia nada.' },
  { titulo: 'Los compañeros', icono: 'groups', texto: 'Estudiar con compañeros de hogares parecidos baja un poco más la diferencia.' },
  { titulo: 'Datos del colegio', icono: 'badge', texto: 'Lo que el registro oficial dice de cada colegio, incluida su composición étnica, explica una parte muy grande.' },
  { titulo: 'Aislamiento', icono: 'route', texto: 'Qué tan lejos está el municipio de la capital: casi no cambia.' },
  { titulo: 'El municipio', icono: 'location_city', texto: 'La pobreza, el conflicto y el internet del municipio bajan otro poco.' },
  { titulo: 'Los profesores', icono: 'cast_for_education', texto: 'La formación de los profesores de cada secretaría de educación deja la diferencia en su punto más bajo.' },
];

@Component({
  selector: 'sx-cap-causas',
  imports: [Revelar, Pasos, TerminoEnlace],
  host: { class: 'art-cuerpo' },
  template: `
    <div class="resumen"><b><span class="material-symbols-rounded" aria-hidden="true">bolt</span>En 30 segundos</b>
      <ul><li>Para saber qué explica la diferencia, comparamos estudiantes cada vez más parecidos.</li>
          <li>La casa explica cerca de una cuarta parte. El colegio, el municipio y los profesores, casi todo lo demás.</li>
          <li>Al final queda una diferencia pequeña que, con el cálculo más estricto, podría ser casualidad.</li></ul></div>

    <p class="entrada">Saber que el Chocó saca menos no dice por qué. Para acercarnos a las causas usamos una idea muy simple:
      <b>comparar parecidos con parecidos</b>.</p>
    <p>Si comparamos a todos tal cual, mezclamos muchas cosas: pobreza, colegios, estudios de los papás. Pero si comparamos a un estudiante del Chocó
      con otro del resto del país <b>que se le parece mucho</b> (misma clase de hogar, mismo tipo de colegio, municipio con condiciones parecidas), lo que
      quede de diferencia ya no se puede culpar a esas cosas. Esto se llama pasar de la <sx-termino t="brecha-bruta">brecha bruta a la brecha ajustada</sx-termino>.</p>
    <p>Lo hicimos con un <sx-termino t="modelo">modelo</sx-termino> estadístico y 1,1 millones de estudiantes de 2019 y 2022, agregando
      <sx-termino t="variable">bloques de variables</sx-termino> uno por uno. Vea qué pasa con la diferencia:</p>

    @if (pasos().length) {
      <figure class="fig" sxRevelar aria-labelledby="fig-cascada">
        <div class="fig-cab"><span class="material-symbols-rounded" aria-hidden="true">account_tree</span>
          <div><b id="fig-cascada">La diferencia se encoge al comparar parecidos</b><small>Puntos menos que el resto del país, agregando un bloque a la vez</small></div></div>
        <div class="cascada">
          @for (p of pasos(); track p.i) {
            <div class="nivel" [class.on]="paso() >= p.i" [class.actual]="paso() === p.i">
              <span class="et"><span class="material-symbols-rounded" aria-hidden="true">{{ p.icono }}</span>{{ p.titulo }}</span>
              <span class="pista"><span class="barra" [style.width.%]="paso() >= p.i ? p.pct : 0"></span></span>
              <b>{{ paso() >= p.i ? n(p.brecha, 1) : '' }}</b>
            </div>
          }
        </div>
        @for (x of [paso()]; track x) {
          <p class="explica">{{ explicacion[x].texto }}
            @if (x > 0) { <b>{{ cambio(x) }}</b> }</p>
        }
        <div class="fig-pie"><sx-pasos [total]="pasos().length" [etiquetas]="titulos" [(paso)]="paso" [intervalo]="3600" /></div>
      </figure>
    }

    <h2>Lo que más pesa</h2>
    <div class="cifras" sxRevelar>
      <div class="cifra sx-r-hijo"><b>≈ 27 %</b><span>de la diferencia se explica por la casa</span></div>
      <div class="cifra sx-r-hijo"><b>≈ −11</b><span>puntos se asocian a la <sx-termino t="composicion-etnica">composición étnica</sx-termino> del colegio</span></div>
      <div class="cifra sx-r-hijo"><b>≈ −8</b><span>puntos, a la pobreza del municipio; otros ≈ −8, a la <sx-termino t="formacion-docente">formación de los profesores</sx-termino></span></div>
    </div>
    <p>Hay que leer con cuidado lo de la composición étnica. <b>No significa que ser afrocolombiano o indígena baje el puntaje.</b> Es una huella de
      muchos años de exclusión, de menos inversión del Estado en esas regiones y de un colegio y un examen pensados para otros contextos.</p>
    <p>Y un dato que sorprende: medir mejor la casa (si hay libros, si se come bien, si el estudiante trabaja) casi no cambia la diferencia.
      <b>El problema no está solo dentro de la casa</b>: está en el lugar, en el colegio y en quién enseña.</p>

    <h2>¿Y lo que queda?</h2>
    <p>Después de todos los bloques quedan {{ n(-(ultimo()?.brecha ?? -9.5), 1) }} puntos. ¿Es una diferencia real? Depende de qué tan exigente sea el
      cálculo. Si se agrupa a los estudiantes por municipio, que es la forma más estricta, el margen de error es tan grande que esa diferencia
      <sx-termino t="no-distingue-cero">no se distingue de cero</sx-termino>: podría ser casualidad.</p>

    <h2>El caso de Quibdó</h2>
    <p>Al separar la capital del resto del departamento apareció otra historia. En el resto del Chocó la diferencia se explica casi entera por las
      condiciones del lugar. Quibdó, en cambio, saca unos <b>20 puntos menos de lo que se esperaría</b> por sus condiciones
      (<sx-termino t="lo-esperado">por debajo de lo esperado</sx-termino>). Buscando por qué, encontramos que el registro oficial cuenta como afro o indígenas
      a 30 de cada 100 estudiantes, cuando en el examen se reconocen así 83 de cada 100. El registro se queda corto, y eso confunde los cálculos.</p>

    <div class="clave"><span class="material-symbols-rounded" aria-hidden="true">push_pin</span>
      <div><b>Para recordar</b><p>La diferencia del Chocó no es un misterio ni una cuestión de “capacidad”. Se explica, casi toda, por las condiciones en las que se estudia.</p></div></div>`,
  styles: `
    .cascada { display: flex; flex-direction: column; gap: 8px; }
    .nivel { display: grid; grid-template-columns: 170px 1fr 56px; gap: 12px; align-items: center; opacity: 0.4; transition: opacity var(--sx-med); }
    .nivel.on { opacity: 1; }
    .et { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--sx-muted); }
    .et span { font-size: 18px; }
    .nivel.actual .et { color: var(--sx-text); font-weight: 600; } .nivel.actual .et span { color: var(--sx-accent); }
    .pista { height: 22px; border-radius: 7px; background: color-mix(in srgb, var(--sx-text) 5%, transparent); overflow: hidden; }
    .barra { display: block; height: 100%; border-radius: 7px; background: linear-gradient(90deg, var(--sx-danger), var(--sx-warning)); transition: width 900ms var(--sx-ease); }
    .nivel.actual .barra { box-shadow: 0 0 16px color-mix(in srgb, var(--sx-warning) 50%, transparent); }
    .nivel b { font: 700 15px var(--sx-mono); text-align: right; }
    @media (max-width: 600px) { .nivel { grid-template-columns: 110px 1fr 46px; gap: 8px; } .et { font-size: 12.5px; } .et span { display: none; } }
    @media (prefers-reduced-motion: reduce) { .barra { transition: none; } }`,
})
export class CapCausas {
  private datos = inject(DatosEstudio);
  protected explicacion = EXPLICACION;
  protected titulos = EXPLICACION.map(e => e.titulo);
  protected paso = signal(0);
  protected n = num;
  protected pasos = computed(() => {
    const p = this.datos.estudio()?.brecha.pasos ?? [];
    const max = Math.max(...p.map(x => Math.abs(x.brecha)), 1);
    return p.slice(0, EXPLICACION.length).map((x, i) => ({ i, brecha: x.brecha, pct: (Math.abs(x.brecha) / max) * 100, ...EXPLICACION[i] }));
  });
  protected ultimo = computed(() => this.pasos().at(-1) ?? null);
  protected cambio(i: number) {
    const p = this.pasos();
    const d = Math.abs(p[i].brecha) - Math.abs(p[i - 1].brecha);
    return Math.abs(d) < 1 ? ' (casi igual)' : d < 0 ? ` (${num(d, 1)} puntos)` : ` (+${num(d, 1)} puntos)`;
  }
  constructor() { this.datos.cargar(); }
}
