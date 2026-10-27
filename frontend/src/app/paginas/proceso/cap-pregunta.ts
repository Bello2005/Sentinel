// Capítulo 1: la pregunta. Presenta el problema, las tres preguntas y el mapa del camino completo.
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TerminoEnlace } from '../glosario/termino';
import { Revelar } from '../landing/revelar';
import { CAPITULOS } from './capitulos';

@Component({
  selector: 'sx-cap-pregunta',
  imports: [RouterLink, Revelar, TerminoEnlace],
  host: { class: 'art-cuerpo' },
  template: `
    <div class="resumen"><b><span class="material-symbols-rounded" aria-hidden="true">bolt</span>En 30 segundos</b>
      <ul><li>El Chocó saca el puntaje más bajo de Colombia en el examen Saber 11.</li>
          <li>Queríamos entender qué tan grande es esa diferencia, qué la explica y si se puede anticipar.</li>
          <li>Este artículo cuenta, paso a paso y sin palabras raras, cómo lo hicimos.</li></ul></div>

    <p class="entrada">Cada año, más de medio millón de jóvenes en Colombia presentan el <sx-termino t="saber-11">Saber 11</sx-termino>, el examen
      que se hace al terminar el colegio. Y año tras año, un departamento aparece al final de la lista: el Chocó.</p>
    <p>En 2022 fue el último de 33. Sus estudiantes sacaron, en promedio, <b>45,8 puntos menos</b> que los del resto del país, en un examen que va
      de 0 a 500. Esa distancia es lo que en este estudio llamamos la <sx-termino t="brecha">brecha</sx-termino>.</p>
    <p>Un número así deja muchas preguntas. ¿Siempre ha sido así? ¿Es por la pobreza? ¿Por los colegios? ¿Por los profesores? ¿Y se podría saber,
      antes de que pase, cómo le irá a cada municipio el año siguiente?</p>

    <h2>Tres preguntas</h2>
    <div class="preguntas" sxRevelar>
      <article class="sx-r-hijo"><span class="num">1</span><b>¿Qué tan grande es la diferencia?</b><p>Y si se está cerrando o se está abriendo con los años.</p></article>
      <article class="sx-r-hijo"><span class="num">2</span><b>¿Qué la explica?</b><p>Separar cuánto pesa la casa, el colegio, el municipio y los profesores.</p></article>
      <article class="sx-r-hijo"><span class="num">3</span><b>¿Se puede anticipar?</b><p>Calcular el resultado del año siguiente, con un margen honesto y con una persona al mando.</p></article>
    </div>

    <h2>El camino completo</h2>
    <p>Para responderlas recorrimos un camino de nueve paradas: desde descargar los datos hasta construir el sitio web que está leyendo.
      Cada parada es un capítulo corto. Puede tocar cualquiera para ir directo.</p>
    <figure class="fig camino" sxRevelar>
      <ol>
        @for (c of capitulos; track c.id; let i = $index) {
          <li class="sx-r-hijo"><a [routerLink]="['/proceso', c.id]">
            <span class="punto"><span class="material-symbols-rounded" aria-hidden="true">{{ c.icono }}</span></span>
            <span class="txt"><small>{{ i + 1 }}</small><b>{{ c.titulo }}</b><em>{{ c.bajada }}</em></span></a></li>
        }
      </ol>
    </figure>

    <blockquote class="cita">Desde el primer día pusimos una regla que no se rompe: la <sx-termino t="ia">inteligencia artificial</sx-termino> puede calcular
      y recomendar, pero nunca decide sola.<small>Esa regla atraviesa todo el proyecto y se explica en el capítulo 8.</small></blockquote>

    <h2>Con qué contamos</h2>
    <p>Todo el estudio se hizo con <sx-termino t="datos-abiertos">datos abiertos</sx-termino>: información pública que cualquiera puede descargar y revisar.
      No usamos nombres ni datos que identifiquen a ningún estudiante. Eso significa algo importante: cualquier persona puede repetir lo que hicimos
      y comprobar si llega a lo mismo.</p>

    <div class="clave"><span class="material-symbols-rounded" aria-hidden="true">push_pin</span>
      <div><b>Para recordar</b><p>No buscamos culpables. Buscamos entender una diferencia que se repite cada año, para que quien toma decisiones lo haga con datos.</p></div></div>`,
  styles: `
    .preguntas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 8px 0 12px; }
    .preguntas article { padding: 20px; border-radius: 18px; background: var(--sx-card); border: 1px solid var(--sx-border); }
    .preguntas .num { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; font: 700 15px var(--sx-mono); color: var(--sx-accent-ink); background: var(--sx-accent); }
    .preguntas b { display: block; margin: 14px 0 6px; font-size: 17px; line-height: 1.3; }
    .preguntas p { margin: 0; font-size: 14.5px; line-height: 1.55; color: var(--sx-muted); }
    .camino ol { list-style: none; margin: 0; padding: 0; position: relative; display: flex; flex-direction: column; gap: 4px; }
    .camino ol::before { content: ''; position: absolute; left: 21px; top: 22px; bottom: 22px; width: 2px; border-radius: 2px;
      background: linear-gradient(var(--sx-accent), var(--sx-candidate)); transform-origin: top; transform: scaleY(0); transition: transform 1.6s var(--sx-ease) 0.2s; }
    .camino.sx-visible ol::before { transform: scaleY(1); }
    .camino a { display: flex; align-items: center; gap: 16px; padding: 8px; border-radius: 14px; color: inherit; text-decoration: none; transition: background var(--sx-fast); }
    .camino a:hover { background: color-mix(in srgb, var(--sx-accent) 7%, transparent); }
    .punto { position: relative; z-index: 1; width: 28px; height: 28px; margin: 0 1px; flex: none; display: grid; place-items: center; border-radius: 99px;
      background: var(--sx-card); border: 2px solid var(--sx-accent); color: var(--sx-accent); }
    .punto span { font-size: 15px; }
    .txt { display: grid; grid-template-columns: auto 1fr; column-gap: 8px; align-items: baseline; }
    .txt small { font: 600 12px var(--sx-mono); color: var(--sx-faint); }
    .txt b { font-size: 16px; } .txt em { grid-column: 2; font-style: normal; font-size: 14px; color: var(--sx-muted); }
    @media (max-width: 700px) { .preguntas { grid-template-columns: 1fr; } }`,
})
export class CapPregunta {
  protected capitulos = CAPITULOS;
}
