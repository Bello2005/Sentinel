// Componentes base del sistema de diseño SENTINEL.
import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, input, output, signal } from '@angular/core';

import { estadoTexto, estadoTono, num } from '../core/formato';

/** Número que se anima hasta su valor (respeta prefers-reduced-motion). */
@Component({
  selector: 'sx-contador',
  template: `{{ texto() }}`,
  host: { class: 'mono-num', '[attr.aria-label]': 'final()' },
  styles: `:host { font-variant-numeric: tabular-nums; }`,
})
export class Contador {
  readonly valor = input<number | null>(null);
  readonly decimales = input(0);
  readonly sufijo = input('');
  private actual = signal(0);
  protected final = computed(() => this.valor() === null ? '—' : num(this.valor()!, this.decimales()) + this.sufijo());
  protected texto = computed(() => this.valor() === null ? '—' : num(this.actual(), this.decimales()) + this.sufijo());

  constructor() {
    effect(onCleanup => {
      const fin = this.valor();
      if (fin === null) return;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { this.actual.set(fin); return; }
      const inicio = this.actual(), t0 = performance.now(), dur = 900;
      let raf = 0;
      const paso = (t: number) => {
        const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        this.actual.set(inicio + (fin - inicio) * e);
        if (p < 1) raf = requestAnimationFrame(paso);
      };
      raf = requestAnimationFrame(paso);
      onCleanup(() => cancelAnimationFrame(raf));
    });
  }
}

/** Tarjeta de indicador: etiqueta, valor animado, detalle y una mini gráfica opcional (contenido proyectado). */
@Component({
  selector: 'sx-kpi',
  imports: [Contador],
  template: `
    <div class="cabeza">
      <span class="sx-eyebrow">{{ etiqueta() }}</span>
      @if (icono()) { <span class="material-symbols-rounded icono" aria-hidden="true">{{ icono() }}</span> }
    </div>
    <div class="valor">
      @if (texto()) { {{ texto() }} } @else { <sx-contador [valor]="valor()" [decimales]="decimales()" [sufijo]="sufijo()" /> }
    </div>
    @if (detalle()) { <div class="detalle">{{ detalle() }}</div> }
    <ng-content />`,
  host: { class: 'sx-card interactive', '[attr.data-tono]': 'tono()' },
  styles: `
    :host { display: flex; flex-direction: column; gap: 6px; position: relative; overflow: hidden; min-height: 132px; }
    :host::after { content: ''; position: absolute; inset: auto -30% -60% auto; width: 160px; height: 160px; border-radius: 50%;
                   background: radial-gradient(circle, color-mix(in srgb, var(--k) 22%, transparent), transparent 70%); pointer-events: none; }
    :host { --k: var(--sx-accent); }
    :host([data-tono=ok]) { --k: var(--sx-success); } :host([data-tono=warn]) { --k: var(--sx-warning); }
    :host([data-tono=bad]) { --k: var(--sx-danger); } :host([data-tono=candidate]) { --k: var(--sx-candidate); }
    :host([data-tono=active]) { --k: var(--sx-active); }
    .cabeza { display: flex; justify-content: space-between; align-items: center; }
    .icono { color: var(--k); font-size: 20px; }
    .valor { font-size: 30px; font-weight: 650; letter-spacing: -0.03em; line-height: 1.1; }
    .detalle { color: var(--sx-muted); font-size: 12.5px; }`,
})
export class Kpi {
  readonly etiqueta = input.required<string>();
  readonly valor = input<number | null>(null);
  readonly texto = input<string | null>(null);
  readonly decimales = input(0);
  readonly sufijo = input('');
  readonly icono = input<string>('');
  readonly detalle = input<string>('');
  readonly tono = input<'accent' | 'ok' | 'warn' | 'bad' | 'candidate' | 'active'>('accent');
}

/** Estado (validación o versión) como píldora con punto de color. */
@Component({
  selector: 'sx-estado',
  template: `<span class="sx-pill" [class]="tono()"><span class="sx-dot" [class.pulse]="pulso()"></span>{{ texto() }}</span>`,
})
export class Estado {
  readonly estado = input.required<string>();
  readonly pulso = input(false);
  protected texto = computed(() => estadoTexto[this.estado()] ?? this.estado());
  protected tono = computed(() => 'sx-pill ' + (estadoTono[this.estado()] ?? ''));
}

