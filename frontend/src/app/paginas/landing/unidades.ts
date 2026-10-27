// Gráfico de unidades: "de cada 100 estudiantes…". Cada cuadro es un estudiante; se llenan en cascada al verse.
import { Component, computed, input } from '@angular/core';

export interface Grupo { etiqueta: string; pct: number; color: string }

@Component({
  selector: 'sx-unidades',
  template: `
    <div class="cuadricula" role="img" [attr.aria-label]="resumen()" [class.activo]="activo()">
      @for (c of celdas(); track $index) { <i [style.background]="c.color" [style.transition-delay.ms]="$index * 9"></i> }
    </div>
    <ul class="leyenda">
      @for (g of grupos(); track g.etiqueta) { <li><i [style.background]="g.color"></i><b>{{ redondo(g.pct) }}</b> {{ g.etiqueta }}</li> }
    </ul>`,
  styles: `
    :host { display: block; }
    .cuadricula { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; max-width: 280px; }
    .cuadricula i { aspect-ratio: 1; border-radius: 4px; opacity: 0.12; transform: scale(0.6); transition: opacity 400ms var(--sx-ease), transform 400ms var(--sx-ease); }
    .cuadricula.activo i { opacity: 1; transform: none; }
    .leyenda { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--sx-muted); }
    .leyenda li { display: flex; align-items: center; gap: 8px; } .leyenda i { width: 12px; height: 12px; border-radius: 3px; }
    .leyenda b { color: var(--sx-text); font: 700 14px var(--sx-mono); min-width: 24px; }
    @media (prefers-reduced-motion: reduce) { .cuadricula i { opacity: 1; transform: none; } }`,
})
export class Unidades {
  readonly grupos = input.required<Grupo[]>();
  readonly resto = input('var(--sx-border-strong)');
  readonly activo = input(false);
  protected redondo = (x: number) => Math.round(x);
  protected celdas = computed(() => {
    const out: { color: string }[] = [];
    for (const g of this.grupos()) for (let k = 0; k < Math.round(g.pct) && out.length < 100; k++) out.push({ color: g.color });
    while (out.length < 100) out.push({ color: this.resto() });
    return out;
  });
  protected resumen = computed(() => 'De cada 100 estudiantes: ' + this.grupos().map(g => `${Math.round(g.pct)} ${g.etiqueta}`).join(', '));
}
