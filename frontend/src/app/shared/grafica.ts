// Envoltorio de ApexCharts: aplica los tokens de diseño (colores, fuente, rejilla) y se redibuja al cambiar de tema.
import { Component, ElementRef, OnDestroy, effect, inject, input, untracked, viewChild } from '@angular/core';
import ApexCharts, { ApexOptions } from 'apexcharts';

import { Tema } from '../core/tema';

@Component({
  selector: 'sx-grafica',
  template: `<div #lienzo role="img" [attr.aria-label]="etiqueta()"></div>`,
  // min-width: 0 evita que la gráfica ensanche su tarjeta (y la página) dentro de un grid
  styles: `:host { display: block; min-height: 40px; min-width: 0; width: 100%; overflow: hidden; }`,
})
export class Grafica implements OnDestroy {
  readonly opciones = input.required<ApexOptions>();
  readonly alto = input<number | string>(260);
  readonly etiqueta = input('Gráfica');
  private lienzo = viewChild.required<ElementRef<HTMLElement>>('lienzo');
  private tema = inject(Tema);
  private grafica?: ApexCharts;

  constructor() {
    effect(() => {
      const opciones = this.opciones(), modo = this.tema.modo(), alto = this.alto();
      untracked(() => this.dibujar(opciones, modo, alto));
    });
  }

  private dibujar(o: ApexOptions, modo: string, alto: number | string) {
    this.grafica?.destroy();
    const t = (n: string) => this.tema.token(n);
    const base: ApexOptions = {
      chart: { height: alto, background: 'transparent', foreColor: t('muted'), fontFamily: 'Inter, sans-serif',
               toolbar: { show: false }, animations: { enabled: true, speed: 500 }, parentHeightOffset: 0, ...o.chart } as ApexOptions['chart'],
      theme: { mode: modo as 'dark' | 'light' },
      colors: o.colors ?? [t('accent'), t('candidate'), t('active'), t('success'), t('warning')],
      grid: { borderColor: t('border'), strokeDashArray: 4, ...o.grid },
      dataLabels: { enabled: false, ...o.dataLabels },
      tooltip: { theme: modo, ...o.tooltip },
      legend: { labels: { colors: t('muted') }, ...o.legend },
      stroke: { width: 2, curve: 'smooth', ...o.stroke },
    };
    this.grafica = new ApexCharts(this.lienzo().nativeElement, { ...o, ...base });
    this.grafica.render();
  }

  ngOnDestroy() { this.grafica?.destroy(); }
}
