// Capítulo 7: del cuaderno a la web. El recorrido de una predicción por la arquitectura real de SENTINEL.
import { Component, computed, signal } from '@angular/core';

import { TerminoEnlace } from '../glosario/termino';
import { Revelar } from '../landing/revelar';
import { Pasos } from './pasos';

const NODOS = [
  { nombre: 'Su pantalla', tec: 'Angular', icono: 'devices',
    texto: 'Usted sube un archivo desde la página. Lo que ve (botones, tablas, gráficas) está hecho con <b>Angular</b>, una herramienta para construir sitios web.' },
  { nombre: 'La puerta', tec: 'Nginx + HTTPS', icono: 'shield_lock',
    texto: '<b>Nginx</b> recibe la visita en el servidor. Con <b>HTTPS</b> (el candado del navegador) nadie puede leer lo que viaja por el camino.' },
  { nombre: 'El coordinador', tec: 'Crow · C++', icono: 'hub',
    texto: 'El programa central está escrito en <b>C++</b>, un lenguaje muy rápido, con <b>Crow</b>. Revisa que usted haya iniciado sesión y decide qué hacer con el archivo.' },
  { nombre: 'El revisor', tec: 'Validación', icono: 'verified_user',
    texto: 'Antes de predecir, el archivo pasa por <b>cinco revisiones</b>. Si algo está mal, explica qué y se detiene: nunca predice con datos malos.' },
  { nombre: 'El calculador', tec: 'ONNX Runtime', icono: 'memory',
    texto: '<b>ONNX Runtime</b> ejecuta el modelo y calcula cada predicción con su rango, en milésimas de segundo.' },
  { nombre: 'La respuesta', tec: 'Tablas y gráficas', icono: 'insights',
    texto: 'Los resultados vuelven a su pantalla como tablas y gráficas que se pueden descargar, y quedan guardados para revisarlos después.' },
];

const REVISIONES = [
  { nombre: 'Esquema', pregunta: '¿Están todas las columnas que el modelo necesita?' },
  { nombre: 'Tipos', pregunta: '¿Cada dato es lo que debe ser? Un número donde va un número, un código donde va un código.' },
  { nombre: 'Contenido', pregunta: '¿Faltan valores obligatorios o hay filas repetidas?' },
  { nombre: 'Dominio', pregunta: '¿Los valores son posibles? Un puntaje de 650 no existe: la escala va de 0 a 500.' },
  { nombre: 'Coherencia', pregunta: '¿Los datos tienen sentido entre sí? El último año con datos debe ser anterior al año que se quiere predecir.' },
];

