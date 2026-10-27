// Capítulo 4: mirar antes de concluir. Las tres miradas, la ficha de un municipio armada fuente por fuente y las hipótesis.
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { num } from '../../core/formato';
import { TerminoEnlace } from '../glosario/termino';
import { DatosEstudio, pearson } from '../landing/datos';
import { Revelar } from '../landing/revelar';
import { Pasos } from './pasos';

const FUENTES = [
  { titulo: 'ICFES', icono: 'edit_note', texto: 'Del examen sale el <b>puntaje promedio</b>, cuántos estudiantes lo presentaron y en cuántos colegios.' },
  { titulo: 'Ministerio de Educación', icono: 'school', texto: 'Se suma la <b>cobertura</b>: cuántos jóvenes en edad de 10.° y 11.° de verdad están estudiando esos grados.' },
  { titulo: 'DANE', icono: 'home_work', texto: 'Se suma la <b>pobreza multidimensional</b> del censo: cuántas personas viven con carencias básicas.' },
  { titulo: 'Hogares', icono: 'wifi', texto: 'Se suma cuántos estudiantes tienen <b>internet en casa</b> y cuántos se reconocen afrocolombianos o indígenas.' },
  { titulo: 'Ficha completa', icono: 'task_alt', texto: 'Así queda una fila por municipio: el <b>panel municipal</b>. Con 1.113 fichas como esta se puede comparar todo el país.' },
];

