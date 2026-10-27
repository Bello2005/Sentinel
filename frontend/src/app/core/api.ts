// Cliente de la API de Crow (crow-service/src/main.cpp). Los tipos reflejan exactamente lo que devuelve cada endpoint.
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

export type EstadoValidacion = 'compatible' | 'compatible_con_advertencias' | 'incompatible';
export type EstadoVersion = 'activo' | 'candidato' | 'historico' | 'rechazado';

export interface Problema {
  nivel: 'error' | 'advertencia';
  categoria: 'esquema' | 'tipo' | 'contenido' | 'dominio' | 'regla';
  variable: string;
  mensaje: string;
  esperado: string;
  encontrado: string;
  filas_afectadas: number;
  ejemplo_filas: number[];
}

export interface Validacion {
  id: string;
  archivo: string;
  fecha: string;
  modelo_version: string;
  estado: EstadoValidacion;
  modo: 'prediccion' | 'entrenamiento';
  filas: number;
  filas_con_errores: number;
  columnas: { recibidas: string[]; esperadas: string[]; faltantes: string[]; adicionales: string[] };
  tipos: { variable: string; esperado: string; detectado: string }[];
  resumen: { errores: number; advertencias: number };
  problemas: Problema[];
  descargas: Record<string, string>;
}

export interface Frecuencia { valor: string; conteo: number; proporcion: number }
export interface EstadisticasNum {
  n: number; media: number; desviacion: number; minimo: number; q1: number; mediana: number; q3: number; maximo: number;
  asimetria: number; valores_no_numericos: number;
  atipicos: { criterio: string; limite_inferior: number | null; limite_superior: number | null; cantidad: number; proporcion: number; ejemplos: number[]; ejemplo_filas: number[] };
  histograma: { bordes: number[]; conteos: number[] };
  caja: { min: number; q1: number; mediana: number; q3: number; max: number };
}
export interface VariableEda {
  nombre: string;
  tipo: 'numerica' | 'discreta' | 'categorica' | 'temporal' | 'identificador' | 'texto' | 'vacia';
  no_vacios: number; vacios: number; proporcion_vacios: number; distintos: number;
  estadisticas?: EstadisticasNum;
  frecuencias?: Frecuencia[];
  texto?: { longitud_min: number; longitud_max: number; ejemplos: string[]; repetidos: number };
}
export interface Relacion { tipo: 'correlacion' | 'eta2'; variables: [string, string]; valor: number; descripcion: string; medias_por_categoria?: Record<string, number> }
export interface Eda {
  general: { filas: number; columnas: number; celdas_vacias: number; proporcion_vacias: number; filas_duplicadas: number; ejemplo_duplicadas: { fila: number; igual_a: number }[]; variables_por_tipo: Record<string, number> };
  variables: VariableEda[];
  correlaciones: { variables: string[]; matriz: (number | null)[][] };
  dispersion: { x: string; y: string; puntos: [number, number][] }[];
  relaciones: Relacion[];
  graficas: { tipo: string; variable?: string; x?: string; y?: string; titulo: string }[];
  observaciones: string[];
  criterios: Record<string, string>;
}
export interface RespuestaEda { id: string; archivo: string; fecha: string; eda: Eda; descargas: Record<string, string> }

export interface FilaPrediccion {
  fila: number; codigo: string; nombre: string | null; tipo_unidad: string; departamento_cod: string | null; municipio_cod: string | null;
  anio_objetivo: string; prediccion: number; mas_menos: number | null; desde: number | null; hasta: number | null;
}
export interface ResumenGrupo { registros: number; promedio: number; minimo: number; mediana: number; maximo: number }
export interface RespuestaPrediccion {
  id: string; estado: EstadoValidacion; modelo_version: string; validacion: Validacion;
  resumen: { general: ResumenGrupo; por_tipo_unidad: Record<string, ResumenGrupo>; modelo_version: string; cobertura_intervalo: number };
  predicciones: FilaPrediccion[]; descargas: Record<string, string>;
}

