// Capítulo 9: lo que aprendimos. Conclusiones, límites dichos con franqueza y lo que sigue.
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TerminoEnlace } from '../glosario/termino';
import { Revelar } from '../landing/revelar';

@Component({
  selector: 'sx-cap-cierre',
  imports: [RouterLink, Revelar, TerminoEnlace],
  host: { class: 'art-cuerpo' },
  template: `
    <div class="resumen"><b><span class="material-symbols-rounded" aria-hidden="true">bolt</span>En 30 segundos</b>
      <ul><li>La diferencia del Chocó es grande, no se está cerrando y se explica sobre todo por las condiciones en que se estudia.</li>
          <li>Se puede anticipar el año siguiente con un margen de unos 10 puntos, siempre con una persona al mando.</li>
          <li>Hay límites, y los decimos: datos que faltan, promedios que esconden diferencias y un modelo que gana por poco.</li></ul></div>

    <p class="entrada">Empezamos con tres preguntas. Esto es lo que respondimos.</p>

    <div class="respuestas" sxRevelar>
      <article class="sx-r-hijo"><span class="num">1</span><div><b>¿Qué tan grande es la diferencia?</b>
        <p>Entre 31 y 48 puntos cada año desde 2014. Medida de forma justa entre años, pasó de −0,72 a −0,85
          <sx-termino t="desviacion">desviaciones</sx-termino>: no se está cerrando, se está abriendo.</p></div></article>
      <article class="sx-r-hijo"><span class="num">2</span><div><b>¿Qué la explica?</b>
        <p>La casa, cerca de una cuarta parte. El resto, casi todo, lo explican el colegio, la pobreza del municipio y la formación de los profesores.</p></div></article>
      <article class="sx-r-hijo"><span class="num">3</span><div><b>¿Se puede anticipar?</b>
        <p>Sí, con un error medio de 9,5 puntos y un rango que acierta 8 de cada 10 veces. Y con una regla: una persona aprueba cada versión.</p></div></article>
    </div>

    <h2>Lo que aprendimos en el camino</h2>
    <ul class="lista">
      <li><b>Los datos públicos tienen huecos.</b> Lo correcto es decirlo, no taparlos.</li>
      <li><b>Muchas ideas comunes eran falsas.</b> La pandemia no agrandó la brecha y el tipo de colegio casi no la explica. Ponerlas a prueba fue más útil que repetirlas.</li>
      <li><b>Lo sencillo ganó.</b> La receta más fácil de explicar se equivocó menos que las complicadas.</li>
      <li><b>Un buen sistema necesita revisores.</b> Entre los datos y el modelo, y entre el modelo y su uso, siempre hay un control.</li>
    </ul>

    <h2>Los límites, dichos con franqueza</h2>
    <div class="tarjetas" sxRevelar>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">event_busy</span><b>Faltan años</b>
        <p>2018 y 2021 no están completos en los datos públicos, y no hay datos de 2023 en adelante.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">visibility_off</span><b>El examen no ve a todos</b>
        <p>Solo mide a quienes llegan a grado 11. En varios municipios del Chocó son una minoría.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">functions</span><b>Los promedios esconden</b>
        <p>Un municipio con buen promedio puede tener colegios muy distintos por dentro.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">link_off</span><b>Ir juntos no es causar</b>
        <p>Las relaciones que encontramos son <sx-termino t="causa">asociaciones</sx-termino>, no pruebas de causa.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">balance</span><b>Gana por poco</b>
        <p>El modelo le gana a la mejor regla simple por apenas 0,1 puntos. Su valor está en ser claro y vigilado.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">public</span><b>Sorpresas del país</b>
        <p>Si todo el país cambia de golpe un año, como en 2019, ningún modelo basado en la historia lo puede prever.</p></div>
    </div>

    <h2>Lo que sigue</h2>
    <p>Cuando el ICFES publique años nuevos, SENTINEL está listo para recibirlos: se revisan, se entrena una candidata, se compara y una persona decide.
      Si algún día aparecen completos 2018 y 2021, el sistema los incluye solo. Y todo el análisis se puede repetir para cualquier otro departamento.</p>

    <blockquote class="cita">Los datos no cambian la realidad del Chocó. Pero ayudan a que quien puede cambiarla sepa dónde mirar.</blockquote>

    <div class="destinos" sxRevelar>
      <a class="sx-r-hijo" routerLink="/"><span class="material-symbols-rounded" aria-hidden="true">insights</span><b>Ver los resultados</b><small>Mapas y gráficas del estudio</small></a>
      <a class="sx-r-hijo" routerLink="/glosario"><span class="material-symbols-rounded" aria-hidden="true">menu_book</span><b>Glosario</b><small>Todas las palabras, explicadas</small></a>
      <a class="sx-r-hijo" routerLink="/acceso"><span class="material-symbols-rounded" aria-hidden="true">lock</span><b>La plataforma</b><small>Solo para el equipo</small></a>
    </div>`,
  styles: `
    .respuestas { display: flex; flex-direction: column; gap: 12px; margin: 8px 0 10px; }
    .respuestas article { display: flex; gap: 16px; padding: 20px; border-radius: 18px; background: var(--sx-card); border: 1px solid var(--sx-border); }
    .num { display: grid; place-items: center; flex: none; width: 34px; height: 34px; border-radius: 10px; font: 700 15px var(--sx-mono); color: var(--sx-accent-ink); background: var(--sx-accent); }
    .respuestas b { display: block; font-size: 17px; margin-bottom: 4px; }
    .respuestas p { margin: 0; font-size: 16px; line-height: 1.6; color: color-mix(in srgb, var(--sx-text) 85%, var(--sx-muted)); }
    .destinos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 36px; }
    .destinos a { display: flex; flex-direction: column; gap: 4px; padding: 20px; border-radius: 18px; background: var(--sx-card); border: 1px solid var(--sx-border);
      color: inherit; text-decoration: none; transition: border-color var(--sx-fast), transform var(--sx-med) var(--sx-ease), box-shadow var(--sx-med); }
    .destinos a:hover { border-color: var(--sx-accent); transform: translateY(-2px); box-shadow: var(--sx-shadow-lift); }
    .destinos span { font-size: 26px; color: var(--sx-accent); }
    .destinos b { margin-top: 6px; font-size: 16px; } .destinos small { color: var(--sx-muted); font-size: 13.5px; }
    @media (max-width: 640px) { .destinos { grid-template-columns: 1fr; } }`,
})
export class CapCierre {}
