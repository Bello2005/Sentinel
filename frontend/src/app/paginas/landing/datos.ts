// Datos del estudio para la landing pública: frontend/public/estudio/estudio.json, generado por
// scripts/exportar_estudio.py a partir de los resultados del proyecto de análisis. Solo agregados.
import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

export interface Serie { anios: number[]; choco: (number | null)[]; resto?: (number | null)[] }
export interface Municipio {
  cod: string; nombre: string; estudiantes: number | null; colegios: number | null; puntaje: number | null; z: number | null;
  cambio_z: number | null; pct_top10_pais: number | null; ipm: number | null; cobertura_media: number | null;
  internet_hogar: number | null; madre_profesional: number | null; etnia: number | null; puesto_pais: number | null; en_10_mas_bajo: boolean;
}
export interface Trazo { cod: string; d: string; cx: number; cy: number; nombre_mapa?: string }
export interface Mapa { viewBox: string; ancho: number; alto: number }

export interface Estudio {
  generado: string;
  fuentes: string[];
  resumen: {
    estudiantes: number; anios: string; departamentos: number; puesto_choco: number; brecha_ultimo_anio: number; anio_ultimo: number;
    municipios_10_mas_bajo: number; municipios_con_dato: number; pct_cuartil_bajo: number; pct_10_mas_alto: number; estudiantes_choco: number;
  };
  evolucion: { puntaje: Serie & { resto: number[]; brecha: number[] }; z_matematicas: Serie; z_global: Serie; genero_matematicas: Serie; ingles_b1: Serie };
  departamentos: {
    ranking_ultimo_anio: { cod: string; nombre: string; puntaje: number; estudiantes: number }[];
    z_por_anio: { anios: number[]; series: { cod: string | null; nombre: string; z: (number | null)[] }[] };
    mapa: Mapa & { deptos: Trazo[] };
  };
  municipios: { lista: Municipio[]; mapa: Mapa & { municipios: Trazo[]; puntos?: Record<string, { cx: number; cy: number }> }; total_municipios_pais: number; en_10_mas_bajo: number; con_dato: number; corte_10_pais: number };
  distribucion: { percentiles: number[]; choco: number[]; resto: number[];
                  estadisticos: Record<string, { media: number; mediana: number; desv: number; p10: number; p90: number; n: number }>;
                  extremos: Record<string, Record<string, number>> };
  materias: Record<string, number>;
  ingles: Record<string, Record<string, number>>;
  genero: Record<string, Record<string, number>>;
  hogar: {
    madre: Record<string, { choco: number; resto: number }>;
    bienes_pct: Record<string, Record<string, number>>;
    bienes_puntaje: { choco: boolean; tiene: boolean; p: number; n: number; bien: string }[];
    estrato: { estrato: number; choco: number; resto: number; n_choco: number }[];
    tipo_colegio: { choco: boolean; tipo: string; p: number; n: number; pct: number }[];
    correlaciones: Record<string, Record<string, number>>;
  };
  brecha: {
    pasos: { paso: string; brecha: number; ee: number }[];
    pares_por_anio: Record<string, { anios: number[]; bruta: number[]; ajustada: number[] }>;
    quibdo_vs_resto: { anios: number[]; quibdo: number[]; resto: number[] };
    municipios_vs_esperado: { municipio: string; departamento: string; valor: number; puesto: number; estudiantes: number }[];
    total_municipios_comparados: number;
    colegios_quibdo: { nombre: string; naturaleza: string; estudiantes: number; puntaje: number; frente: number }[];
  };
  pacifico: { municipio: string; depto: string; choco: boolean; estudiantes: number; puntaje: number }[];
  hipotesis: { id: string; titulo: string; resultado: string; veredicto: string }[];
  modelo: { version: string; coeficientes: Record<string, number>; mae: { modelo: number; promedio_3: number; persistencia: number };
            intervalo_80: Record<string, Record<string, number>>; registros: number };
}

@Injectable({ providedIn: 'root' })
export class DatosEstudio {
  private http = inject(HttpClient);
  readonly estudio = signal<Estudio | null>(null);
  readonly error = signal(false);

  cargar() {
    if (this.estudio()) return;
    this.http.get<Estudio>('estudio/estudio.json').subscribe({ next: e => this.estudio.set(e), error: () => this.error.set(true) });
  }
}

/** Correlación de Pearson con pares completos (para mostrar asociaciones calculadas en el navegador). */
export function pearson(xs: (number | null)[], ys: (number | null)[]): number | null {
  const pares = xs.map((x, i) => [x, ys[i]] as const).filter(([x, y]) => x !== null && y !== null) as [number, number][];
  if (pares.length < 3) return null;
  const n = pares.length, mx = pares.reduce((s, p) => s + p[0], 0) / n, my = pares.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pares) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