@Component({
  selector: 'sx-cap-plataforma',
  imports: [Revelar, Pasos, TerminoEnlace],
  host: { class: 'art-cuerpo' },
  template: `
    <div class="resumen"><b><span class="material-symbols-rounded" aria-hidden="true">bolt</span>En 30 segundos</b>
      <ul><li>El análisis vivía en cuadernos de programación. Lo convertimos en un sitio web que cualquiera del equipo puede usar.</li>
          <li>Python entrena el modelo y C++ lo usa para predecir, rápido y con las mismas respuestas.</li>
          <li>Cada archivo se revisa cinco veces antes de predecir.</li></ul></div>

    <p class="entrada">Un análisis que solo funciona en el computador de quien lo hizo sirve de poco. Por eso el último paso fue construir
      <b>SENTINEL</b>: una plataforma web donde el equipo puede revisar datos nuevos, pedir predicciones y aprobar versiones del modelo.</p>

    <h2>El viaje de una predicción</h2>
    <p>Siga lo que pasa, en menos de un segundo, desde que alguien sube un archivo hasta que ve los resultados:</p>
    <figure class="fig" sxRevelar aria-labelledby="fig-flujo">
      <div class="fig-cab"><span class="material-symbols-rounded" aria-hidden="true">route</span>
        <div><b id="fig-flujo">De su pantalla al modelo, y de vuelta</b><small>Las seis piezas por las que pasa cada predicción</small></div></div>
      <div class="flujo" [style.--p]="avance()">
        <div class="pista-f" aria-hidden="true"><span class="lleno"></span><span class="paquete"></span></div>
        @for (nodo of nodos; track nodo.nombre; let i = $index) {
          <button class="nodo" [class.on]="paso() === i" [class.hecho]="paso() > i" (click)="paso.set(i)" [attr.aria-label]="nodo.nombre + ': ' + nodo.tec">
            <span class="ico"><span class="material-symbols-rounded" aria-hidden="true">{{ nodo.icono }}</span></span>
            <b>{{ nodo.nombre }}</b><small>{{ nodo.tec }}</small>
          </button>
        }
      </div>
      @for (x of [paso()]; track x) { <p class="explica" [innerHTML]="nodos[x].texto"></p> }
      <div class="fig-pie"><sx-pasos [total]="nodos.length" [etiquetas]="titulos" [(paso)]="paso" /></div>
    </figure>

    <h2>Las cinco revisiones</h2>
    <p>La pieza más importante para la confianza es el revisor. Antes de que el modelo vea un solo dato, el archivo tiene que pasar cinco preguntas.
      Las reglas no están escritas en la página: viven en un solo archivo que comparten el revisor y el entrenamiento, para que nunca se contradigan.
      Esto es <sx-termino t="validacion">validar los datos</sx-termino>.</p>
    <ol class="revisiones" sxRevelar>
      @for (r of revisiones; track r.nombre; let i = $index) {
        <li class="sx-r-hijo"><span class="check"><span class="material-symbols-rounded" aria-hidden="true">check</span></span>
          <div><b>{{ i + 1 }}. {{ r.nombre }}</b><p>{{ r.pregunta }}</p></div></li>
      }
    </ol>
    <p>Si un archivo no pasa, SENTINEL no lo descarta en silencio: muestra cada problema con lo que esperaba, lo que encontró y en qué filas. Y aunque
      no sirva para predecir, igual se puede explorar: la plataforma hace un <sx-termino t="eda">análisis exploratorio</sx-termino> automático de cualquier archivo.</p>

    <h2>Dos idiomas que se entienden</h2>
    <p>El modelo se entrena en <b>Python</b> con <b>scikit-learn</b>, la herramienta más usada para esto. Pero quien predice en el servidor es el programa en
      C++. ¿Cómo se pasan el modelo? Con <b>ONNX</b>, un formato universal para modelos, algo así como un PDF: se crea en un programa y se abre en otro
      sin que cambie nada.</p>
    <div class="dos-idiomas" sxRevelar>
      <div class="sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">science</span><b>Python</b><small>entrena</small></div>
      <span class="flecha sx-r-hijo material-symbols-rounded" aria-hidden="true">arrow_forward</span>
      <div class="sx-r-hijo onnx"><span class="material-symbols-rounded" aria-hidden="true">description</span><b>modelo.onnx</b><small>el mismo modelo</small></div>
      <span class="flecha sx-r-hijo material-symbols-rounded" aria-hidden="true">arrow_forward</span>
      <div class="sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">bolt</span><b>C++</b><small>predice</small></div>
    </div>
    <p>Lo comprobamos: las predicciones de Python y de C++ coinciden. La diferencia más grande que encontramos fue de <b>0,00005 puntos</b>.</p>

    <h2>Todas las piezas</h2>
    <div class="tarjetas" sxRevelar>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">web</span><b>Interfaz</b><p>Angular 20, con gráficas interactivas, modo claro y oscuro, y diseño para celular.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">hub</span><b>Servidor</b><p>Crow en C++17: validación, coordinación, inicio de sesión y predicción con ONNX Runtime.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">model_training</span><b>Entrenamiento</b><p>Python y scikit-learn, solo cuando hay que crear una versión nueva.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">inventory_2</span><b>Almacén</b><p>Cada versión del modelo, sus datos y sus reportes quedan guardados por separado.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">dns</span><b>Publicación</b><p>Un servidor Linux con Nginx y HTTPS en sentinel.bello.works.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">auto_stories</span><b>Este sitio</b><p>Los resultados, este artículo y el glosario se generan desde los mismos datos del estudio.</p></div>
    </div>

    <div class="clave"><span class="material-symbols-rounded" aria-hidden="true">push_pin</span>
      <div><b>Para recordar</b><p>Cada pieza hace una sola cosa y la hace bien. Y entre los datos y el modelo siempre hay un revisor.</p></div></div>`,
  styles: `
    .flujo { --p: 0; position: relative; display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
    .pista-f { position: absolute; left: 8.33%; right: 8.33%; top: 25px; height: 3px; border-radius: 3px; background: var(--sx-border-strong); }
    .lleno { position: absolute; inset: 0; border-radius: 3px; background: linear-gradient(90deg, var(--sx-accent), var(--sx-candidate)); transform-origin: left;
      transform: scaleX(var(--p)); transition: transform 700ms var(--sx-ease); }
    .paquete { position: absolute; top: 50%; left: calc(var(--p) * 100%); width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 99px; background: var(--sx-accent);
      box-shadow: 0 0 0 5px color-mix(in srgb, var(--sx-accent) 25%, transparent), 0 0 18px var(--sx-accent); transition: left 700ms var(--sx-ease); }
    .nodo { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 0 2px; border: 0; background: none; color: inherit;
      font: inherit; text-align: center; cursor: pointer; }
    .ico { width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; background: var(--sx-card); border: 1px solid var(--sx-border-strong);
      color: var(--sx-muted); transition: all var(--sx-med) var(--sx-ease); }
    .ico span { font-size: 24px; }
    .nodo b { margin-top: 6px; font-size: 13.5px; } .nodo small { font-size: 11.5px; color: var(--sx-muted); }
    .nodo.hecho .ico { color: var(--sx-accent); border-color: color-mix(in srgb, var(--sx-accent) 40%, transparent); }
    .nodo.on .ico { color: var(--sx-accent-ink); background: var(--sx-accent); border-color: transparent; transform: scale(1.1); box-shadow: var(--sx-glow); }
    .nodo:focus-visible .ico { outline: 2px solid var(--sx-accent); outline-offset: 3px; }
    .revisiones { list-style: none; margin: 8px 0 22px; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .revisiones li { display: flex; gap: 14px; align-items: flex-start; padding: 14px 16px; border-radius: 14px; background: var(--sx-card); border: 1px solid var(--sx-border); }
    .check { width: 28px; height: 28px; flex: none; border-radius: 99px; display: grid; place-items: center; border: 2px solid var(--sx-border-strong); color: transparent;
      transition: all 400ms var(--sx-ease); transition-delay: calc(var(--sx-r-i, 0) * 260ms + 400ms); }
    .check span { font-size: 17px; }
    .sx-visible .check { background: var(--sx-success); border-color: var(--sx-success); color: #fff; }
    .revisiones b { font-size: 15.5px; } .revisiones p { margin: 3px 0 0; font-size: 14.5px; line-height: 1.55; color: var(--sx-muted); }
    .dos-idiomas { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; margin: 6px 0 22px; }
    .dos-idiomas > div { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 120px; padding: 16px; border-radius: 16px; background: var(--sx-card); border: 1px solid var(--sx-border); }
    .dos-idiomas > div > span { font-size: 26px; color: var(--sx-accent); }
    .dos-idiomas b { font-size: 15px; } .dos-idiomas small { font-size: 12.5px; color: var(--sx-muted); }
    .dos-idiomas .onnx { border-color: color-mix(in srgb, var(--sx-candidate) 45%, transparent); } .dos-idiomas .onnx > span { color: var(--sx-candidate); }
    .flecha { color: var(--sx-faint); }
    @media (max-width: 680px) {
      .flujo { grid-template-columns: 1fr; gap: 10px; }
      .pista-f { left: 25px; right: auto; top: 26px; bottom: 26px; width: 3px; height: auto; }
      .lleno { transform-origin: top; transform: scaleY(var(--p)); }
      .paquete { left: 50%; top: calc(var(--p) * 100%); margin: -7px 0 0 -7px; transition: top 700ms var(--sx-ease); }
      .nodo { flex-direction: row; text-align: left; gap: 12px; } .nodo b { margin: 0; } .ico { width: 52px; flex: none; }
      .nodo small { margin-left: auto; }
      .dos-idiomas { flex-direction: column; } .flecha { transform: rotate(90deg); }
    }
    @media (prefers-reduced-motion: reduce) { .lleno, .paquete, .check { transition: none; } }`,
})
export class CapPlataforma {
  protected nodos = NODOS;
  protected titulos = NODOS.map(n => n.nombre);
  protected revisiones = REVISIONES;
  protected paso = signal(0);
  protected avance = computed(() => this.paso() / (NODOS.length - 1));
}
