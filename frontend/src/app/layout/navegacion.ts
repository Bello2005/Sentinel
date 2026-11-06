// Mapa del sitio: una sola lista para la barra lateral, la paleta de comandos y las rutas.
import { ROLES_EQUIPO, Rol } from '../core/sesion';

// Sin roles, la ve cualquier cuenta. Los permisos reales los aplica Crow; esto solo ordena lo que se muestra.
export interface Destino { ruta: string; titulo: string; icono: string; descripcion: string; grupo: Grupo; roles?: Rol[] }
export type Grupo = 'Operación' | 'Gobierno' | 'Modelo' | 'Administración';
export const GRUPOS: Grupo[] = ['Operación', 'Gobierno', 'Modelo', 'Administración'];

export const DESTINOS: Destino[] = [
  { ruta: '/centro', titulo: 'Command Center', icono: 'space_dashboard', descripcion: 'Estado del sistema y del modelo activo', grupo: 'Operación', roles: ROLES_EQUIPO },
  { ruta: '/validacion', titulo: 'Validación', icono: 'fact_check', descripcion: 'Compatibilidad del dataset con el modelo', grupo: 'Operación', roles: ROLES_EQUIPO },
  { ruta: '/observatorio', titulo: 'Data Observatory', icono: 'travel_explore', descripcion: 'EDA automático del dataset', grupo: 'Operación', roles: ROLES_EQUIPO },
  { ruta: '/predicciones', titulo: 'Predicciones', icono: 'insights', descripcion: 'Pronóstico del año siguiente con intervalo', grupo: 'Operación', roles: ROLES_EQUIPO },
  { ruta: '/laboratorio', titulo: 'Laboratorio', icono: 'science', descripcion: 'Reentrenar con datos etiquetados', grupo: 'Gobierno', roles: ROLES_EQUIPO },
  { ruta: '/comparacion', titulo: 'Comparación', icono: 'compare_arrows', descripcion: 'Versión activa frente a la candidata', grupo: 'Gobierno', roles: ROLES_EQUIPO },
  { ruta: '/decision', titulo: 'Centro de decisión', icono: 'gavel', descripcion: 'Aprobar o rechazar candidatas', grupo: 'Gobierno', roles: ['admin'] },
  { ruta: '/historial', titulo: 'Historial', icono: 'history', descripcion: 'Evolución, decisiones y responsables', grupo: 'Gobierno', roles: ROLES_EQUIPO },
  { ruta: '/descargas', titulo: 'Descargas', icono: 'download', descripcion: 'El modelo activo y su ficha', grupo: 'Modelo' },
  { ruta: '/admin', titulo: 'Administración', icono: 'admin_panel_settings', descripcion: 'Solicitudes de acceso y cuentas', grupo: 'Administración', roles: ['admin'] },
];