export interface MetricasVersion {
  mae_choco: number; mae_choco_municipios: number; mae_choco_colegios: number; mae_pais: number;
  lineas_base: { persistencia_mae_choco: number; promedio_3_mae_choco: number };
  metrica_principal: string; estrategia: string;
}
export interface Decision { accion: 'activar' | 'rechazar'; justificacion: string; fecha: string; activo_previo: string | null; responsable?: string }
export interface Version {
  id: string; fecha: string; registros: number; variables: string[]; algoritmo: string; metricas: MetricasVersion;
  ruta: string; datos?: string; estado: EstadoVersion; decision?: Decision; reporte_actualizacion?: string;
}
export interface Registro { activo: string | null; versiones: Version[] }
export interface MetadataModelo {
  version: string; fecha_entrenamiento: string; algoritmo: string;
  configuracion: { alpha: number; intercepto: number; coeficientes: Record<string, number>; formula: string };
  datos: { archivo: string; registros: number; anios_objetivo: number[]; por_tipo: Record<string, number> };
  variables_predictoras: string[]; variables_auxiliares: string[]; categorias_validas: Record<string, string[]>;
  validacion: MetricasVersion; intervalo_80: Record<string, Record<string, number>>; notas: string;
}
export interface RespuestaModelo { activo: MetadataModelo; registro: Registro }
export interface Salud { estado: string; modelo_activo: string | null; shared: string }

export interface Comparacion {
  principal: { metrica: string; activa: number; candidata: number };
  secundarias: { metrica: string; activa: number | null; candidata: number | null; nota?: string }[];
}
export interface Actualizacion {
  id_actualizacion: string; fecha: string;
  lote: { archivo: string; registros: number; nuevos: number; reemplazados: number; anios_objetivo: number[]; por_tipo: Record<string, number>; choco: number; puntaje_real_promedio: number };
  conjunto_actualizado: { archivo: string; registros: number; anios_objetivo: number[] };
  activa: { version: string; fecha: string; coeficientes: Record<string, number> };
  candidata: { version: string; fecha: string; coeficientes: Record<string, number>; estado: EstadoVersion };
  comparacion: Comparacion;
  recomendacion: { accion_sugerida: 'activar' | 'revisar'; criterio: string; vence_lineas_base: boolean; no_empeora: boolean; nota: string };
  decision: Decision | null;
}
export interface RespuestaActualizacion { id: string; estado: EstadoValidacion; validacion: Validacion; actualizacion: Actualizacion; descargas: Record<string, string> }
export interface RespuestaDecision { registro: Registro; modelo_activo?: string }

/** Error con el mensaje que la API devolvió (o uno legible si no hubo respuesta). */
export class ErrorApi extends Error {
  constructor(mensaje: string, readonly codigo: number, readonly cuerpo?: unknown) { super(mensaje); }
}

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  private base = '/api';

  salud() { return this.pedir(this.http.get<Salud>(`${this.base}/salud`)); }
  modelo() { return this.pedir(this.http.get<RespuestaModelo>(`${this.base}/modelo`)); }
  eda(archivo: File) { return this.pedir(this.http.post<RespuestaEda>(`${this.base}/eda`, this.form(archivo))); }
  validar(archivo: File, modo: 'prediccion' | 'entrenamiento' = 'prediccion') {
    return this.pedir(this.http.post<Validacion>(`${this.base}/validar`, this.form(archivo), { params: { modo } }));
  }
  predecir(archivo: File) { return this.pedir(this.http.post<RespuestaPrediccion>(`${this.base}/predecir`, this.form(archivo))); }
  actualizar(archivo: File) { return this.pedir(this.http.post<RespuestaActualizacion>(`${this.base}/actualizar`, this.form(archivo))); }
  /** El responsable no se envía: Crow usa el usuario de la sesión. */
  decidir(version: string, accion: 'activar' | 'rechazar', justificacion: string) {
    return this.pedir(this.http.post<RespuestaDecision>(`${this.base}/modelo/decision`, { version, accion, justificacion }));
  }
  /** Reporte de actualización de una candidata (shared/reportes/<id>/actualizacion.json). */
  actualizacion(reporteId: string) { return this.pedir(this.http.get<Actualizacion>(`${this.base}/reportes/${reporteId}/actualizacion.json`)); }

  private form(archivo: File) {
    const f = new FormData();
    f.append('archivo', archivo, archivo.name);
    return f;
  }

  private pedir<T>(o: Observable<T>): Observable<T> {
    return o.pipe(catchError((e: HttpErrorResponse) => {
      const cuerpo = e.error;
      const mensaje = typeof cuerpo === 'object' && cuerpo ? (cuerpo.error ?? cuerpo.mensaje) : null;
      return throwError(() => new ErrorApi(
        mensaje ?? (e.status === 0 ? 'No hay conexión con el backend (Crow). ¿Está corriendo en el puerto 8080?' : `Error ${e.status}`),
        e.status, cuerpo));
    }));
  }
}