/** Anillo de puntaje 0-100 (salud de datos, cobertura…). */
@Component({
  selector: 'sx-anillo',
  template: `
    <svg viewBox="0 0 120 120" [attr.width]="tamano()" [attr.height]="tamano()" role="img" [attr.aria-label]="etiqueta() + ': ' + (valor() ?? 'sin dato')">
      <circle cx="60" cy="60" r="50" class="fondo" />
      <circle cx="60" cy="60" r="50" class="arco" [style.stroke]="color()" [style.stroke-dashoffset]="offset()" />
      <text x="60" y="58" text-anchor="middle" class="num">{{ valor() ?? '—' }}</text>
      <text x="60" y="78" text-anchor="middle" class="lbl">{{ etiqueta() }}</text>
    </svg>`,
  styles: `
    :host { display: inline-block; }
    circle { fill: none; stroke-width: 9; }
    .fondo { stroke: var(--sx-border-strong); }
    .arco { stroke-linecap: round; stroke-dasharray: 314.16; transform: rotate(-90deg); transform-origin: center;
            transition: stroke-dashoffset 1s var(--sx-ease), stroke 0.4s; filter: drop-shadow(0 0 6px currentColor); }
    .num { fill: var(--sx-text); font: 650 28px Inter, sans-serif; }
    .lbl { fill: var(--sx-muted); font: 600 9px Inter, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; }`,
})
export class Anillo {
  readonly valor = input<number | null>(null);
  readonly etiqueta = input('Salud');
  readonly tamano = input(132);
  protected offset = computed(() => 314.16 * (1 - (this.valor() ?? 0) / 100));
  protected color = computed(() => {
    const v = this.valor() ?? 0;
    return v >= 85 ? 'var(--sx-success)' : v >= 60 ? 'var(--sx-warning)' : 'var(--sx-danger)';
  });
}

/** Zona para arrastrar y soltar un CSV. También se abre con teclado (Enter o Espacio). */
@Component({
  selector: 'sx-zona-archivo',
  template: `
    <div class="zona" role="button" tabindex="0" [class.encima]="encima()" [class.con-archivo]="!!archivo()"
         [attr.aria-label]="archivo() ? 'Archivo ' + archivo()!.name + '. Pulse para cambiarlo' : 'Seleccione o arrastre un archivo CSV'"
         (click)="input.click()" (keydown.enter)="input.click()" (keydown.space)="$event.preventDefault(); input.click()"
         (dragover)="$event.preventDefault(); encima.set(true)" (dragleave)="encima.set(false)" (drop)="soltar($event)">
      <div class="orbita" aria-hidden="true"><span class="material-symbols-rounded">{{ archivo() ? 'description' : 'upload_file' }}</span></div>
      @if (archivo(); as a) {
        <div class="titulo">{{ a.name }}</div>
        <div class="sx-muted">{{ (a.size / 1024) | number: '1.0-0' }} KB · listo · pulse para cambiarlo</div>
      } @else {
        <div class="titulo">{{ titulo() }}</div>
        <div class="sx-muted">{{ ayuda() }}</div>
      }
      <input #input type="file" accept=".csv,text/csv" hidden (change)="elegir(input)" />
    </div>`,
  imports: [DecimalPipe],
  styles: `
    .zona { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-align: center;
            min-height: 210px; padding: 28px; border-radius: var(--sx-radius-lg); cursor: pointer; overflow: hidden;
            border: 1.5px dashed var(--sx-border-strong); transition: all var(--sx-med) var(--sx-ease);
            background: radial-gradient(600px 200px at 50% 0%, var(--sx-aurora-1), transparent), var(--sx-card); }
    .zona:hover, .zona.encima { border-color: var(--sx-accent); box-shadow: var(--sx-glow); transform: translateY(-1px); }
    .zona.encima .orbita { transform: scale(1.12); }
    .zona.con-archivo { border-style: solid; border-color: color-mix(in srgb, var(--sx-success) 50%, transparent); }
    .orbita { width: 64px; height: 64px; border-radius: 20px; display: grid; place-items: center; margin-bottom: 6px;
              background: linear-gradient(135deg, color-mix(in srgb, var(--sx-accent) 22%, transparent), color-mix(in srgb, var(--sx-candidate) 22%, transparent));
              border: 1px solid var(--sx-border-strong); transition: transform var(--sx-med) var(--sx-ease); }
    .orbita span { font-size: 30px; color: var(--sx-accent); }
    .titulo { font-weight: 650; font-size: 16px; }`,
})
export class ZonaArchivo {
  readonly archivo = input<File | null>(null);
  readonly titulo = input('Arrastre su dataset aquí');
  readonly ayuda = input('CSV separado por comas o punto y coma · o pulse para elegirlo');
  readonly elegido = output<File>();
  protected encima = signal(false);

  soltar(e: DragEvent) {
    e.preventDefault();
    this.encima.set(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) this.elegido.emit(f);
  }
  elegir(input: HTMLInputElement) {
    const f = input.files?.[0];
    if (f) this.elegido.emit(f);
    input.value = '';
  }
}

/** Estado vacío elegante con acción proyectada. */
@Component({
  selector: 'sx-vacio',
  template: `
    <div class="halo" aria-hidden="true"><span class="material-symbols-rounded">{{ icono() }}</span></div>
    <h3>{{ titulo() }}</h3>
    <p class="sx-muted">{{ texto() }}</p>
    <div class="acciones"><ng-content /></div>`,
  host: { class: 'sx-card' },
  styles: `
    :host { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 48px 24px; }
    .halo { width: 72px; height: 72px; border-radius: 50%; display: grid; place-items: center; margin-bottom: 8px;
            background: radial-gradient(circle, color-mix(in srgb, var(--sx-accent) 20%, transparent), transparent 70%); }
    .halo span { font-size: 34px; color: var(--sx-accent); }
    p { max-width: 460px; margin: 0; } .acciones { margin-top: 12px; display: flex; gap: 8px; }`,
})
export class Vacio {
  readonly icono = input('inbox');
  readonly titulo = input.required<string>();
  readonly texto = input('');
}
