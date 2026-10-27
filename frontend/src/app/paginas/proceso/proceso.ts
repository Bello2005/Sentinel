// ARTÍCULO "CÓMO LO HICIMOS": el proceso completo, del análisis de los datos hasta este sitio, en capítulos cortos.
// Cada capítulo es un componente con sus figuras animadas; aquí viven la navegación, el progreso de lectura y los
// estilos de prosa compartidos (sin encapsulación, todos bajo .art).
import { Component, DestroyRef, ElementRef, ViewEncapsulation, afterNextRender, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { Cabecera } from '../publico/cabecera';
import { CAPITULOS, MINUTOS_TOTALES } from './capitulos';
import { CapCausas } from './cap-causas';
import { CapCierre } from './cap-cierre';
import { CapDatos } from './cap-datos';
import { CapExploracion } from './cap-exploracion';
import { CapGobierno } from './cap-gobierno';
import { CapLimpieza } from './cap-limpieza';
import { CapModelo } from './cap-modelo';
import { CapPlataforma } from './cap-plataforma';
import { CapPregunta } from './cap-pregunta';

@Component({
  selector: 'sx-proceso',
  imports: [Cabecera, RouterLink, CapPregunta, CapDatos, CapLimpieza, CapExploracion, CapCausas, CapModelo, CapPlataforma, CapGobierno, CapCierre],
  templateUrl: './proceso.html',
  styleUrl: './proceso.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'sx-proceso', '(window:scroll)': 'alDesplazar()' },
})
export class Proceso {
  /** Viene del parámetro de la ruta /proceso/:capitulo */
  readonly capitulo = input<string>('pregunta');

  private router = inject(Router);
  private el = inject(ElementRef<HTMLElement>);
  protected capitulos = CAPITULOS;
  protected minutosTotales = MINUTOS_TOTALES;
  protected indice = computed(() => Math.max(0, CAPITULOS.findIndex(c => c.id === this.capitulo())));
  protected cap = computed(() => CAPITULOS[this.indice()]);
  protected anterior = computed(() => CAPITULOS[this.indice() - 1] ?? null);
  protected siguiente = computed(() => CAPITULOS[this.indice() + 1] ?? null);
  protected progreso = signal(0);
  protected leidos = signal<Set<string>>(leerLeidos());
  protected menuCapitulos = signal(false);

  constructor() {
    // Un capítulo que no existe vuelve al primero
    effect(() => { if (!CAPITULOS.some(c => c.id === this.capitulo())) this.router.navigate(['/proceso', 'pregunta'], { replaceUrl: true }); });
    effect(() => { this.capitulo(); this.menuCapitulos.set(false); this.progreso.set(0); });

    // El capítulo cuenta como leído cuando se llega a su final
    afterNextRender(() => {
      const fin = (this.el.nativeElement as HTMLElement).querySelector('.art-fin');
      if (!fin || !('IntersectionObserver' in window)) return;
      const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) this.marcarLeido(this.cap().id); });
      obs.observe(fin);
      this.desconectar = () => obs.disconnect();
    });
    inject(DestroyRef).onDestroy(() => this.desconectar());
  }
  private desconectar = () => {};

  alDesplazar() {
    const h = document.documentElement;
    this.progreso.set(Math.min(1, h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)));
  }

  private marcarLeido(id: string) {
    if (this.leidos().has(id)) return;
    const s = new Set(this.leidos()).add(id);
    this.leidos.set(s);
    try { localStorage.setItem('sx-capitulos-leidos', JSON.stringify([...s])); } catch { /* sin almacenamiento */ }
  }
}

function leerLeidos(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem('sx-capitulos-leidos') ?? '[]')); } catch { return new Set(); }
}
