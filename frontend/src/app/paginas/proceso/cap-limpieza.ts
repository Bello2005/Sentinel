// Capítulo 3: limpiar sin inventar. Tres filas de ejemplo se arreglan paso a paso delante del lector.
import { Component, signal } from '@angular/core';

import { TerminoEnlace } from '../glosario/termino';
import { Revelar } from '../landing/revelar';
import { Pasos } from './pasos';

const ETAPAS = [
  { titulo: 'Así llegan', texto: 'Tres exámenes tal como vienen del portal. Mire con atención: hay <b>cinco problemas escondidos</b>.' },
  { titulo: 'Números', texto: 'Los puntajes venían como texto ("254"). Ahora son <b>números</b>, para poder sumarlos y compararlos.' },
  { titulo: 'Un solo nombre', texto: '"BOGOTA" y "BOGOTÁ" son el mismo lugar. Con el <b>código del DANE</b> cada municipio queda con un único nombre.' },
  { titulo: 'Respuestas iguales', texto: 'Un año se respondía "Cuatro" y otro "3 a 4". Agrupamos las respuestas en <b>categorías que se pueden comparar</b> entre años.' },
  { titulo: 'Sin copias', texto: 'La tercera fila es <b>una copia exacta</b> de la primera (en 2019 y 2022 cada estudiante venía dos veces). Se quita.' },
  { titulo: 'Privacidad', texto: 'La fecha de nacimiento se cambia por la <b>edad</b>, y la fecha no se guarda. Es suficiente para el estudio y protege a las personas.' },
  { titulo: 'Misma regla', texto: 'Se agrega el puntaje en <b>desviaciones</b>: una regla que permite comparar años distintos de forma justa.' },
];

