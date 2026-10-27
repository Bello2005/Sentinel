// LANDING PÚBLICA: los hallazgos del estudio Saber 11 · Chocó contados con datos, mapas y gráficas interactivas.
// La plataforma (validación, modelo y gobierno) queda detrás del acceso.
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApexOptions } from 'apexcharts';

import { num } from '../../core/formato';
import { Sesion } from '../../core/sesion';
import { Tema } from '../../core/tema';
import { Grafica } from '../../shared/grafica';
import { Contador } from '../../shared/ui';
import { DatosEstudio, Estudio, pearson } from './datos';
import { MapaChoco } from './mapa-choco';
import { MapaPais } from './mapa-pais';
import { Revelar } from './revelar';
import { Unidades } from './unidades';

export const SECCIONES = [
  { id: 'brecha', titulo: 'La brecha' },
  { id: 'pais', titulo: 'En el país' },
  { id: 'territorio', titulo: 'Territorio' },
  { id: 'hogar', titulo: 'Hogar y colegio' },
  { id: 'explicacion', titulo: 'Qué la explica' },
  { id: 'dos-chocos', titulo: 'Dos Chocós' },
  { id: 'modelo', titulo: 'El modelo' },
];

type ModoEvolucion = 'puntaje' | 'z' | 'mat';

@Component({
  selector: 'sx-landing',
  imports: [RouterLink, Grafica, Contador, Revelar, MapaChoco, MapaPais, Unidades],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
  host: { '(window:scroll)': 'alDesplazar()' },
})
export class Landing {
  protected datos = inject(DatosEstudio);
  protected tema = inject(Tema);
  protected sesion = inject(Sesion);
  protected secciones = SECCIONES;
  protected e = this.datos.estudio;
  protected num = num;
  protected abs = Math.abs;

  protected progreso = signal(0);
  protected seccionActiva = signal('');
  protected compacta = signal(false);
  protected menuMovil = signal(false);
  protected kpisVisibles = signal(false);
  protected unidadesVisibles = signal(false);
  protected modoEvolucion = signal<ModoEvolucion>('puntaje');
  protected paresAjustados = signal(false);

