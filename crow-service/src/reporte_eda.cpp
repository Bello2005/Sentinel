// Reporte EDA descargable: un solo HTML con los datos del análisis incrustados y gráficas interactivas (ECharts).
// Usa el mismo JSON que recibe Angular, así que el reporte y la interfaz muestran exactamente lo mismo.
#include <fstream>

#include "reportes.h"

namespace {

const char* PLANTILLA = R"HTML(<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reporte EDA</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"></script>
<style>
:root{color-scheme:light}body{font-family:system-ui,sans-serif;max-width:1100px;margin:2rem auto;padding:0 1rem;color:#1f2328;background:#fff}
h1{margin-bottom:.2rem}.meta{color:#59636e}table{border-collapse:collapse;width:100%;font-size:13px;margin:1rem 0}
th,td{border:1px solid #d0d7de;padding:5px 7px;text-align:left}th{background:#f6f8fa}
.kpis{display:flex;gap:1rem;flex-wrap:wrap}.kpi{border:1px solid #d0d7de;border-radius:8px;padding:.6rem 1rem;min-width:120px}
.kpi b{display:block;font-size:1.4rem}.graficas{display:grid;grid-template-columns:repeat(auto-fill,minmax(480px,1fr));gap:1rem}
.g{border:1px solid #d0d7de;border-radius:8px;height:320px}.nota{color:#59636e;font-size:13px}
</style></head><body>
<h1>Reporte EDA</h1><p class="meta" id="meta"></p>
<div class="kpis" id="kpis"></div>
<h2>Observaciones</h2><ul id="obs"></ul>
<p class="nota">Las observaciones se calculan automáticamente. Las asociaciones no implican causalidad.</p>
<h2>Variables</h2><table id="vars"></table>
<h2>Gráficas</h2><div class="graficas" id="graficas"></div>
<h2>Criterios usados</h2><table id="crit"></table>
<script>
const R = __DATOS__;
const E = R.eda, $ = id => document.getElementById(id), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
$('meta').textContent = `Archivo: ${R.archivo} · ${R.fecha} · id ${R.id}`;
const g = E.general;
[['Filas', g.filas], ['Columnas', g.columnas], ['Celdas vacías', g.celdas_vacias], ['Filas duplicadas', g.filas_duplicadas]]
  .forEach(([k, v]) => $('kpis').insertAdjacentHTML('beforeend', `<div class="kpi">${k}<b>${v}</b></div>`));
(E.observaciones.length ? E.observaciones : ['Sin observaciones.']).forEach(o => $('obs').insertAdjacentHTML('beforeend', `<li>${esc(o)}</li>`));
$('vars').innerHTML = '<tr><th>Variable</th><th>Tipo</th><th>Vacíos</th><th>Distintos</th><th>Media</th><th>Mediana</th><th>Mín</th><th>Máx</th><th>Atípicos</th></tr>' +
  E.variables.map(v => { const s = v.estadisticas || {}; return `<tr><td>${esc(v.nombre)}</td><td>${v.tipo}</td><td>${v.vacios} (${(100*v.proporcion_vacios).toFixed(1)} %)</td><td>${v.distintos}</td><td>${s.media ?? ''}</td><td>${s.mediana ?? ''}</td><td>${s.minimo ?? ''}</td><td>${s.maximo ?? ''}</td><td>${s.atipicos ? s.atipicos.cantidad : ''}</td></tr>`; }).join('');
$('crit').innerHTML = Object.entries(E.criterios).map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('');

const variable = n => E.variables.find(v => v.nombre === n);
function opcion(gr) {
  const base = {title: {text: gr.titulo, textStyle: {fontSize: 13}}, tooltip: {}, grid: {left: 55, right: 20, bottom: 45, top: 40}};
  if (gr.tipo === 'histograma') {
    const h = variable(gr.variable).estadisticas.histograma;
    const n = x => Number(x).toLocaleString('es', {maximumFractionDigits: Math.abs(x) < 10 ? 2 : 0});
    const etiq = h.conteos.map((_, i) => `${n(h.bordes[i])}–${n(h.bordes[i + 1])}`);
    return {...base, xAxis: {type: 'category', data: etiq, axisLabel: {rotate: 30, fontSize: 10}}, yAxis: {type: 'value', name: 'filas'},
            series: [{type: 'bar', data: h.conteos, barCategoryGap: '2%'}], dataZoom: [{type: 'inside'}]};
  }
  if (gr.tipo === 'caja') {
    const s = variable(gr.variable).estadisticas, c = s.caja;
    return {...base, xAxis: {type: 'category', data: [gr.variable]}, yAxis: {type: 'value', scale: true},
            series: [{type: 'boxplot', data: [[c.min, c.q1, c.mediana, c.q3, c.max]]},
                     {type: 'scatter', name: 'atípicos (muestra)', data: s.atipicos.ejemplos.map(v => [gr.variable, v])}]};
  }
  if (gr.tipo === 'barras' || gr.tipo === 'linea') {
    const f = variable(gr.variable).frecuencias;
    return {...base, xAxis: {type: 'category', data: f.map(x => x.valor), axisLabel: {rotate: 30, fontSize: 10}}, yAxis: {type: 'value', name: 'filas'},
            series: [{type: gr.tipo === 'linea' ? 'line' : 'bar', data: f.map(x => x.conteo)}],
            tooltip: {formatter: p => `${esc(p.name)}: ${p.value} (${(100 * f[p.dataIndex].proporcion).toFixed(1)} %)`}};
  }
  if (gr.tipo === 'dispersion') {
    const d = E.dispersion.find(x => x.x === gr.x && x.y === gr.y);
    return {...base, xAxis: {type: 'value', name: gr.x, scale: true}, yAxis: {type: 'value', name: gr.y, scale: true},
            series: [{type: 'scatter', symbolSize: 5, data: d.puntos}], dataZoom: [{type: 'inside'}, {type: 'inside', yAxisIndex: 0}]};
  }
  if (gr.tipo === 'correlaciones') {
    const c = E.correlaciones, datos = [];
    c.matriz.forEach((fila, i) => fila.forEach((v, j) => datos.push([j, i, v])));
    return {...base, grid: {left: 130, right: 20, bottom: 110, top: 40}, tooltip: {formatter: p => `${c.variables[p.value[1]]} / ${c.variables[p.value[0]]}: r = ${p.value[2]}`},
            xAxis: {type: 'category', data: c.variables, axisLabel: {rotate: 45, fontSize: 10}}, yAxis: {type: 'category', data: c.variables, axisLabel: {fontSize: 10}},
            visualMap: {min: -1, max: 1, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 120, inRange: {color: ['#cf222e', '#ffffff', '#0969da']}},
            series: [{type: 'heatmap', data: datos}]};
  }
}
E.graficas.forEach((gr, i) => {
  $('graficas').insertAdjacentHTML('beforeend', `<div class="g" id="g${i}"></div>`);
  if (window.echarts) { const ch = echarts.init($('g' + i)); ch.setOption(opcion(gr)); addEventListener('resize', () => ch.resize()); }
  else $('g' + i).textContent = 'Las gráficas necesitan conexión a internet (ECharts).';
});
</script></body></html>
)HTML";

}  // namespace

void guardar_eda(const std::filesystem::path& carpeta, const json& reporte, const std::string& prefijo) {
    std::filesystem::create_directories(carpeta);
    std::ofstream(carpeta / (prefijo + ".json"), std::ios::binary) << reporte.dump(2);
    // "</" dentro de un <script> cerraría la etiqueta: se escapa como "<\/"
    std::string datos = reporte.dump(), seguro;
    for (size_t i = 0; i < datos.size(); ++i) {
        if (datos[i] == '<' && i + 1 < datos.size() && datos[i + 1] == '/') seguro += "<\\";
        else seguro += datos[i];
    }
    std::string html = PLANTILLA;
    html.replace(html.find("__DATOS__"), 9, seguro);
    std::ofstream(carpeta / (prefijo + ".html"), std::ios::binary) << html;
}
