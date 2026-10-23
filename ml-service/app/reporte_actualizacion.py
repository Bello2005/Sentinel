"""Reporte de actualización del modelo (actualizacion.json y actualizacion.html).

Contenido: descripción de los datos nuevos, comparación entre la versión activa y la candidata con la misma métrica
principal y métricas secundarias, recomendación y, cuando exista, la decisión registrada con su justificación.
"""
import html
import json


def _celda(v):
    return "—" if v is None else html.escape(str(v))


def escribir_reporte(carpeta, r):
    (carpeta / "actualizacion.json").write_text(json.dumps(r, ensure_ascii=False, indent=2), encoding="utf-8")
    lote, comp, rec, dec = r["lote"], r["comparacion"], r["recomendacion"], r["decision"]
    p = comp["principal"]
    filas = "".join(
        f"<tr><td>{_celda(s['metrica'])}</td><td>{_celda(s['activa'])}</td><td>{_celda(s['candidata'])}</td>"
        f"<td class='nota'>{_celda(s.get('nota'))}</td></tr>" for s in comp["secundarias"])
    coef = "".join(f"<tr><td>{k}</td><td>{r['activa']['coeficientes'].get(k)}</td><td>{v}</td></tr>"
                   for k, v in r["candidata"]["coeficientes"].items())
    if dec:
        color = "#1a7f37" if dec["accion"] == "activar" else "#cf222e"
        decision = (f"<p style='color:{color};font-weight:600'>{'Se activó' if dec['accion'] == 'activar' else 'Se rechazó'} "
                    f"la versión {r['candidata']['version']} el {_celda(dec['fecha'])}.</p>"
                    f"<p><b>Responsable:</b> {_celda(dec.get('responsable'))}</p>"
                    f"<p><b>Justificación:</b> {_celda(dec['justificacion'])}</p>"
                    f"<p><b>Versión activa antes de la decisión:</b> {_celda(dec['activo_previo'])}</p>")
    else:
        decision = "<p><b>Pendiente.</b> La candidata no reemplaza a la activa hasta que alguien registre la decisión.</p>"
    pagina = f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte de actualización</title><style>
:root{{color-scheme:light}}body{{font-family:system-ui,sans-serif;max-width:1000px;margin:2rem auto;padding:0 1rem;color:#1f2328;background:#fff}}
table{{border-collapse:collapse;width:100%;margin:1rem 0;font-size:14px}}th,td{{border:1px solid #d0d7de;padding:6px 8px;text-align:left}}
th{{background:#f6f8fa}}.nota{{color:#59636e;font-size:13px}}.big{{font-size:1.3rem;font-weight:600}}</style></head><body>
<h1>Reporte de actualización del modelo</h1>
<p class="nota">Actualización {_celda(r['id_actualizacion'])} · {_celda(r['fecha'])}</p>
<h2>Datos nuevos</h2>
<p>Archivo <b>{_celda(lote['archivo'])}</b>: {lote['registros']:,} registros ({lote['nuevos']:,} nuevos, {lote['reemplazados']:,} reemplazan
registros existentes), años objetivo {lote['anios_objetivo']}, {lote['choco']:,} de Chocó. Por tipo: {_celda(lote['por_tipo'])}.
Puntaje real promedio: {lote['puntaje_real_promedio']}.</p>
<p>Conjunto actualizado: {r['conjunto_actualizado']['registros']:,} registros, años {r['conjunto_actualizado']['anios_objetivo']}
(<code>{_celda(r['conjunto_actualizado']['archivo'])}</code>). El conjunto de la versión activa no se modificó.</p>
<h2>Comparación</h2>
<p><b>Métrica principal:</b> {_celda(p['metrica'])}</p>
<table><tr><th></th><th>Activa ({r['activa']['version']})</th><th>Candidata ({r['candidata']['version']})</th></tr>
<tr><td>MAE principal</td><td class="big">{_celda(p['activa'])}</td><td class="big">{_celda(p['candidata'])}</td></tr></table>
<table><tr><th>Métrica secundaria</th><th>Activa</th><th>Candidata</th><th>Nota</th></tr>{filas}</table>
<h3>Coeficientes</h3><table><tr><th>Variable</th><th>Activa</th><th>Candidata</th></tr>{coef}</table>
<h2>Recomendación del sistema: {_celda(rec['accion_sugerida'])}</h2>
<p class="nota">{_celda(rec['criterio'])} Le gana a las líneas base: {'sí' if rec['vence_lineas_base'] else 'no'}.
No empeora más de lo tolerado: {'sí' if rec['no_empeora'] else 'no'}. {_celda(rec['nota'])}</p>
<h2>Decisión</h2>{decision}
</body></html>"""
    (carpeta / "actualizacion.html").write_text(pagina, encoding="utf-8")
