// Paleta de comandos (Ctrl/⌘ + K): navegar, cambiar el tema o lanzar acciones sin el mouse.
import { A11yModule } from '@angular/cdk/a11y';
import { Component, ElementRef, computed, inject, output, signal, viewChild, afterNextRender } from '@angular/core';
import { Router } from '@angular/router';

import { SentinelStore } from '../core/store';
import { Tema } from '../core/tema';
import { DESTINOS } from './navegacion';

interface Comando { titulo: string; detalle: string; icono: string; grupo: string; accion: () => void }

@Component({
  selector: 'sx-paleta',
  imports: [A11yModule],
  template: `
    <div class="velo" (click)="cerrar.emit()"></div>
    <div class="caja sx-glass" role="dialog" aria-modal="true" aria-label="Paleta de comandos" cdkTrapFocus>
      <div class="buscar">
        <span class="material-symbols-rounded" aria-hidden="true">search</span>
        <input #campo [value]="texto()" (input)="texto.set(campo.value); activo.set(0)" (keydown)="teclas($event)"
               placeholder="Buscar páginas y acciones…" aria-label="Buscar comandos" role="combobox" aria-expanded="true"
               aria-controls="sx-comandos" [attr.aria-activedescendant]="'cmd-' + activo()" />
        <kbd>Esc</kbd>
      </div>
      <ul id="sx-comandos" role="listbox">
        @for (c of filtrados(); track c.titulo; let i = $index) {
          @if (i === 0 || filtrados()[i - 1].grupo !== c.grupo) { <li class="grupo" role="presentation">{{ c.grupo }}</li> }
          <li [id]="'cmd-' + i" role="option" [attr.aria-selected]="i === activo()" [class.activo]="i === activo()"
              (mouseenter)="activo.set(i)" (click)="ejecutar(c)">
            <span class="material-symbols-rounded" aria-hidden="true">{{ c.icono }}</span>
            <span class="t">{{ c.titulo }}</span><span class="d">{{ c.detalle }}</span>
          </li>
        } @empty { <li class="nada">Sin resultados para “{{ texto() }}”</li> }
      </ul>
      <div class="pie"><span><kbd>↑</kbd><kbd>↓</kbd> moverse</span><span><kbd>↵</kbd> ejecutar</span><span>SENTINEL</span></div>
    </div>`,
  styles: `
    :host { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: start center; padding-top: 12vh; }
    .velo { position: absolute; inset: 0; background: rgba(5, 8, 18, 0.55); backdrop-filter: blur(3px); animation: sx-rise 160ms ease both; }
    .caja { position: relative; width: min(640px, calc(100vw - 32px)); border-radius: var(--sx-radius-lg); box-shadow: var(--sx-shadow-lift), var(--sx-glow);
            overflow: hidden; animation: sx-pop 220ms var(--sx-ease) both; }
    .buscar { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--sx-border); }
    .buscar input { flex: 1; background: none; border: 0; outline: none; color: var(--sx-text); font: 16px var(--sx-font); }
    ul { list-style: none; margin: 0; padding: 8px; max-height: 50vh; overflow: auto; }
    li { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; cursor: pointer; }
    li.activo { background: color-mix(in srgb, var(--sx-accent) 14%, transparent); }
    li.activo .material-symbols-rounded { color: var(--sx-accent); }
    li .t { font-weight: 600; } li .d { color: var(--sx-muted); font-size: 12.5px; margin-left: auto; }
    .grupo { padding: 10px 12px 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sx-faint); cursor: default; }
    .nada { color: var(--sx-muted); justify-content: center; cursor: default; }
    .pie { display: flex; gap: 16px; padding: 10px 16px; border-top: 1px solid var(--sx-border); color: var(--sx-faint); font-size: 12px; }
    .pie span:last-child { margin-left: auto; letter-spacing: 0.1em; }
    kbd { font: 11px var(--sx-mono); padding: 2px 6px; border-radius: 6px; border: 1px solid var(--sx-border-strong); color: var(--sx-muted); margin-right: 4px; }`,
})
export class Paleta {
  readonly cerrar = output<void>();
  private router = inject(Router);
  private tema = inject(Tema);
  private store = inject(SentinelStore);
  private campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');
  protected texto = signal('');
  protected activo = signal(0);

  private comandos = computed<Comando[]>(() => [
    ...DESTINOS.map(d => ({ titulo: d.titulo, detalle: d.descripcion, icono: d.icono, grupo: 'Ir a', accion: () => this.router.navigateByUrl(d.ruta) })),
    { titulo: 'Cambiar tema', detalle: this.tema.modo() === 'dark' ? 'Pasar a modo claro' : 'Pasar a modo oscuro', icono: 'contrast', grupo: 'Acciones', accion: () => this.tema.alternar() },
    { titulo: 'Actualizar estado', detalle: 'Volver a consultar la API y el modelo', icono: 'refresh', grupo: 'Acciones', accion: () => this.store.cargarModelo() },
    ...(this.store.archivo() ? [
      { titulo: 'Validar dataset en sesión', detalle: this.store.archivo()!.name, icono: 'fact_check', grupo: 'Acciones',
        accion: () => { this.router.navigateByUrl('/validacion'); this.store.validar(); } },
      { titulo: 'Ejecutar EDA', detalle: this.store.archivo()!.name, icono: 'travel_explore', grupo: 'Acciones',
        accion: () => { this.router.navigateByUrl('/observatorio'); this.store.analizar(); } },
    ] : []),
    ...this.store.candidatas().map(c => ({ titulo: `Revisar ${c.id}`, detalle: 'Candidata pendiente de decisión', icono: 'gavel', grupo: 'Gobierno',
                                           accion: () => this.router.navigate(['/decision'], { queryParams: { v: c.id } }) })),
  ]);
  protected filtrados = computed(() => {
    const q = this.texto().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    return this.comandos().filter(c => !q || norm(c.titulo + ' ' + c.detalle).includes(q));
  });

  constructor() { afterNextRender(() => this.campo().nativeElement.focus()); }

  teclas(e: KeyboardEvent) {
    const n = this.filtrados().length;
    if (e.key === 'ArrowDown') { this.activo.set((this.activo() + 1) % Math.max(n, 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { this.activo.set((this.activo() - 1 + n) % Math.max(n, 1)); e.preventDefault(); }
    else if (e.key === 'Enter' && n) { this.ejecutar(this.filtrados()[this.activo()]); }
    else if (e.key === 'Escape') { this.cerrar.emit(); }
  }
  ejecutar(c: Comando) { this.cerrar.emit(); c.accion(); }
}