@Component({
  selector: 'sx-cap-exploracion',
  imports: [RouterLink, Revelar, Pasos, TerminoEnlace],
  host: { class: 'art-cuerpo' },
  template: `
    <div class="resumen"><b><span class="material-symbols-rounded" aria-hidden="true">bolt</span>En 30 segundos</b>
      <ul><li>Miramos los datos desde tres alturas: cada estudiante, cada municipio y cada región.</li>
          <li>Armamos una ficha por municipio uniendo cinco fuentes públicas.</li>
          <li>Escribimos seis ideas comunes sobre el Chocó y las pusimos a prueba. Varias resultaron falsas.</li></ul></div>

    <p class="entrada">Con los datos limpios, la tentación es correr a sacar conclusiones. Pero primero hay que <b>mirar</b>: contar, graficar y
      buscar lo raro. A esto se le llama <sx-termino t="eda">análisis exploratorio</sx-termino>.</p>

    <h2>Tres miradas</h2>
    <div class="tarjetas" sxRevelar>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">person</span><b>El estudiante</b>
        <p>6,2 millones de exámenes. Sirve para ver la casa: los estudios de la mamá, el estrato, el tipo de colegio.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">location_city</span><b>El municipio</b>
        <p>1.113 municipios con su promedio. Sirve para ver el lugar: pobreza, cobertura, internet.</p></div>
      <div class="tarjeta-mini sx-r-hijo"><span class="material-symbols-rounded" aria-hidden="true">public</span><b>La región</b>
        <p>El Chocó frente a la <sx-termino t="pacifico">costa pacífica</sx-termino> y al resto del país, año por año.</p></div>
    </div>

    <h2>La ficha de un municipio</h2>
    <p>Para la mirada municipal unimos todas las fuentes en una sola tabla, con una fila por municipio. Así se arma, por ejemplo, la ficha de Quibdó:</p>
    @if (quibdo(); as q) {
      <figure class="fig" sxRevelar aria-labelledby="fig-ficha">
        <div class="fig-cab"><span class="material-symbols-rounded" aria-hidden="true">badge</span>
          <div><b id="fig-ficha">Armando la ficha de Quibdó</b><small>Cada fuente agrega una parte · datos reales</small></div></div>
        <div class="ficha-env">
          <ol class="fuentes">
            @for (f of fuentes; track f.titulo; let i = $index) {
              <li [class.on]="paso() === i" [class.hecho]="paso() > i"><span class="material-symbols-rounded" aria-hidden="true">{{ paso() > i ? 'check' : f.icono }}</span>{{ f.titulo }}</li>
            }
          </ol>
          <div class="ficha" [class.completa]="paso() === 4">
            <div class="ficha-cab"><b>Quibdó</b><small>Capital del Chocó · código 27001</small></div>
            <dl>
              <div [class.on]="paso() >= 0"><dt>Puntaje promedio</dt><dd>{{ n(q.puntaje, 1) }}</dd></div>
              <div [class.on]="paso() >= 0"><dt>Estudiantes · colegios</dt><dd>{{ n(q.estudiantes) }} · {{ q.colegios }}</dd></div>
              <div [class.on]="paso() >= 1"><dt>Cobertura en 10.° y 11.°</dt><dd>{{ n(q.cobertura_media, 1) }} %</dd></div>
              <div [class.on]="paso() >= 2"><dt>Pobreza multidimensional</dt><dd>{{ n(q.ipm, 1) }} %</dd></div>
              <div [class.on]="paso() >= 3"><dt>Internet en casa</dt><dd>{{ n(q.internet_hogar, 1) }} %</dd></div>
              <div [class.on]="paso() >= 3"><dt>Afro o indígenas</dt><dd>{{ n(q.etnia, 1) }} %</dd></div>
            </dl>
          </div>
        </div>
        @for (x of [paso()]; track x) { <p class="explica" [innerHTML]="fuentes[x].texto"></p> }
        <div class="fig-pie"><sx-pasos [total]="fuentes.length" [etiquetas]="titulos" [(paso)]="paso" /></div>
      </figure>
    }

    <h2>Lo primero que saltó a la vista</h2>
    <div class="cifras" sxRevelar>
      <div class="cifra sx-r-hijo"><b>{{ r()?.municipios_10_mas_bajo ?? 26 }} de {{ r()?.municipios_con_dato ?? 30 }}</b><span>municipios del Chocó están entre los más bajos del país (el 10 % de abajo)</span></div>
      <div class="cifra sx-r-hijo"><b>{{ n(r()?.pct_cuartil_bajo ?? 61.2, 1) }} %</b><span>de sus estudiantes queda en la cuarta parte más baja del país</span></div>
      <div class="cifra sx-r-hijo"><b>{{ n(corr(), 2) }}</b><span><sx-termino t="correlacion">correlación</sx-termino> entre pobreza y puntaje en sus municipios</span></div>
    </div>
    <p>También aprendimos a desconfiar. El Saber 11 solo ve a quienes <b>llegan</b> a grado 11, y en 9 municipios del Chocó menos de 15 de cada 100
      jóvenes en edad de estar en 10.° y 11.° están estudiando esos grados (<sx-termino t="cobertura">cobertura</sx-termino>). El examen, ahí, solo
      ve a una minoría. Y un dato raro: donde más deserción se reporta, más puntaje hay. Más que un hallazgo, parece una señal de que esa cifra está
      mal registrada.</p>

    <h2>Seis ideas, puestas a prueba</h2>
    <p>Antes de buscar causas escribimos las ideas que más se repiten sobre el Chocó como <sx-termino t="hipotesis">hipótesis</sx-termino>: preguntas
      que los datos pudieran responder con un sí o un no. Esto evita un error común: encontrar solo lo que uno ya quería encontrar.</p>
    @if (hipotesis().length) {
      <div class="hips" sxRevelar>
        @for (h of hipotesis(); track h.id) {
          <div class="hip sx-r-hijo" [attr.data-v]="h.v">
            <span class="material-symbols-rounded" aria-hidden="true">{{ h.v === 'no' ? 'cancel' : h.v === 'parcial' ? 'contrast' : 'check_circle' }}</span>
            <div><b>{{ h.titulo }}</b><small>{{ h.etiqueta }}</small></div>
          </div>
        }
      </div>
      <p class="nota"><span class="material-symbols-rounded" aria-hidden="true">info</span>
        <span>El detalle de cada una está en <a class="en-linea" routerLink="/" fragment="hipotesis">los resultados del estudio</a>.</span></p>
    }

    <div class="clave"><span class="material-symbols-rounded" aria-hidden="true">push_pin</span>
      <div><b>Para recordar</b><p>Que la pobreza y el puntaje vayan juntos no prueba que una cosa cause la otra
        (<sx-termino t="causa">asociación no es causa</sx-termino>). Para acercarse a las causas hace falta el siguiente paso.</p></div></div>`,
  styles: `
    .ficha-env { display: grid; grid-template-columns: 200px 1fr; gap: 18px; align-items: start; }
    .fuentes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .fuentes li { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; font-size: 14px; color: var(--sx-muted); border: 1px solid transparent;
      transition: all var(--sx-med) var(--sx-ease); }
    .fuentes li span { font-size: 19px; }
    .fuentes li.on { color: var(--sx-text); border-color: var(--sx-accent); background: color-mix(in srgb, var(--sx-accent) 9%, transparent); transform: translateX(4px); }
    .fuentes li.on span { color: var(--sx-accent); }
    .fuentes li.hecho span { color: var(--sx-success); }
    .ficha { padding: 18px; border-radius: 16px; border: 1px solid var(--sx-border-strong); background: var(--sx-bg); transition: box-shadow var(--sx-slow), border-color var(--sx-slow); }
    .ficha.completa { border-color: var(--sx-accent); box-shadow: var(--sx-glow); }
    .ficha-cab b { display: block; font-size: 20px; } .ficha-cab small { color: var(--sx-muted); font-size: 12.5px; }
    dl { margin: 14px 0 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    dl div { padding: 10px 12px; border-radius: 12px; background: var(--sx-card); border: 1px dashed var(--sx-border-strong); opacity: 0.35; transition: opacity var(--sx-med), border-color var(--sx-med); }
    dl div.on { opacity: 1; border-style: solid; border-color: var(--sx-border); animation: aparece 500ms var(--sx-ease); }
    dt { font-size: 12px; color: var(--sx-muted); } dd { margin: 2px 0 0; font: 700 18px var(--sx-font); }
    @keyframes aparece { from { transform: scale(0.96); } }
    .hips { display: flex; flex-direction: column; gap: 8px; margin: 6px 0 10px; }
    .hip { display: flex; gap: 12px; align-items: center; padding: 12px 14px; border-radius: 14px; background: var(--sx-card); border: 1px solid var(--sx-border); }
    .hip > span { font-size: 22px; }
    .hip b { display: block; font-size: 15.5px; } .hip small { font-size: 13px; color: var(--sx-muted); }
    .hip[data-v='no'] > span { color: var(--sx-danger); } .hip[data-v='parcial'] > span { color: var(--sx-warning); } .hip[data-v='si'] > span { color: var(--sx-success); }
    @media (max-width: 640px) { .ficha-env { grid-template-columns: 1fr; } .fuentes { flex-direction: row; overflow-x: auto; } .fuentes li { flex: none; } .fuentes li.on { transform: none; } }
    @media (prefers-reduced-motion: reduce) { dl div.on { animation: none; } }`,
})
export class CapExploracion {
  private datos = inject(DatosEstudio);
  protected fuentes = FUENTES;
  protected titulos = FUENTES.map(f => f.titulo);
  protected paso = signal(0);
  protected n = num;
  protected r = computed(() => this.datos.estudio()?.resumen);
  protected quibdo = computed(() => this.datos.estudio()?.municipios.lista.find(m => m.cod === '27001') ?? null);
  protected corr = computed(() => {
    const m = this.datos.estudio()?.municipios.lista ?? [];
    return pearson(m.map(x => x.puntaje), m.map(x => x.ipm));
  });
  protected hipotesis = computed(() => (this.datos.estudio()?.hipotesis ?? []).map(h => {
    const v = h.veredicto.startsWith('Parcial') ? 'parcial' : h.veredicto.startsWith('No') ? 'no' : 'si';
    return { ...h, v, etiqueta: v === 'no' ? 'Los datos no la apoyan' : v === 'parcial' ? 'Los datos la apoyan en parte' : 'Los datos la apoyan' };
  }));

  constructor() { this.datos.cargar(); }
}