@Component({
  selector: 'sx-cap-limpieza',
  imports: [Revelar, Pasos, TerminoEnlace],
  host: { class: 'art-cuerpo' },
  template: `
    <div class="resumen"><b><span class="material-symbols-rounded" aria-hidden="true">bolt</span>En 30 segundos</b>
      <ul><li>Los datos traían errores: copias, nombres escritos distinto y números guardados como texto.</li>
          <li>Los corregimos con reglas claras, sin inventar ni borrar información verdadera.</li>
          <li>Quedaron 6.225.605 resultados limpios de 2010 a 2022.</li></ul></div>

    <p class="entrada">Antes de sacar cualquier conclusión hay que <sx-termino t="limpieza">limpiar los datos</sx-termino>. Es como lavar y picar los
      ingredientes antes de cocinar: no se nota en el plato final, pero si se hace mal, todo sale mal.</p>
    <p>Nuestra regla fue sencilla: <b>arreglar lo que está claramente mal, nunca inventar lo que no está</b>, y dejar escrito por qué se hizo cada cambio.</p>

    <figure class="fig" sxRevelar aria-labelledby="fig-limpieza">
      <div class="fig-cab"><span class="material-symbols-rounded" aria-hidden="true">cleaning_services</span>
        <div><b id="fig-limpieza">Tres exámenes, antes y después</b><small>Filas de ejemplo, inventadas para mostrar los problemas reales que encontramos</small></div></div>
      <div class="tabla-env">
        <table>
          <thead><tr><th>Municipio</th><th>Personas en el hogar</th><th>{{ paso() >= 5 ? 'Edad' : 'Nacimiento' }}</th><th>Puntaje</th>
            <th class="z" [class.on]="paso() >= 6">Frente al país</th></tr></thead>
          <tbody>
            @for (f of filas; track f.id) {
              <tr [class.copia]="f.copia" [class.fuera]="f.copia && paso() >= 4">
                <td [class.cambia]="paso() === 2">@if (paso() >= 2) { <span class="cod">11001</span> Bogotá } @else { <span [class.mal]="paso() === 0">{{ f.municipio }}</span> }</td>
                <td [class.cambia]="paso() === 3">@if (paso() >= 3) { 3 a 4 } @else { <span [class.mal]="paso() === 0">{{ f.hogar }}</span> }</td>
                <td [class.cambia]="paso() === 5">@if (paso() >= 5) { {{ f.edad }} años } @else { <span [class.mal]="paso() === 0">{{ f.nacimiento }}</span> }</td>
                <td [class.cambia]="paso() === 1" class="num">@if (paso() >= 1) { {{ f.puntaje }} } @else { <span class="texto" [class.mal]="paso() === 0">"{{ f.puntaje }}"</span> }</td>
                <td class="z num" [class.on]="paso() >= 6" [class.cambia]="paso() === 6">{{ f.z }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @for (x of [paso()]; track x) { <p class="explica" [innerHTML]="etapas[x].texto"></p> }
      <div class="fig-pie"><sx-pasos [total]="etapas.length" [etiquetas]="titulos" [(paso)]="paso" [intervalo]="3800" /></div>
    </figure>

    <h2>Lo que encontramos, y cómo se arregló</h2>
    <div class="arreglos" sxRevelar>
      @for (a of arreglos; track a.problema) {
        <div class="arreglo sx-r-hijo">
          <div class="antes"><span class="material-symbols-rounded" aria-hidden="true">error</span>{{ a.problema }}</div>
          <span class="flecha material-symbols-rounded" aria-hidden="true">arrow_forward</span>
          <div class="despues"><span class="material-symbols-rounded" aria-hidden="true">check_circle</span>{{ a.solucion }}</div>
        </div>
      }
    </div>

    <h2>El resultado</h2>
    <div class="cifras" sxRevelar>
      <div class="cifra sx-r-hijo"><b>7.109.704</b><span>filas descargadas del portal</span></div>
      <div class="cifra sx-r-hijo"><b>6.225.605</b><span>resultados limpios, sin copias, de 2010 a 2022</span></div>
      <div class="cifra sx-r-hijo"><b>47</b><span>columnas útiles, con nombres claros y tipos correctos</span></div>
    </div>
    <p>Además, cada examen trae una marca del ICFES que dice si el resultado se puede publicar. Solo usamos los que sí. Y los puntajes en 0 o
      muy extraños no se borraron: se <b>marcaron</b>, para que quien analice decida con la información completa.</p>

    <blockquote class="cita">Limpiar no es maquillar los datos. Es asegurarse de que cada número diga lo que de verdad pasó.</blockquote>

    <div class="clave"><span class="material-symbols-rounded" aria-hidden="true">push_pin</span>
      <div><b>Para recordar</b><p>Sin esta limpieza, en 2019 y 2022 cada estudiante habría contado dos veces, y Bogotá habría aparecido como dos ciudades distintas.</p></div></div>`,
  styles: `
    .tabla-env { overflow-x: auto; margin: 0 -4px; }
    table { width: 100%; min-width: 560px; border-collapse: separate; border-spacing: 0; font-size: 14px; }
    th { text-align: left; font-size: 11.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sx-faint); font-weight: 600; padding: 8px 10px; border-bottom: 1px solid var(--sx-border); }
    td { padding: 12px 10px; border-bottom: 1px solid var(--sx-border); transition: background var(--sx-med), color var(--sx-med); }
    td.num, th.num { text-align: right; font-family: var(--sx-mono); }
    tr { transition: opacity 600ms var(--sx-ease), transform 600ms var(--sx-ease); }
    tr.fuera { opacity: 0.25; } tr.fuera td { text-decoration: line-through; text-decoration-color: var(--sx-danger); }
    .mal { padding: 1px 6px; border-radius: 6px; background: color-mix(in srgb, var(--sx-danger) 14%, transparent); color: var(--sx-danger); }
    tr.copia td .mal { background: color-mix(in srgb, var(--sx-warning) 16%, transparent); color: var(--sx-warning); }
    .texto { font-family: var(--sx-mono); }
    td.cambia { background: color-mix(in srgb, var(--sx-success) 12%, transparent); animation: brilla 900ms var(--sx-ease); }
    @keyframes brilla { from { background: color-mix(in srgb, var(--sx-success) 32%, transparent); } }
    .cod { font: 600 12px var(--sx-mono); color: var(--sx-accent); margin-right: 4px; }
    .z { opacity: 0; transition: opacity var(--sx-med); } .z.on { opacity: 1; }
    .arreglos { display: flex; flex-direction: column; gap: 10px; margin: 8px 0 24px; }
    .arreglo { display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: center; }
    .antes, .despues { display: flex; gap: 10px; align-items: flex-start; padding: 14px; border-radius: 14px; font-size: 15px; line-height: 1.5; height: 100%; box-sizing: border-box; }
    .antes { background: color-mix(in srgb, var(--sx-danger) 7%, var(--sx-card)); border: 1px solid color-mix(in srgb, var(--sx-danger) 20%, transparent); }
    .despues { background: color-mix(in srgb, var(--sx-success) 7%, var(--sx-card)); border: 1px solid color-mix(in srgb, var(--sx-success) 22%, transparent); }
    .antes span { color: var(--sx-danger); font-size: 20px; } .despues span { color: var(--sx-success); font-size: 20px; }
    .flecha { color: var(--sx-faint); }
    @media (max-width: 640px) { .arreglo { grid-template-columns: 1fr; gap: 6px; } .flecha { transform: rotate(90deg); justify-self: center; } }
    @media (prefers-reduced-motion: reduce) { td.cambia { animation: none; } }`,
})
export class CapLimpieza {
  protected etapas = ETAPAS;
  protected titulos = ETAPAS.map(e => e.titulo);
  protected paso = signal(0);
  protected filas = [
    { id: 1, municipio: 'BOGOTA', hogar: 'Cuatro', nacimiento: '14/05/2002', edad: 17, puntaje: 254, z: '+0,03', copia: false },
    { id: 2, municipio: 'BOGOTÁ', hogar: '3 a 4', nacimiento: '02/11/2001', edad: 18, puntaje: 198, z: '−1,08', copia: false },
    { id: 3, municipio: 'BOGOTA', hogar: 'Cuatro', nacimiento: '14/05/2002', edad: 17, puntaje: 254, z: '+0,03', copia: true },
  ];
  protected arreglos = [
    { problema: 'Todo venía como texto, incluso los puntajes.', solucion: 'Los puntajes pasan a ser números.' },
    { problema: 'El mismo municipio escrito de varias formas (BOGOTA, BOGOTÁ).', solucion: 'Se usa el código del DANE y un solo nombre por código.' },
    { problema: 'Las preguntas del hogar cambiaron de opciones con los años.', solucion: 'Se agrupan en categorías comparables.' },
    { problema: 'En 2019 y 2022 cada estudiante aparecía dos veces.', solucion: 'Se quitan solo las copias exactas; las dudosas se marcan.' },
    { problema: 'Cada época del examen usa una escala distinta.', solucion: 'Se agrega el puntaje en desviaciones, comparable entre años.' },
    { problema: 'La fecha de nacimiento identifica demasiado.', solucion: 'Se cambia por la edad y la fecha no se guarda.' },
  ];
}
