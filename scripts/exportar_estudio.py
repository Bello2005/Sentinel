"""Exporta los resultados del estudio Saber 11 · Chocó a un solo JSON para la landing pública de SENTINEL.

Uso (desde sistema-web/):
    ../.venv/bin/python scripts/exportar_estudio.py --geo-municipios mpio.json --geo-departamentos depto.json

Lee los resultados ya calculados por el proyecto de análisis (carpeta padre: resultados/, informe/graficas/,
datos/*.parquet) y los límites del DANE (GeoJSON de municipios y departamentos). Escribe
frontend/public/estudio/estudio.json: solo datos agregados (departamento, municipio, colegio), nunca de estudiantes.

Las geometrías salen proyectadas (equirectangular con corrección de latitud) y simplificadas (Douglas-Peucker), como
trazos SVG listos para dibujar: la web no necesita librerías de mapas.
"""
import argparse
import json
import math
from datetime import date
from pathlib import Path

import duckdb
import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
ESTUDIO = RAIZ.parent                      # proyecto de análisis saber11-choco
RES = ESTUDIO / "resultados"
SALIDA = RAIZ / "frontend" / "public" / "estudio" / "estudio.json"
COD_CHOCO = "27"
QUIBDO_CABECERA = (-76.6611, 5.6947)  # lon, lat de la cabecera municipal


def r(x, d=2):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(float(x), d)


def csv(ruta, **kw):
    return pd.read_csv(ruta, encoding="utf-8-sig", **kw)


# --- Geometría -----------------------------------------------------------------------------------------------------
def douglas_peucker(puntos, tol):
    if len(puntos) < 3:
        return puntos
    marcar = [False] * len(puntos)
    marcar[0] = marcar[-1] = True
    pila = [(0, len(puntos) - 1)]
    while pila:
        a, b = pila.pop()
        (x1, y1), (x2, y2) = puntos[a], puntos[b]
        dx, dy = x2 - x1, y2 - y1
        norma = math.hypot(dx, dy)
        lejos, idx = 0.0, -1
        for i in range(a + 1, b):
            x0, y0 = puntos[i]
            # En un anillo cerrado el primer y el último punto coinciden: se usa la distancia a ese punto
            d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / norma if norma > 1e-9 else math.hypot(x0 - x1, y0 - y1)
            if d > lejos:
                lejos, idx = d, i
        if lejos > tol and idx > 0:
            marcar[idx] = True
            pila += [(a, idx), (idx, b)]
    return [p for p, m in zip(puntos, marcar) if m]


def anillos(geom):
    if geom["type"] == "Polygon":
        return geom["coordinates"]
    if geom["type"] == "MultiPolygon":
        return [anillo for poligono in geom["coordinates"] for anillo in poligono]
    return []