  constructor() {
    this.datos.cargar();
    this.sesion.verificar();  // solo para mostrar "Ir a la plataforma" si ya hay sesión
    // Scroll-spy: la sección que ocupa el centro de la pantalla queda resaltada en la navegación
    const obs = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
      for (const x of es) if (x.isIntersecting) this.seccionActiva.set(x.target.id);
    }, { rootMargin: '-45% 0px -50% 0px' }) : null;
    const intento = setInterval(() => {
      const nodos = SECCIONES.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
      if (nodos.length === SECCIONES.length) { nodos.forEach(n => obs?.observe(n)); clearInterval(intento); }
    }, 200);
    inject(DestroyRef).onDestroy(() => { obs?.disconnect(); clearInterval(intento); });
  }

  alDesplazar() {
    const h = document.documentElement;
    this.progreso.set(h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight));
    this.compacta.set(h.scrollTop > 24);
  }
  ir(id: string, ev?: Event) {
    ev?.preventDefault();
    this.menuMovil.set(false);
    document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  private t(n: string) { return this.tema.token(n); }
  private conTema<T>(f: () => T) { this.tema.modo(); return f(); }  // recalcula colores al cambiar el tema

  // --- Cifras clave --------------------------------------------------------------------------------------------------
  protected r = computed(() => this.e()?.resumen);
  protected corrPobreza = computed(() => {
    const m = this.e()?.municipios.lista ?? [];
    return pearson(m.map(x => x.puntaje), m.map(x => x.ipm));
  });
  protected brechaMadre = computed(() => {
    const md = this.e()?.hogar.madre;
    if (!md) return null;
    const v = Object.values(md);
    return { baja: v[0].resto - v[0].choco, alta: v[v.length - 1].resto - v[v.length - 1].choco };
  });
  protected colegiosAbajo = computed(() => {
    const c = this.e()?.brecha.colegios_quibdo ?? [];
    return { abajo: c.filter(x => x.frente < 0).length, total: c.length };
  });
  protected puestoQuibdo = computed(() => this.e()?.brecha.municipios_vs_esperado.find(m => m.municipio.startsWith('QUIBD'))?.puesto ?? null);

  // --- Hero: silueta del Chocó ---------------------------------------------------------------------------------------
  protected silueta = computed(() => this.e()?.municipios.mapa ?? null);

  // --- Gráficas ------------------------------------------------------------------------------------------------------
  protected evolucion = computed<ApexOptions | null>(() => this.conTema(() => {
    const e = this.e();
    if (!e) return null;
    const ev = e.evolucion, modo = this.modoEvolucion();
    const base: ApexOptions = { chart: { type: 'area', zoom: { enabled: false } }, stroke: { width: [3, 3], curve: 'smooth' },
                                markers: { size: 5, strokeWidth: 0 }, legend: { position: 'top', horizontalAlign: 'left' },
                                fill: { type: 'gradient', gradient: { opacityFrom: 0.28, opacityTo: 0.02 } } };
    if (modo === 'puntaje') return { ...base,
      series: [{ name: 'Resto del país', data: ev.puntaje.resto }, { name: 'Chocó', data: ev.puntaje.choco as number[] }],
      colors: [this.t('active'), this.t('danger')], xaxis: { categories: ev.puntaje.anios },
      yaxis: { min: 190, max: 270, tickAmount: 4, title: { text: 'Puntaje global (0-500)' } },
      tooltip: { shared: true, y: { formatter: (v: number) => num(v, 1) + ' pts' } } };
    const s = modo === 'z' ? ev.z_global : ev.z_matematicas;
    return { ...base, chart: { type: 'area' }, stroke: { width: 3, curve: 'smooth' },
      series: [{ name: modo === 'z' ? 'Chocó · puntaje global' : 'Chocó · matemáticas', data: s.choco as number[] }],
      colors: [this.t('danger')], xaxis: { categories: s.anios },
      yaxis: { max: 0, min: -1.2, tickAmount: 4, title: { text: 'Desviaciones frente al país (0 = promedio)' }, labels: { formatter: (v: number) => num(v, 1) } },
      annotations: { yaxis: [{ y: 0, borderColor: this.t('active'), strokeDashArray: 0, label: { text: 'Promedio del país', style: { background: this.t('active'), color: '#04212b' } } }] },
      tooltip: { y: { formatter: (v: number) => num(v, 2) + ' σ' } } };
  }));

  protected distribucion = computed<ApexOptions | null>(() => this.conTema(() => {
    const d = this.e()?.distribucion;
    if (!d) return null;
    return { chart: { type: 'area' }, series: [{ name: 'Resto del país', data: d.resto }, { name: 'Chocó', data: d.choco }],
             colors: [this.t('active'), this.t('danger')], stroke: { width: 3 }, xaxis: { categories: d.percentiles.map(p => `P${p}`), title: { text: 'Percentil dentro de cada grupo' } },
             yaxis: { title: { text: 'Puntaje global' }, min: 140, labels: { formatter: (v: number) => num(v, 0) } },
             fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.02 } }, legend: { position: 'top', horizontalAlign: 'left' },
             tooltip: { shared: true, y: { formatter: (v: number) => num(v, 0) + ' pts' } } };
  }));

  protected unidadesChoco = computed(() => this.grupoUnidades('Chocó'));
  protected unidadesResto = computed(() => this.grupoUnidades('Resto del país'));
  private grupoUnidades(g: string) {
    const x = this.e()?.distribucion.extremos[g];
    if (!x) return [];
    return [{ etiqueta: 'en el 25 % más bajo del país', pct: x['25 % más bajo'], color: 'var(--sx-danger)' },
            { etiqueta: 'en el 25 % más alto del país', pct: x['25 % más alto'], color: 'var(--sx-accent)' }];
  }

  protected dispersion = computed<ApexOptions | null>(() => this.conTema(() => {
    const m = this.e()?.municipios.lista.filter(x => x.puntaje !== null && x.ipm !== null);
    if (!m) return null;
    const q = m.find(x => x.cod === '27001');
    // Margen en los ejes para que ningún punto quede pegado al borde ni su tooltip se salga
    const ys = m.map(x => x.puntaje!), xs = m.map(x => x.ipm!);
    const yMin = Math.floor((Math.min(...ys) - 5) / 10) * 10, yMax = Math.ceil((Math.max(...ys) + 5) / 10) * 10;
    const xMin = Math.floor((Math.min(...xs) - 3) / 10) * 10, xMax = Math.ceil((Math.max(...xs) + 3) / 10) * 10;
    return { chart: { type: 'scatter', zoom: { enabled: false } },
             series: [{ name: 'Municipios', data: m.map(x => ({ x: x.ipm!, y: x.puntaje!, nombre: x.nombre })) }] as ApexOptions['series'],
             colors: [this.t('accent')], markers: { size: 7, strokeWidth: 0, fillOpacity: 0.85, hover: { sizeOffset: 3 } },
             states: { hover: { filter: { type: 'none' } }, active: { filter: { type: 'none' } } },
             xaxis: { type: 'numeric', min: xMin, max: xMax, tooltip: { enabled: false }, title: { text: 'Pobreza multidimensional (%)' }, tickAmount: (xMax - xMin) / 10, labels: { formatter: (v: string) => num(+v, 0) } },
             yaxis: { min: yMin, max: yMax, tickAmount: (yMax - yMin) / 10, title: { text: 'Puntaje global' }, labels: { formatter: (v: number) => num(v, 0) } },
             tooltip: { custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
               const x = m[dataPointIndex];
               return `<div style="padding:8px 10px"><b>${x.nombre}</b><br>Puntaje ${num(x.puntaje, 1)} · Pobreza ${num(x.ipm, 1)} %</div>`; } },
             annotations: q ? { points: [{ x: q.ipm!, y: q.puntaje!, marker: { size: 8, fillColor: this.t('text'), strokeColor: this.t('bg') },
                                          label: { text: 'Quibdó', borderWidth: 0, style: { background: this.t('text'), color: this.t('bg') } } }] } : {} };
  }));

  protected materias = computed<ApexOptions | null>(() => this.conTema(() => {
    const m = this.e()?.materias;
    if (!m) return null;
    return { chart: { type: 'bar' }, series: [{ name: 'Chocó', data: Object.values(m) }], xaxis: { categories: Object.keys(m), min: -1, max: 0,
             labels: { formatter: (v: string) => num(+v, 1) } }, colors: [this.t('danger')],
             plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '58%' } },
             dataLabels: { enabled: true, formatter: (v: number) => num(v, 2) + ' σ', style: { fontWeight: 600 } },
             tooltip: { y: { formatter: (v: number) => num(v, 2) + ' desviaciones frente al país' } } };
  }));

  protected ingles = computed<ApexOptions | null>(() => this.conTema(() => {
    const i = this.e()?.ingles;
    if (!i) return null;
    const niveles = Object.keys(i['Chocó']), grupos = ['Chocó', 'Resto del país'];
    return { chart: { type: 'bar', stacked: true, stackType: '100%' },
             series: niveles.map(n => ({ name: n, data: grupos.map(g => i[g][n]) })), xaxis: { categories: grupos },
             plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 4 } },
             colors: [this.t('danger'), this.t('warning'), this.t('active'), this.t('accent'), this.t('candidate')],
             dataLabels: { enabled: true, formatter: (v: number) => (v >= 4 ? num(v, 0) + '%' : '') }, legend: { position: 'top', horizontalAlign: 'left' },
             tooltip: { y: { formatter: (v: number) => num(v, 1) + ' %' } } };
  }));

  protected genero = computed<ApexOptions | null>(() => this.conTema(() => {
    const g = this.e()?.genero;
    if (!g) return null;
    const mat = Object.keys(g['Chocó']);
    return { chart: { type: 'bar' }, series: [{ name: 'Resto del país', data: mat.map(m => g['Resto del país'][m]) }, { name: 'Chocó', data: mat.map(m => g['Chocó'][m]) }],
             xaxis: { categories: mat, labels: { formatter: (v: string) => num(+v, 2) } }, colors: [this.t('active'), this.t('candidate')],
             plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '70%' } }, legend: { position: 'top', horizontalAlign: 'left' },
             tooltip: { y: { formatter: (v: number) => (v > 0 ? 'Hombres +' : 'Mujeres +') + num(Math.abs(v), 2) + ' σ' } } };
  }));

  protected madre = computed<ApexOptions | null>(() => this.conTema(() => {
    const md = this.e()?.hogar.madre;
    if (!md) return null;
    const niveles = Object.keys(md).map(k => k.replace(/^\d\.\s*/, ''));
    return { chart: { type: 'line' }, series: [{ name: 'Resto del país', data: Object.values(md).map(v => v.resto) }, { name: 'Chocó', data: Object.values(md).map(v => v.choco) }],
             colors: [this.t('active'), this.t('danger')], stroke: { width: 4, curve: 'straight' }, markers: { size: 7, strokeWidth: 0 },
             xaxis: { categories: niveles, labels: { rotate: 0, style: { fontSize: '11px' } } }, yaxis: { min: 170, title: { text: 'Puntaje global' } },
             legend: { position: 'top', horizontalAlign: 'left' }, tooltip: { shared: true, y: { formatter: (v: number) => num(v, 1) + ' pts' } } };
  }));

  protected estrato = computed<ApexOptions | null>(() => this.conTema(() => {
    const es = this.e()?.hogar.estrato;
    if (!es) return null;
    return { chart: { type: 'line' }, series: [{ name: 'Resto del país', data: es.map(x => x.resto) }, { name: 'Chocó', data: es.map(x => x.choco) }],
             colors: [this.t('active'), this.t('danger')], stroke: { width: 4 }, markers: { size: 6, strokeWidth: 0 },
             xaxis: { categories: es.map(x => `Estrato ${x.estrato}`) }, yaxis: { min: 160, title: { text: 'Puntaje global' } },
             legend: { position: 'top', horizontalAlign: 'left' }, tooltip: { shared: true, y: { formatter: (v: number) => num(v, 1) + ' pts' } } };
  }));

  protected tipoColegio = computed<ApexOptions | null>(() => this.conTema(() => {
    const t = this.e()?.hogar.tipo_colegio;
    if (!t) return null;
    const tipos = ['OFICIAL RURAL', 'OFICIAL URBANO', 'NO OFICIAL URBANO'];
    const val = (choco: boolean, tipo: string) => t.find(x => x.choco === choco && x.tipo === tipo)?.p ?? null;
    return { chart: { type: 'bar' }, series: [{ name: 'Resto del país', data: tipos.map(x => val(false, x)) }, { name: 'Chocó', data: tipos.map(x => val(true, x)) }] as ApexOptions['series'],
             xaxis: { categories: ['Oficial rural', 'Oficial urbano', 'Privado urbano'] }, colors: [this.t('active'), this.t('danger')],
             plotOptions: { bar: { borderRadius: 6, columnWidth: '55%', dataLabels: { position: 'top' } } }, yaxis: { min: 150, max: 320, title: { text: 'Puntaje global' } },
             dataLabels: { enabled: true, formatter: (v: number) => num(v, 0), offsetY: -20, style: { colors: [this.t('text')], fontSize: '11px' } },
             legend: { position: 'top', horizontalAlign: 'left' } };
  }));

  /** Cascada: cuánto de la brecha queda al ir agregando bloques de variables al modelo */
  protected cascada = computed<ApexOptions | null>(() => this.conTema(() => {
    const p = this.e()?.brecha.pasos;
    if (!p) return null;
    const datos = p.map((x, i) => {
      const previo = i === 0 ? 0 : p[i - 1].brecha;
      const cierra = i > 0 && x.brecha > previo;
      return { x: i === 0 ? 'Brecha bruta' : x.paso.replace(/^\+\s*/, '+ ').replace(/\s*\(.*\)$/, ''),
               y: i === 0 ? [x.brecha, 0] : [Math.min(previo, x.brecha), Math.max(previo, x.brecha)],
               fillColor: i === 0 ? this.t('danger') : i === p.length - 1 ? this.t('warning') : cierra ? this.t('success') : this.t('danger'),
               valor: x.brecha };
    });
    return { chart: { type: 'rangeBar' }, series: [{ name: 'Brecha', data: datos }] as ApexOptions['series'],
             plotOptions: { bar: { horizontal: false, columnWidth: '58%', borderRadius: 4 } }, legend: { show: false },
             xaxis: { labels: { rotate: -30, style: { fontSize: '11px' } } }, yaxis: { min: -50, max: 0, tickAmount: 5, title: { text: 'Puntos frente al resto del país' },
             labels: { formatter: (v: number) => num(v, 0) } },
             dataLabels: { enabled: true, formatter: (_: unknown, o: { dataPointIndex: number }) => num(datos[o.dataPointIndex].valor, 1),
                           style: { colors: [this.t('text')], fontWeight: 700 }, offsetY: -12 },
             tooltip: { custom: ({ dataPointIndex }: { dataPointIndex: number }) => `<div style="padding:8px 10px;max-width:280px;white-space:normal">
                 <b>${p[dataPointIndex].paso}</b><br>Brecha restante: ${num(p[dataPointIndex].brecha, 1)} puntos (±${num(1.96 * p[dataPointIndex].ee, 1)})</div>` } };
  }));

  protected dosChocos = computed<ApexOptions | null>(() => this.conTema(() => {
    const e = this.e();
    if (!e) return null;
    const pares = e.brecha.pares_por_anio, aj = this.paresAjustados();
    const nombres = Object.keys(pares);
    const colores: Record<string, string> = { 'Quibdó': this.t('accent'), 'Resto de Chocó': this.t('danger') };
    const extra = [this.t('candidate'), this.t('warning'), this.t('success')];
    return { chart: { type: 'line', zoom: { enabled: false } },
             series: nombres.map(n => ({ name: n, data: aj ? pares[n].ajustada : pares[n].bruta })),
             colors: nombres.map((n, k) => colores[n] ?? extra[(k - 2 + extra.length) % extra.length]),
             stroke: { width: nombres.map(n => (n in colores ? 4 : 2)), dashArray: nombres.map(n => (n in colores ? 0 : 4)) },
             markers: { size: 0 }, xaxis: { categories: pares[nombres[0]].anios }, legend: { position: 'top', horizontalAlign: 'left' },
             yaxis: { title: { text: 'Desviaciones frente al país' }, labels: { formatter: (v: number) => num(v, 1) } },
             annotations: { yaxis: [{ y: 0, borderColor: this.t('border-strong'), label: { text: 'país', style: { background: 'transparent', color: this.t('muted') } } }] },
             tooltip: { shared: true, y: { formatter: (v: number) => num(v, 2) + ' σ' } } };
  }));

  protected colegios = computed<ApexOptions | null>(() => this.conTema(() => {
    const c = [...(this.e()?.brecha.colegios_quibdo ?? [])].sort((a, b) => a.frente - b.frente);
    if (!c.length) return null;
    return { chart: { type: 'bar' }, series: [{ name: 'Frente a lo esperado', data: c.map(x => x.frente) }],
             xaxis: { categories: c.map(x => x.nombre.length > 30 ? x.nombre.slice(0, 29) + '…' : x.nombre), labels: { formatter: (v: string) => num(+v, 0) } },
             plotOptions: { bar: { horizontal: true, borderRadius: 3, barHeight: '70%', colors: { ranges: [{ from: -100, to: 0, color: this.t('danger') }, { from: 0, to: 100, color: this.t('success') }] } } },
             yaxis: { labels: { style: { fontSize: '10.5px' } } },
             tooltip: { custom: ({ dataPointIndex }: { dataPointIndex: number }) => { const x = c[dataPointIndex];
               return `<div style="padding:8px 10px"><b>${x.nombre}</b><br>${x.naturaleza.toLowerCase()} · ${x.estudiantes} estudiantes<br>Puntaje ${num(x.puntaje, 1)} · ${num(x.frente, 1)} pts frente a lo esperado</div>`; } } };
  }));

  protected modelo = computed<ApexOptions | null>(() => this.conTema(() => {
    const m = this.e()?.modelo;
    if (!m) return null;
    return { chart: { type: 'bar' }, series: [{ name: 'Error medio en Chocó', data: [m.mae.persistencia, m.mae.promedio_3, m.mae.modelo] }],
             xaxis: { categories: ['Repetir el último año', 'Promedio de 3 años', 'SENTINEL ' + m.version] },
             plotOptions: { bar: { distributed: true, borderRadius: 8, columnWidth: '50%', dataLabels: { position: 'top' } } }, legend: { show: false },
             colors: [this.t('faint'), this.t('active'), this.t('accent')], yaxis: { min: 8, max: 12, tickAmount: 4, title: { text: 'Puntos de error (menos es mejor)' }, labels: { formatter: (v: number) => num(v, 1) } },
             dataLabels: { enabled: true, formatter: (v: number) => num(v, 2), offsetY: -20, style: { colors: [this.t('text')], fontSize: '14px', fontWeight: 700 } } };
  }));

  protected coeficientes = computed(() => {
    const c = this.e()?.modelo.coeficientes;
    const nombres: Record<string, string> = { promedio_3: 'Promedio 3 años', puntaje_ultimo: 'Último año', puntaje_anterior: 'Año anterior', puntaje_grupo: 'Municipio / depto.' };
    return c ? Object.entries(c).map(([k, v]) => ({ nombre: nombres[k] ?? k, valor: v })).sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor)) : [];
  });
}

export type { Estudio };
