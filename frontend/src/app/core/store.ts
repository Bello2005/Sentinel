// Estado global de SENTINEL (NgRx Signals). Una sola fuente de verdad para el shell, el dashboard y los flujos.
// Los archivos que el usuario sube quedan "en sesión" para pasar de validar a EDA y a predecir sin volver a subirlos.
import { computed, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';

import { Actualizacion, Api, ErrorApi, RespuestaActualizacion, RespuestaEda, RespuestaModelo, RespuestaPrediccion, Salud, Validacion, Version } from './api';

export interface Evento { fecha: string; tipo: 'validacion' | 'eda' | 'prediccion' | 'actualizacion' | 'decision' | 'error'; titulo: string; detalle?: string; tono?: 'ok' | 'warn' | 'bad' | 'candidate' | 'active' }

type Tarea = 'modelo' | 'validar' | 'eda' | 'predecir' | 'actualizar' | 'decidir';

interface Estado {
  salud: Salud | null;
  apiOnline: boolean | null;
  modelo: RespuestaModelo | null;
  archivo: File | null;               // dataset en sesión (predicción y EDA)
  archivoEntrenamiento: File | null;  // lote etiquetado (actualización)
  validacion: Validacion | null;
  eda: RespuestaEda | null;
  prediccion: RespuestaPrediccion | null;
  actualizacion: RespuestaActualizacion | null;
  comparaciones: Record<string, Actualizacion>;  // por versión candidata
  ocupado: Partial<Record<Tarea, boolean>>;
  actividad: Evento[];
}

const CLAVE_ACTIVIDAD = 'sx-actividad';
const leerActividad = (): Evento[] => { try { return JSON.parse(localStorage.getItem(CLAVE_ACTIVIDAD) ?? '[]'); } catch { return []; } };

export const SentinelStore = signalStore(
  { providedIn: 'root' },
  withState<Estado>({
    salud: null, apiOnline: null, modelo: null, archivo: null, archivoEntrenamiento: null, validacion: null, eda: null,
    prediccion: null, actualizacion: null, comparaciones: {}, ocupado: {}, actividad: leerActividad(),
  }),
  withComputed(({ modelo, validacion, ocupado }) => {
    const versiones = computed<Version[]>(() => [...(modelo()?.registro.versiones ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha)));
    return {
      versiones,
      activa: computed(() => versiones().find(v => v.estado === 'activo') ?? null),
      candidatas: computed(() => versiones().filter(v => v.estado === 'candidato')),
      metadata: computed(() => modelo()?.activo ?? null),
      /** 0-100: proporción de filas sin errores, descontando por advertencias. Un archivo con errores nunca pasa
       *  de 59 (zona roja): no debe verse "sano" algo que el modelo se niega a procesar. */
      saludDatos: computed(() => {
        const v = validacion();
        if (!v || !v.filas) return null;
        const faltaColumna = v.problemas.some(p => p.nivel === 'error' && p.categoria === 'esquema');
        const filasOk = faltaColumna ? 0 : 1 - v.filas_con_errores / v.filas;
        const penalizacion = Math.min(0.3, v.resumen.errores * 0.08 + v.resumen.advertencias * 0.02);
        const puntaje = Math.max(0, Math.round((filasOk - penalizacion) * 100));
        return v.resumen.errores ? Math.min(59, puntaje) : puntaje;
      }),
      trabajando: computed(() => Object.values(ocupado()).some(Boolean)),
    };
  }),
  withMethods((store, api = inject(Api), snack = inject(MatSnackBar)) => {
    const registrar = (e: Omit<Evento, 'fecha'>) => {
      const actividad = [{ ...e, fecha: new Date().toISOString() }, ...store.actividad()].slice(0, 60);
      patchState(store, { actividad });
      try { localStorage.setItem(CLAVE_ACTIVIDAD, JSON.stringify(actividad)); } catch { /* sin almacenamiento: solo en memoria */ }
    };
    const aviso = (texto: string, tono: 'ok' | 'bad' = 'ok') =>
      snack.open(texto, 'Cerrar', { duration: tono === 'bad' ? 7000 : 3500, panelClass: tono === 'bad' ? 'sx-snack-bad' : 'sx-snack-ok' });
    async function ejecutar<T>(tarea: Tarea, fn: () => Promise<T>): Promise<T | null> {
      patchState(store, { ocupado: { ...store.ocupado(), [tarea]: true } });
      try {
        return await fn();
      } catch (e) {
        const msg = e instanceof ErrorApi ? e.message : 'Ocurrió un error inesperado.';
        if (!(e instanceof ErrorApi && e.codigo === 409)) aviso(msg, 'bad');
        registrar({ tipo: 'error', titulo: msg, tono: 'bad' });
        throw e;
      } finally {
        patchState(store, { ocupado: { ...store.ocupado(), [tarea]: false } });
      }
    }
    const ok = <T>(p: Promise<T>) => p.catch(() => null);

    const cargarModelo = () => ok(ejecutar('modelo', async () => {
      const [salud, modelo] = await Promise.all([firstValueFrom(api.salud()), firstValueFrom(api.modelo())]);
      patchState(store, { salud, modelo, apiOnline: true });
    })).then(r => { if (r === null) patchState(store, { apiOnline: false }); });

    return {
      cargarModelo,
      registrar,
      fijarArchivo(archivo: File | null) {
        patchState(store, { archivo, validacion: null, eda: null, prediccion: null });
      },
      fijarArchivoEntrenamiento(archivoEntrenamiento: File | null) {
        patchState(store, { archivoEntrenamiento, actualizacion: null });
      },
      validar: (modo: 'prediccion' | 'entrenamiento' = 'prediccion') => ok(ejecutar('validar', async () => {
        const archivo = modo === 'prediccion' ? store.archivo() : store.archivoEntrenamiento();
        if (!archivo) return;
        const validacion = await firstValueFrom(api.validar(archivo, modo));
        patchState(store, { validacion });
        const tono = validacion.estado === 'compatible' ? 'ok' : validacion.estado === 'incompatible' ? 'bad' : 'warn';
        registrar({ tipo: 'validacion', titulo: `${archivo.name}: ${validacion.estado.replaceAll('_', ' ')}`,
                    detalle: `${validacion.resumen.errores} errores · ${validacion.resumen.advertencias} advertencias`, tono });
      })),
      analizar: () => ok(ejecutar('eda', async () => {
        const archivo = store.archivo();
        if (!archivo) return;
        const eda = await firstValueFrom(api.eda(archivo));
        patchState(store, { eda });
        registrar({ tipo: 'eda', titulo: `EDA de ${archivo.name}`, detalle: `${eda.eda.general.filas} filas · ${eda.eda.observaciones.length} observaciones`, tono: 'active' });
      })),
      predecir: () => ok(ejecutar('predecir', async () => {
        const archivo = store.archivo();
        if (!archivo) return;
        try {
          const prediccion = await firstValueFrom(api.predecir(archivo));
          patchState(store, { prediccion, validacion: prediccion.validacion });
          registrar({ tipo: 'prediccion', titulo: `${prediccion.predicciones.length} predicciones con ${prediccion.modelo_version}`,
                      detalle: archivo.name, tono: 'ok' });
          aviso(`Se generaron ${prediccion.predicciones.length} predicciones.`);
        } catch (e) {
          if (e instanceof ErrorApi && e.codigo === 409) {  // incompatible: llega el reporte, no hay predicciones
            patchState(store, { validacion: (e.cuerpo as { validacion: Validacion }).validacion, prediccion: null });
            aviso('Archivo incompatible: no se generaron predicciones.', 'bad');
          }
          throw e;
        }
      })),
      actualizar: () => ok(ejecutar('actualizar', async () => {
        const archivo = store.archivoEntrenamiento();
        if (!archivo) return;
        try {
          const actualizacion = await firstValueFrom(api.actualizar(archivo));
          const cand = actualizacion.actualizacion;
          patchState(store, { actualizacion, validacion: actualizacion.validacion,
                              comparaciones: { ...store.comparaciones(), [cand.candidata.version]: cand } });
          registrar({ tipo: 'actualizacion', titulo: `Candidata ${cand.candidata.version} entrenada`,
                      detalle: `MAE ${cand.comparacion.principal.candidata} vs ${cand.comparacion.principal.activa} · sugiere ${cand.recomendacion.accion_sugerida}`, tono: 'candidate' });
          await cargarModelo();
        } catch (e) {
          if (e instanceof ErrorApi && e.codigo === 409) {
            patchState(store, { validacion: (e.cuerpo as { validacion: Validacion }).validacion, actualizacion: null });
            aviso('Los datos no superaron la validación: no se entrenó ninguna candidata.', 'bad');
          }
          throw e;
        }
      })),
      cargarComparacion: (v: Version) => ok(ejecutar('modelo', async () => {
        if (!v.reporte_actualizacion || store.comparaciones()[v.id]) return;
        const id = v.reporte_actualizacion.split('/').filter(Boolean).pop()!;
        const a = await firstValueFrom(api.actualizacion(id));
        patchState(store, { comparaciones: { ...store.comparaciones(), [v.id]: a } });
      })),
      decidir: (version: string, accion: 'activar' | 'rechazar', justificacion: string, responsable: string) => ejecutar('decidir', async () => {
        await firstValueFrom(api.decidir(version, accion, justificacion));
        const { [version]: _, ...resto } = store.comparaciones();
        patchState(store, { comparaciones: resto });
        registrar({ tipo: 'decision', titulo: `${version} ${accion === 'activar' ? 'activada' : 'rechazada'} por ${responsable}`,
                    detalle: justificacion, tono: accion === 'activar' ? 'active' : 'bad' });
        await cargarModelo();
      }),
    };
  }),
  withHooks({ onInit: store => { store.cargarModelo(); } }),
);