def proyectar(features, ancho, tol_rel, area_min_rel=0.0, puntos=None):
    """Proyecta y simplifica: devuelve viewBox y, por rasgo, el trazo SVG y su centroide aproximado.
    `puntos` ({nombre: (lon, lat)}) se proyectan con la misma escala y salen en caja["puntos"]."""
    todos = [(x, y) for f in features for an in anillos(f["geometry"]) for x, y in an]
    lat0 = sum(y for _, y in todos) / len(todos)
    k = math.cos(math.radians(lat0))
    xs = [x * k for x, _ in todos]
    ys = [-y for _, y in todos]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    esc = ancho / (maxx - minx)
    alto = (maxy - miny) * esc
    tol = tol_rel * ancho
    salida = []
    for f in features:
        partes, area_total, cx_acum, cy_acum = [], 0.0, 0.0, 0.0
        for an in anillos(f["geometry"]):
            pts = [((x * k - minx) * esc, (-y - miny) * esc) for x, y in an]
            area = 0.5 * abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts))))
            if area < area_min_rel * ancho * ancho:
                continue  # islotes invisibles a esta escala
            simp = douglas_peucker(pts, tol)
            if len(simp) < 4:
                continue
            partes.append("M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in simp[:-1]) + "Z")
            cx_acum += area * sum(p[0] for p in pts) / len(pts)
            cy_acum += area * sum(p[1] for p in pts) / len(pts)
            area_total += area
        if partes:
            salida.append({"d": "".join(partes), "cx": r(cx_acum / area_total, 1), "cy": r(cy_acum / area_total, 1),
                           "props": f["properties"]})
    caja = {"viewBox": f"0 0 {ancho} {alto:.0f}", "ancho": ancho, "alto": round(alto)}
    if puntos:
        caja["puntos"] = {n: {"cx": r((x * k - minx) * esc, 1), "cy": r((-y - miny) * esc, 1)} for n, (x, y) in puntos.items()}
    return caja, salida


# --- Secciones -----------------------------------------------------------------------------------------------------
def evolucion():
    g = csv(RES / "global_por_anio.csv").dropna()
    z = csv(RES / "z_por_anio.csv")
    gen = csv(RES / "brecha_genero.csv")
    ing = csv(RES / "ingles_b1.csv")
    return {
        "puntaje": {"anios": g.anio.astype(int).tolist(), "choco": [r(x, 1) for x in g["Chocó"]],
                    "resto": [r(x, 1) for x in g["Resto del país"]], "brecha": [r(x, 1) for x in g["Brecha (puntos)"]]},
        "z_matematicas": {"anios": z.anio.astype(int).tolist(), "choco": [r(x, 3) for x in z.matematicas]},
        "z_global": {"anios": z.dropna(subset=["global"]).anio.astype(int).tolist(),
                     "choco": [r(x, 3) for x in z["global"].dropna()]},
        "genero_matematicas": {"anios": gen.anio.astype(int).tolist(), "choco": [r(x, 3) for x in gen["Chocó"]],
                               "resto": [r(x, 3) for x in gen["Resto del país"]]},
        "ingles_b1": {"anios": ing.anio.astype(int).tolist(), "choco": [r(x, 2) for x in ing["Chocó"]],
                      "resto": [r(x, 2) for x in ing["Resto del país"]]},
    }


def departamentos(geo_deptos):
    rk = csv(RES / "ranking_departamentos.csv", dtype={"depto_cod": str})
    rk["depto_cod"] = rk.depto_cod.str.zfill(2)
    codigos = dict(zip(rk.depto_nombre, rk.depto_cod))
    za = csv(RES / "estudio" / "2_1_departamentos_por_anio.csv")
    anios = [c for c in za.columns if c != "depto"]
    series = [{"cod": codigos.get(row.depto), "nombre": row.depto, "z": [r(row[a], 3) for a in anios]}
              for _, row in za.iterrows()]
    ranking = [{"cod": c, "nombre": n, "puntaje": r(p, 1), "estudiantes": int(e)}
               for n, c, p, e in zip(rk.depto_nombre, rk.depto_cod, rk.prom, rk.n)]
    ranking.sort(key=lambda x: x["puntaje"])
    # Mapa nacional sin San Andrés (las islas estirarían el mapa); se lista igual en el ranking
    feats = [f for f in geo_deptos["features"] if f["properties"]["DPTO"] != "88"]
    caja, trazos = proyectar(feats, 520, 0.0016, area_min_rel=2e-6)
    mapa = {**caja, "deptos": [{"cod": t["props"]["DPTO"], "d": t["d"], "cx": t["cx"], "cy": t["cy"]} for t in trazos]}
    return {"ranking_ultimo_anio": ranking, "z_por_anio": {"anios": [int(a) for a in anios], "series": series}, "mapa": mapa}


def municipios(geo_mpios):
    p = pd.read_parquet(ESTUDIO / "datos" / "panel_municipal.parquet")
    pais = p.dropna(subset=["saber_puntaje_global"])
    corte_10 = pais.saber_puntaje_global.quantile(0.10)
    c = p[p.depto_cod == COD_CHOCO].copy()
    c["en_10_mas_bajo"] = c.saber_puntaje_global <= corte_10
    # Puesto 1 = mejor puntaje del país
    pais = pais.assign(puesto=pais.saber_puntaje_global.rank(ascending=False, method="min"))
    puestos = dict(zip(pais.mcpio_cod, pais.puesto))
    filas = []
    for _, m in c.iterrows():
        filas.append({
            "cod": m.mcpio_cod, "nombre": m.municipio, "estudiantes": int(m.saber_estudiantes) if pd.notna(m.saber_estudiantes) else None,
            "colegios": int(m.saber_colegios) if pd.notna(m.saber_colegios) else None,
            "puntaje": r(m.saber_puntaje_global, 1), "z": r(m.saber_z_global, 3), "cambio_z": r(m.saber_cambio_z, 3),
            "pct_top10_pais": r(m.saber_pct_top10_pais, 1), "ipm": r(m.ipm, 1),
            "cobertura_media": r(m.men_cobertura_neta_media, 1), "internet_hogar": r(m.hogar_pct_internet, 1),
            "madre_profesional": r(m.hogar_pct_madre_profesional, 1), "etnia": r(m.saber_pct_etnia_2020, 1),
            "puesto_pais": int(puestos[m.mcpio_cod]) if m.mcpio_cod in puestos else None,
            "en_10_mas_bajo": bool(m.en_10_mas_bajo),
        })
    feats = [f for f in geo_mpios["features"] if str(f["properties"]["DPTO"]).zfill(2) == COD_CHOCO]
    # El marcador va en la cabecera real: el municipio de Quibdó rodea a Medio Atrato y su centroide cae fuera de él
    caja, trazos = proyectar(feats, 420, 0.0012, area_min_rel=4e-7, puntos={"quibdo": QUIBDO_CABECERA})
    mapa = {**caja, "municipios": [{"cod": t["props"]["MPIOS"], "nombre_mapa": t["props"]["NOMBRE_MPI"], "d": t["d"],
                                      "cx": t["cx"], "cy": t["cy"]} for t in trazos]}
    con_dato = [f for f in filas if f["puntaje"] is not None]
    return {"lista": filas, "mapa": mapa, "total_municipios_pais": int(len(pais)),
            "en_10_mas_bajo": sum(f["en_10_mas_bajo"] for f in con_dato), "con_dato": len(con_dato),
            "corte_10_pais": r(corte_10, 1)}


def distribucion(cif):
    pc = csv(RES / "estudio" / "1_3_brecha_por_percentil.csv")
    return {"percentiles": pc.percentil.astype(int).tolist(), "choco": pc["Chocó"].tolist(),
            "resto": pc["Resto del país"].tolist(), "estadisticos": cif["distribucion"],
            "extremos": {"Chocó": cif["extremos_choco"], "Resto del país": cif["extremos_resto"]}}


def brecha():
    pasos = csv(RES / "brecha" / "1_brecha_paso_a_paso.csv")
    pasos = pasos[~pasos.modelo.str.contains("robustez")]
    pares = csv(RES / "brecha" / "5_chocó_vs_pares_por_anio.csv")
    grupos = {}
    for g, d in pares.groupby("grupo", sort=False):
        grupos[g] = {"anios": d.anio.astype(int).tolist(), "bruta": [r(x, 3) for x in d.bruta_z],
                     "ajustada": [r(x, 3) for x in d.ajustada_z]}
    qv = csv(RES / "estudio" / "3_2_capital_vs_resto.csv").dropna()
    esperado = csv(RES / "brecha" / "7d_municipios_vs_esperado.csv", dtype={"mcpio_cod": str})
    colegios = csv(RES / "brecha" / "7c_colegios_quibdo_vs_esperado.csv", dtype={"colegio": str})
    return {
        "pasos": [{"paso": m.split(". ", 1)[1] if ". " in m else m, "brecha": r(b, 1), "ee": r(e, 1)}
                  for m, b, e in zip(pasos.modelo, pasos.brecha, pasos.ee)],
        "pares_por_anio": grupos,
        "quibdo_vs_resto": {"anios": qv.anio.astype(int).tolist(), "quibdo": [r(x, 3) for x in qv["Quibdó"]],
                            "resto": [r(x, 3) for x in qv["Resto de Chocó"]]},
        "municipios_vs_esperado": [{"municipio": m, "departamento": dp, "valor": r(v, 1), "puesto": int(pu), "estudiantes": int(es)}
                                   for m, dp, v, pu, es in zip(esperado.municipio, esperado.departamento,
                                                               esperado.frente_a_lo_esperado, esperado.puesto, esperado.estudiantes)][:12],
        "total_municipios_comparados": int(len(esperado)),
        "colegios_quibdo": [{"nombre": n.title(), "naturaleza": t, "estudiantes": int(e), "puntaje": r(p, 1), "frente": r(v, 1)}
                            for n, t, e, p, v in zip(colegios.nombre, colegios.naturaleza, colegios.estudiantes,
                                                     colegios.puntaje, colegios.frente_a_lo_esperado)],
    }


def pacifico():
    d = csv(RES / "estudio" / "2_2_pacifico.csv")
    return [{"municipio": m.title(), "depto": dp, "choco": bool(e), "estudiantes": int(n), "puntaje": r(p, 1)}
            for m, dp, e, n, p in zip(d.municipio, d.depto, d.es_dep, d.n, d.puntaje)]


def modelo():
    meta = json.loads((RAIZ / "shared" / "models" / "v1" / "metadata.json").read_text())
    v = meta["validacion"]
    return {"version": meta["version"], "coeficientes": meta["configuracion"]["coeficientes"],
            "mae": {"modelo": v["mae_choco"], "promedio_3": v["lineas_base"]["promedio_3_mae_choco"],
                    "persistencia": v["lineas_base"]["persistencia_mae_choco"]},
            "intervalo_80": meta["intervalo_80"], "registros": meta["datos"]["registros"]}


HIPOTESIS = [  # Actividad 3 (10_actividad3_auditoria.ipynb, sección 8)
    {"id": "H1", "titulo": "El hogar explica la mayor parte de la brecha",
     "resultado": "Comparando hogares iguales la brecha baja de 45 a 33-35 puntos: el hogar explica cerca del 25 %.", "veredicto": "No respaldada"},
    {"id": "H2", "titulo": "Los colegios oficiales y rurales explican la brecha",
     "resultado": "Agregar el tipo de colegio casi no cambia la brecha (−33,8 → −33,2).", "veredicto": "No respaldada"},
    {"id": "H3", "titulo": "La pandemia agrandó la brecha",
     "resultado": "A igual hogar, Quibdó −0,50 en 2019 y 2020; resto del Chocó −0,72 y −0,68 (falta 2021).", "veredicto": "No respaldada"},
    {"id": "H4", "titulo": "Es un atraso regional del Pacífico",
     "resultado": "Chocó promedia 205 y la costa pacífica 209; con controles, Chocó −16,8 y el resto del Pacífico −11,7.", "veredicto": "Parcialmente respaldada"},
    {"id": "H5", "titulo": "Los hombres superan a las mujeres en matemáticas",
     "resultado": "En el país los hombres sacan 0,27 desviaciones más; en el Chocó, −0,02: no hay diferencia.", "veredicto": "No respaldada"},
    {"id": "H6", "titulo": "La formación docente pesa en la brecha",
     "resultado": "Los docentes de la secretaría bajan la brecha de −14,3 a −9,5; ~20 % con posgrado en el Chocó vs 57-62 % en Nariño.", "veredicto": "Parcialmente respaldada"},
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--geo-municipios", type=Path, required=True)
    ap.add_argument("--geo-departamentos", type=Path, required=True)
    a = ap.parse_args()
    cif = json.loads((ESTUDIO / "informe" / "graficas" / "cifras_graficas.json").read_text())
    total = duckdb.sql(f"SELECT count(*) FROM '{ESTUDIO / 'datos' / 'saber11_limpio.parquet'}'").fetchone()[0]
    muni = municipios(json.loads(a.geo_municipios.read_text()))
    dep = departamentos(json.loads(a.geo_departamentos.read_text()))
    evo = evolucion()
    salida = {
        "generado": date.today().isoformat(),
        "fuentes": ["ICFES · Resultados únicos Saber 11 (datos.gov.co, CC BY-SA 4.0)", "MEN · estadísticas educativas por municipio",
                    "DANE · pobreza multidimensional (censo 2018) y marco geoestadístico (límites)",
                    "Unidad para las Víctimas · desplazamiento", "MinTIC · internet fijo"],
        "resumen": {
            "estudiantes": int(total), "anios": "2010–2022", "departamentos": len(dep["ranking_ultimo_anio"]),
            # Puesto contado desde el mejor (el ranking está ordenado de menor a mayor puntaje)
            "puesto_choco": len(dep["ranking_ultimo_anio"]) - next(i for i, d in enumerate(dep["ranking_ultimo_anio"]) if d["cod"] == COD_CHOCO),
            "brecha_ultimo_anio": evo["puntaje"]["brecha"][-1], "anio_ultimo": evo["puntaje"]["anios"][-1],
            "municipios_10_mas_bajo": muni["en_10_mas_bajo"], "municipios_con_dato": muni["con_dato"],
            "pct_cuartil_bajo": cif["extremos_choco"]["25 % más bajo"], "pct_10_mas_alto": cif["extremos_choco"]["10 % más alto"],
            "estudiantes_choco": cif["distribucion"]["Chocó"]["n"],
        },
        "evolucion": evo,
        "departamentos": dep,
        "municipios": muni,
        "distribucion": distribucion(cif),
        "materias": cif["materias"], "ingles": cif["ingles"], "genero": cif["genero"],
        "hogar": {"madre": cif["madre"], "bienes_pct": cif["bienes_pct"], "bienes_puntaje": cif["bienes_puntaje"],
                  "estrato": cif["estrato"], "tipo_colegio": cif["tipo_colegio"], "correlaciones": cif["correlaciones"]},
        "brecha": brecha(),
        "pacifico": pacifico(),
        "hipotesis": HIPOTESIS,
        "modelo": modelo(),
    }
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{SALIDA.relative_to(RAIZ)}: {SALIDA.stat().st_size / 1024:.0f} KB · {muni['con_dato']} municipios · "
          f"{len(dep['mapa']['deptos'])} departamentos en el mapa · Chocó puesto {salida['resumen']['puesto_choco']} de {salida['resumen']['departamentos']}")


if __name__ == "__main__":
    main()
