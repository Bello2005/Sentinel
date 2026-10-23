const locale = 'es-CO';

export const num = (x: number | null | undefined, dec = 0) =>
  x === null || x === undefined || Number.isNaN(x) ? '—' : x.toLocaleString(locale, { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const pct = (x: number | null | undefined, dec = 1) => (x === null || x === undefined ? '—' : `${num(x * 100, dec)} %`);

export const fecha = (iso: string | null | undefined, conHora = true) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(locale, conHora ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
                                          : { day: '2-digit', month: 'short', year: 'numeric' });
};

export const haceCuanto = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
};

export const estadoTexto: Record<string, string> = {
  compatible: 'Compatible', compatible_con_advertencias: 'Compatible con advertencias', incompatible: 'Incompatible',
  activo: 'Activo', candidato: 'Candidato', historico: 'Histórico', rechazado: 'Rechazado',
};
export const estadoTono: Record<string, string> = {
  compatible: 'ok', compatible_con_advertencias: 'warn', incompatible: 'bad',
  activo: 'active', candidato: 'candidate', historico: 'history', rechazado: 'bad',
};
