// Capítulos del artículo "Cómo lo hicimos": del análisis de los datos hasta este sitio web.
export interface Capitulo { id: string; titulo: string; bajada: string; icono: string; minutos: number }

export const CAPITULOS: Capitulo[] = [
  { id: 'pregunta', titulo: 'La pregunta', bajada: 'Por qué el Chocó y qué queríamos saber', icono: 'help', minutos: 3 },
  { id: 'datos', titulo: 'Conseguir los datos', bajada: 'De un portal público a 7 millones de filas', icono: 'cloud_download', minutos: 4 },
  { id: 'limpieza', titulo: 'Limpiar sin inventar', bajada: 'Arreglar los errores sin cambiar la verdad', icono: 'cleaning_services', minutos: 4 },
  { id: 'exploracion', titulo: 'Mirar antes de concluir', bajada: 'Tres miradas y seis ideas puestas a prueba', icono: 'travel_explore', minutos: 4 },
  { id: 'causas', titulo: 'Buscar las causas', bajada: 'Qué parte de la diferencia explica cada cosa', icono: 'account_tree', minutos: 4 },
  { id: 'modelo', titulo: 'Enseñarle a predecir', bajada: 'Cómo entrenamos y probamos la inteligencia artificial', icono: 'model_training', minutos: 6 },
  { id: 'plataforma', titulo: 'Del cuaderno a la web', bajada: 'Las piezas que hacen funcionar SENTINEL', icono: 'hub', minutos: 5 },
  { id: 'gobierno', titulo: 'Una persona decide', bajada: 'Cómo se aprueba cada versión del modelo', icono: 'gavel', minutos: 4 },
  { id: 'cierre', titulo: 'Lo que aprendimos', bajada: 'Conclusiones, límites y lo que sigue', icono: 'flag', minutos: 3 },
];

export const MINUTOS_TOTALES = CAPITULOS.reduce((s, c) => s + c.minutos, 0);
