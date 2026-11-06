// GLOSARIO PÚBLICO: cada palabra difícil del estudio, explicada con un ejemplo. Se puede buscar, filtrar por tema,
// agrandar la letra y llegar directo a un término con /glosario#id (desde los enlaces de la landing y del artículo).
import { Location } from '@angular/common';
import { Component, ElementRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Cabecera } from '../publico/cabecera';
import { Revelar } from '../landing/revelar';
import { CATEGORIAS, TERMINOS, Termino, normalizar, termino } from './terminos';

@Component({
  selector: 'sx-glosario',
  imports: [Cabecera, RouterLink, Revelar],
  templateUrl: './glosario.html',
  styleUrl: './glosario.scss',
  host: { '[class.letra-grande]': 'letraGrande()' },
})
export class Glosario {
  private ruta = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private el = inject(ElementRef<HTMLElement>);

  protected categorias = CATEGORIAS;
  protected termino = termino;
  protected busqueda = signal('');
  protected categoria = signal<string | null>(null);
  protected destacado = signal<string | null>(null);
  protected letraGrande = signal(leerLetra());
  /** Si se llegó desde otra página del sitio, "Volver" regresa justo a donde estaba. Al crear el componente la navegación
   *  hacia el glosario aún no termina: si ya hubo una navegación completa antes, se vino de otra página de la app. */
  protected desdeElSitio = !!this.router.lastSuccessfulNavigation;

  private fragmento = toSignal(this.ruta.fragment, { initialValue: null });

  protected filtrados = computed(() => {
    const q = normalizar(this.busqueda()), cat = this.categoria();
    return TERMINOS.filter(t => (!cat || t.categoria === cat) &&
      (!q || [t.termino, t.corto, t.texto, ...(t.alias ?? [])].some(x => normalizar(x).includes(q))));
  });
  protected grupos = computed(() => CATEGORIAS
    .map(c => ({ ...c, terminos: this.filtrados().filter(t => t.categoria === c.id).sort((a, b) => a.termino.localeCompare(b.termino, 'es')) }))
    .filter(g => g.terminos.length));
  protected cuenta = (id: string) => TERMINOS.filter(t => t.categoria === id).length;
  protected total = TERMINOS.length;

  constructor() {
    // Llegar a /glosario#id: limpia filtros, baja hasta el término y lo resalta un momento
    effect(() => {
      const id = this.fragmento();
      if (!id || !termino(id)) return;
      untracked(() => { this.busqueda.set(''); this.categoria.set(null); });
      setTimeout(() => this.irA(id), 60);
    });
  }

  irA(id: string, ev?: Event) {
    ev?.preventDefault();
    const nodo = (this.el.nativeElement as HTMLElement).querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!nodo) return;
    nodo.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    nodo.focus({ preventScroll: true });
    this.destacado.set(null);
    requestAnimationFrame(() => this.destacado.set(id));
    if (ev) history.replaceState(history.state, '', `/glosario#${id}`);
  }

  volver() { if (this.desdeElSitio) this.location.back(); else this.router.navigateByUrl('/'); }

  alternarLetra() {
    const v = !this.letraGrande();
    this.letraGrande.set(v);
    try { localStorage.setItem('sx-letra-grande', v ? '1' : '0'); } catch { /* sin almacenamiento */ }
  }

  protected relacionados(t: Termino) { return (t.ver ?? []).map(id => termino(id)).filter((x): x is Termino => !!x); }
}

function leerLetra() { try { return localStorage.getItem('sx-letra-grande') === '1'; } catch { return false; } }
