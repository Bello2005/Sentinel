// Cada página se carga bajo demanda (lazy loading): el primer arranque solo baja el shell y el Command Center.
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', title: 'Command Center · SENTINEL', loadComponent: () => import('./paginas/dashboard').then(m => m.Dashboard) },
  { path: 'validacion', title: 'Validación · SENTINEL', loadComponent: () => import('./paginas/validacion').then(m => m.Validacion) },
  { path: 'observatorio', title: 'Data Observatory · SENTINEL', loadComponent: () => import('./paginas/observatorio').then(m => m.Observatorio) },
  { path: 'predicciones', title: 'Predicciones · SENTINEL', loadComponent: () => import('./paginas/predicciones').then(m => m.Predicciones) },
  { path: 'laboratorio', title: 'Laboratorio · SENTINEL', loadComponent: () => import('./paginas/laboratorio').then(m => m.Laboratorio) },
  { path: 'comparacion', title: 'Comparación · SENTINEL', loadComponent: () => import('./paginas/comparacion').then(m => m.Comparacion) },
  { path: 'decision', title: 'Centro de decisión · SENTINEL', loadComponent: () => import('./paginas/decision').then(m => m.Decision) },
  { path: 'historial', title: 'Historial · SENTINEL', loadComponent: () => import('./paginas/historial').then(m => m.Historial) },
  { path: '**', redirectTo: '' },
];
