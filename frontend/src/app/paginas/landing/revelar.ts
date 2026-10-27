// Revela un bloque cuando entra en pantalla (una sola vez). Con prefers-reduced-motion aparece sin animación.
// Los hijos con la clase .sx-r-hijo entran escalonados.
import { Directive, ElementRef, OnDestroy, afterNextRender, inject, output } from '@angular/core';

@Directive({ selector: '[sxRevelar]', host: { class: 'sx-revelar' } })
export class Revelar implements OnDestroy {
  /** Avisa cuando el bloque se ve por primera vez (para arrancar contadores o animaciones propias) */
  readonly visible = output<void>();
  private el = inject(ElementRef<HTMLElement>);
  private obs?: IntersectionObserver;

  constructor() {
    afterNextRender(() => {
      const nodo = this.el.nativeElement as HTMLElement;
      if (!('IntersectionObserver' in window)) { this.mostrar(nodo); return; }
      this.obs = new IntersectionObserver(entradas => {
        if (entradas.some(e => e.isIntersecting)) { this.mostrar(nodo); this.obs?.disconnect(); }
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
      this.obs.observe(nodo);
    });
  }

  private mostrar(nodo: HTMLElement) {
    nodo.querySelectorAll<HTMLElement>('.sx-r-hijo').forEach((h, i) => h.style.setProperty('--sx-r-i', String(i)));
    nodo.classList.add('sx-visible');
    this.visible.emit();
  }

  ngOnDestroy() { this.obs?.disconnect(); }
}
