// Rutas: la landing del estudio, el glosario, el artículo y el acceso son públicos; la plataforma vive dentro del shell y exige sesión.
// Cada página se carga bajo demanda (lazy loading).
import { Routes } from '@angular/router';

import { ROLES_EQUIPO, rolGuard, sesionGuard } from './core/sesion';
import { Shell } from './layout/shell';

export const routes: Routes = [
  { path: '', pathMatch: 'full', title: 'SENTINEL · Saber 11 en el Chocó', loadComponent: () => import('./paginas/landing/landing').then(m => m.Landing) },
  { path: 'acceso', title: 'Acceso · SENTINEL', loadComponent: () => import('./paginas/acceso').then(m => m.Acceso) },
  { path: 'cuenta/clave', title: 'Contraseña · SENTINEL', canMatch: [sesionGuard], loadComponent: () => import('./paginas/cuenta-clave').then(m => m.CuentaClave) },
  { path: 'glosario', title: 'Glosario · SENTINEL', loadComponent: () => import('./paginas/glosario/glosario').then(m => m.Glosario) },
  { path: 'proceso', pathMatch: 'full', redirectTo: 'proceso/pregunta' },
  { path: 'proceso/:capitulo', title: 'Cómo lo hicimos · SENTINEL', loadComponent: () => import('./paginas/proceso/proceso').then(m => m.Proceso) },
  {
    path: '', component: Shell, canMatch: [sesionGuard], canActivateChild: [rolGuard],
    children: [
      { path: 'centro', data: { roles: ROLES_EQUIPO }, title: 'Command Center · SENTINEL', loadComponent: () => import('./paginas/dashboard').then(m => m.Dashboard) },
      { path: 'validacion', data: { roles: ROLES_EQUIPO }, title: 'Validación · SENTINEL', loadComponent: () => import('./paginas/validacion').then(m => m.Validacion) },
      { path: 'observatorio', data: { roles: ROLES_EQUIPO }, title: 'Data Observatory · SENTINEL', loadComponent: () => import('./paginas/observatorio').then(m => m.Observatorio) },
      { path: 'predicciones', data: { roles: ROLES_EQUIPO }, title: 'Predicciones · SENTINEL', loadComponent: () => import('./paginas/predicciones').then(m => m.Predicciones) },
      { path: 'laboratorio', data: { roles: ROLES_EQUIPO }, title: 'Laboratorio · SENTINEL', loadComponent: () => import('./paginas/laboratorio').then(m => m.Laboratorio) },
      { path: 'comparacion', data: { roles: ROLES_EQUIPO }, title: 'Comparación · SENTINEL', loadComponent: () => import('./paginas/comparacion').then(m => m.Comparacion) },
      { path: 'decision', data: { roles: ['admin'] }, title: 'Centro de decisión · SENTINEL', loadComponent: () => import('./paginas/decision').then(m => m.Decision) },
      { path: 'historial', data: { roles: ROLES_EQUIPO }, title: 'Historial · SENTINEL', loadComponent: () => import('./paginas/historial').then(m => m.Historial) },
      { path: 'descargas', title: 'Descargas · SENTINEL', loadComponent: () => import('./paginas/descargas').then(m => m.Descargas) },
      { path: 'admin', data: { roles: ['admin'] }, title: 'Administración · SENTINEL', loadComponent: () => import('./paginas/admin').then(m => m.Admin) },
    ],
  },
  { path: '**', redirectTo: '' },
];
