// Rutas: la landing del estudio, el glosario, el artículo y el acceso son públicos; la plataforma vive dentro del shell y exige sesión.
// Cada página se carga bajo demanda (lazy loading).
import { Routes } from '@angular/router';

import { sesionGuard } from './core/sesion';
import { Shell } from './layout/shell';

export const routes: Routes = [
  { path: '', pathMatch: 'full', title: 'SENTINEL · Saber 11 en el Chocó', loadComponent: () => import('./paginas/landing/landing').then(m => m.Landing) },
  { path: 'acceso', title: 'Acceso · SENTINEL', loadComponent: () => import('./paginas/acceso').then(m => m.Acceso) },
  { path: 'glosario', title: 'Glosario · SENTINEL', loadComponent: () => import('./paginas/glosario/glosario').then(m => m.Glosario) },
  { path: 'proceso', pathMatch: 'full', redirectTo: 'proceso/pregunta' },
  { path: 'proceso/:capitulo', title: 'Cómo lo hicimos · SENTINEL', loadComponent: () => import('./paginas/proceso/proceso').then(m => m.Proceso) },
  {
    path: '', component: Shell, canMatch: [sesionGuard],
    children: [
      { path: 'centro', title: 'Command Center · SENTINEL', loadComponent: () => import('./paginas/dashboard').then(m => m.Dashboard) },
      { path: 'validacion', title: 'Validación · SENTINEL', loadComponent: () => import('./paginas/validacion').then(m => m.Validacion) },
      { path: 'observatorio', title: 'Data Observatory · SENTINEL', loadComponent: () => import('./paginas/observatorio').then(m => m.Observatorio) },
      { path: 'predicciones', title: 'Predicciones · SENTINEL', loadComponent: () => import('./paginas/predicciones').then(m => m.Predicciones) },
      { path: 'laboratorio', title: 'Laboratorio · SENTINEL', loadComponent: () => import('./paginas/laboratorio').then(m => m.Laboratorio) },
      { path: 'comparacion', title: 'Comparación · SENTINEL', loadComponent: () => import('./paginas/comparacion').then(m => m.Comparacion) },
      { path: 'decision', title: 'Centro de decisión · SENTINEL', loadComponent: () => import('./paginas/decision').then(m => m.Decision) },
      { path: 'historial', title: 'Historial · SENTINEL', loadComponent: () => import('./paginas/historial').then(m => m.Historial) },
    ],
  },
  { path: '**', redirectTo: '' },
];
