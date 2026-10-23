// Mapa del sitio: una sola lista para la barra lateral, la paleta de comandos y las rutas.
export interface Destino { ruta: string; titulo: string; icono: string; descripcion: string; grupo: 'Operación' | 'Gobierno' }

export const DESTINOS: Destino[] = [
  { ruta: '/', titulo: 'Command Center', icono: 'space_dashboard', descripcion: 'Estado del sistema y del modelo activo', grupo: 'Operación' },
  { ruta: '/validacion', titulo: 'Validación', icono: 'fact_check', descripcion: 'Compatibilidad del dataset con el modelo', grupo: 'Operación' },
  { ruta: '/observatorio', titulo: 'Data Observatory', icono: 'travel_explore', descripcion: 'EDA automático del dataset', grupo: 'Operación' },
  { ruta: '/predicciones', titulo: 'Predicciones', icono: 'insights', descripcion: 'Pronóstico del año siguiente con intervalo', grupo: 'Operación' },
  { ruta: '/laboratorio', titulo: 'Laboratorio', icono: 'science', descripcion: 'Reentrenar con datos etiquetados', grupo: 'Gobierno' },
  { ruta: '/comparacion', titulo: 'Comparación', icono: 'compare_arrows', descripcion: 'Versión activa frente a la candidata', grupo: 'Gobierno' },
  { ruta: '/decision', titulo: 'Centro de decisión', icono: 'gavel', descripcion: 'Aprobar o rechazar candidatas', grupo: 'Gobierno' },
  { ruta: '/historial', titulo: 'Historial', icono: 'history', descripcion: 'Evolución, decisiones y responsables', grupo: 'Gobierno' },
];
