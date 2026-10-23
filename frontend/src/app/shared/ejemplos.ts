// Menú "Cargar ejemplo": los escenarios de prueba obligatorios (sistema-web/pruebas, servidos en /demo) a un clic.
import { Component, inject, input, output } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatMenuModule } from '@angular/material/menu';
import { firstValueFrom } from 'rxjs';

export interface Ejemplo { archivo: string; titulo: string; detalle: string; icono: string }

export const EJEMPLOS_PREDICCION: Ejemplo[] = [
  { archivo: '01_compatible.csv', titulo: 'Compatible', detalle: '155 unidades de Chocó', icono: 'check_circle' },
  { archivo: '06_columnas_adicionales.csv', titulo: 'Columnas adicionales', detalle: 'Compatible con advertencias', icono: 'add_circle' },
  { archivo: '02_falta_variable.csv', titulo: 'Falta una variable', detalle: 'Sin promedio_3', icono: 'remove_circle' },
  { archivo: '03_tipo_incompatible.csv', titulo: 'Tipo incompatible', detalle: 'Texto en un puntaje', icono: 'data_object' },
  { archivo: '04_faltantes.csv', titulo: 'Valores faltantes', detalle: 'Vacíos en puntaje_anterior', icono: 'water_drop' },
  { archivo: '05_categoria_nueva.csv', titulo: 'Categoría nueva', detalle: 'tipo_unidad = departamento', icono: 'category' },
  { archivo: '09_reglas_de_dominio.csv', titulo: 'Reglas de dominio', detalle: 'Fuera de rango y duplicado', icono: 'straighten' },
  { archivo: '07_solo_eda.csv', titulo: 'Solo para EDA', detalle: 'Incompatible, pero analizable', icono: 'travel_explore' },
];
export const EJEMPLOS_ENTRENAMIENTO: Ejemplo[] = [
  { archivo: '08_novedades_2022_etiquetadas.csv', titulo: 'Novedades 2022 etiquetadas', detalle: '10.959 registros con puntaje_real', icono: 'new_releases' },
  { archivo: '01_compatible.csv', titulo: 'Sin puntaje_real', detalle: 'Debe ser rechazado (HTTP 409)', icono: 'block' },
];

@Component({
  selector: 'sx-ejemplos',
  imports: [MatMenuModule],
  template: `
    <button class="sx-btn" [matMenuTriggerFor]="menu"><span class="material-symbols-rounded">science</span>Cargar ejemplo</button>
    <mat-menu #menu="matMenu" xPosition="before">
      @for (e of ejemplos(); track e.archivo) {
        <button mat-menu-item (click)="cargar(e)">
          <span class="material-symbols-rounded" style="margin-right:12px;vertical-align:middle">{{ e.icono }}</span>
          <span><b>{{ e.titulo }}</b> <small style="opacity:.7">· {{ e.detalle }}</small></span>
        </button>
      }
    </mat-menu>`,
})
export class Ejemplos {
  readonly ejemplos = input.required<Ejemplo[]>();
  readonly elegido = output<File>();
  private http = inject(HttpClient);

  async cargar(e: Ejemplo) {
    const blob = await firstValueFrom(this.http.get(`demo/${e.archivo}`, { responseType: 'blob' }));
    this.elegido.emit(new File([blob], e.archivo, { type: 'text/csv' }));
  }
}
