// Modo claro/oscuro. La clase se aplica en <html> (index.html ya la pone antes de pintar para evitar el destello).
import { Injectable, signal } from '@angular/core';

export type Modo = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class Tema {
  readonly modo = signal<Modo>(document.documentElement.classList.contains('light') ? 'light' : 'dark');

  alternar() {
    const modo: Modo = this.modo() === 'dark' ? 'light' : 'dark';
    const aplicar = () => {
      document.documentElement.classList.toggle('light', modo === 'light');
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', modo === 'light' ? '#f5f7fb' : '#0b1020');
      this.modo.set(modo);
    };
    // Transición suave entre temas cuando el navegador lo permite
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && document.visibilityState === 'visible') {
      try { doc.startViewTransition(aplicar); } catch { aplicar(); }
    } else {
      aplicar();
    }
    try { localStorage.setItem('sx-tema', modo); } catch { /* sin almacenamiento */ }
  }

  /** Valor actual de un token de diseño (--sx-*), para las gráficas */
  token(nombre: string) {
    return getComputedStyle(document.documentElement).getPropertyValue(`--sx-${nombre}`).trim();
  }
}
