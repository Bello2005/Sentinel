// Controles de las animaciones "paso a paso" del artículo. Cuando la figura entra en pantalla avanza sola
// (salvo con prefers-reduced-motion); si la persona toca un control, toma el mando y la reproducción se detiene.
import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, model, signal } from '@angular/core';

@Component({
  selector: 'sx-pasos',
  template: `
    <div class="pasos">
      <button class="ctl" (click)="anterior()" [disabled]="paso() === 0" aria-label="Paso anterior"><span class="material-symbols-rounded">chevron_left</span></button>
      <button class="ctl play" (click)="alternar()" [attr.aria-label]="reproduciendo() ? 'Pausar' : (final() ? 'Ver de nuevo' : 'Reproducir')">
        <span class="material-symbols-rounded">{{ reproduciendo() ? 'pause' : (final() ? 'replay' : 'play_arrow') }}</span></button>
      <button class="ctl" (click)="siguiente()" [disabled]="final()" aria-label="Paso siguiente"><span class="material-symbols-rounded">chevron_right</span></button>
      <div class="puntos" role="group" aria-label="Ir a un paso">
        @for (i of indices(); track i) {
          <button [class.sel]="i === paso()" [class.hecho]="i < paso()" (click)="ir(i)" [attr.aria-label]="'Paso ' + (i + 1) + (etiquetas()[i] ? ': ' + etiquetas()[i] : '')"
                  [attr.aria-current]="i === paso() ? 'step' : null"></button>
        }
      </div>
      <span class="texto" aria-live="polite">Paso {{ paso() + 1 }} de {{ total() }}@if (etiquetas()[paso()]) {<b> · {{ etiquetas()[paso()] }}</b>}</span>
    </div>`,
  styles: `
    .pasos { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .ctl { width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--sx-border); background: var(--sx-card); color: var(--sx-text); cursor: pointer;
      display: grid; place-items: center; transition: border-color var(--sx-fast), background var(--sx-fast), opacity var(--sx-fast); }
    .ctl:hover:not(:disabled) { border-color: var(--sx-accent); }
    .ctl:disabled { opacity: 0.35; cursor: default; }
    .ctl.play { background: var(--sx-accent); color: var(--sx-accent-ink); border-color: transparent; }
    .puntos { display: flex; gap: 6px; margin: 0 6px; }
    .puntos button { width: 8px; height: 8px; padding: 0; border-radius: 99px; border: 0; background: var(--sx-border-strong); cursor: pointer;
      transition: width var(--sx-med) var(--sx-ease), background var(--sx-med); }
    .puntos button.hecho { background: color-mix(in srgb, var(--sx-accent) 50%, transparent); }
    .puntos button.sel { width: 22px; background: var(--sx-accent); }
    .texto { font-size: 13px; color: var(--sx-muted); } .texto b { color: var(--sx-text); font-weight: 600; }`,
})
export class Pasos {
  readonly total = input.required<number>();
  readonly etiquetas = input<string[]>([]);
  readonly intervalo = input(3400);
  readonly paso = model(0);

  protected reproduciendo = signal(false);
  protected final = computed(() => this.paso() >= this.total() - 1);
  protected indices = computed(() => Array.from({ length: this.total() }, (_, i) => i));
  private reloj?: ReturnType<typeof setInterval>;
  private tocado = false;
  private el = inject(ElementRef<HTMLElement>);

  constructor() {
    afterNextRender(() => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
      // Observa la figura completa (el padre), no solo la barra de controles
      const figura = (this.el.nativeElement as HTMLElement).closest('figure') ?? this.el.nativeElement;
      const obs = new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !this.tocado && !this.final()) this.iniciar();
        else if (!e.isIntersecting) this.detener();
      }, { threshold: 0.45 });
      obs.observe(figura);
      this.limpiar = () => obs.disconnect();
    });
    inject(DestroyRef).onDestroy(() => { this.detener(); this.limpiar(); });
  }
  private limpiar = () => {};

  private iniciar() {
    this.detener();
    this.reproduciendo.set(true);
    this.reloj = setInterval(() => {
      if (this.final()) { this.detener(); return; }
      this.paso.update(p => p + 1);
    }, this.intervalo());
  }
  private detener() { clearInterval(this.reloj); this.reproduciendo.set(false); }

  alternar() {
    this.tocado = true;
    if (this.reproduciendo()) { this.detener(); return; }
    if (this.final()) this.paso.set(0);
    this.iniciar();
  }
  anterior() { this.tocado = true; this.detener(); this.paso.update(p => Math.max(0, p - 1)); }
  siguiente() { this.tocado = true; this.detener(); this.paso.update(p => Math.min(this.total() - 1, p + 1)); }
  ir(i: number) { this.tocado = true; this.detener(); this.paso.set(i); }
}
