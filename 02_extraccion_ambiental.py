import glob
from pathlib import Path
import numpy as np
import pandas as pd
import rasterio
from rasterio.mask import mask
import shapefile
from shapely.geometry import shape, mapping
from shapely.ops import transform
from pyproj import Transformer

BASE = Path("/home/claude/proyecto")
IN = BASE / "datos_originales/DATASET_RETO_AGRO_2026/_inner"
OUT, REP, LOGP = BASE / "datos_limpios", BASE / "reportes", BASE / "logs/registro_transformaciones.csv"
LOG = []


def log(dataset, problema, accion, justificacion, afectados):
    LOG.append(dict(dataset=dataset, problema=problema, accion=accion, justificacion=justificacion,
                    registros_afectados=int(afectados)))


# Parcelitas xd
sf = shapefile.Reader(str(IN / "Parcelas_Reto_AGC_CONJUNTO_70_30/Parcelas_Reto_AGC_CONJUNTO.shp"), encoding="utf-8")
rows, geoms = [], []
for sr in sf.shapeRecords():
    d = sr.record.as_dict()
    g = shape(sr.shape.__geo_interface__)
    g = transform(lambda x, y, z=None: (x, y), g)
    if not g.is_valid:
        log("parcelas_shp", f"Geometría inválida {d['ID_POLIGON']}", "buffer(0)", "Reparación topológica mínima", 1)
        g = g.buffer(0)
    c = g.centroid
    rows.append(dict(ID_POLIGONO=d["ID_POLIGON"], area_ha_shp=d["área_ha"], municipio=d["Municipio"], estado=d["Estado"],
                     cultivo_raw=d["Cultivo"], conjunto_shp=d["CONJUNTO"], lon=c.x, lat=c.y))
    geoms.append(g)
par = pd.DataFrame(rows)
par["cultivo"] = par.cultivo_raw.str.strip().str.capitalize()
log("parcelas_shp", "Cultivo con capitalización inconsistente (CEBADA/Cebada)", "Normalizado a 'Cebada'; original en cultivo_raw",
    "Evitar categorías duplicadas", (par.cultivo_raw != par.cultivo).sum())
assert par.ID_POLIGONO.is_unique and len(par) == 197

# comparacion con el dataset 
idr = pd.read_csv(BASE / "datos_limpios/rendimiento_limpio.csv")
m = par.merge(idr, on="ID_POLIGONO", how="outer", indicator=True)
print("merge:", m._merge.value_counts().to_dict())
par = m.drop(columns="_merge")
par["dif_area_ha"] = (par.area_ha_shp - par.AREA_HA).round(3)
par["conjunto_coincide"] = par.conjunto_shp == par.CONJUNTO
print("max |dif área|:", par.dif_area_ha.abs().max(), "| conjunto no coincide:", (~par.conjunto_coincide).sum())
log("parcelas_shp vs CSV", "Diferencias de área entre shapefile y CSV (> 0.01 ha)", "Solo reportadas",
    "Fuente de verdad no definida en documentación", (par.dif_area_ha.abs() > 0.01).sum())
log("parcelas_shp vs CSV", "CONJUNTO distinto entre shapefile y CSV", "Solo reportadas", "Verificación de consistencia", (~par.conjunto_coincide).sum())

# el climaaa 
def lee_serie(patron, nombre):
    out = []
    for f in sorted(glob.glob(str(IN / patron))):
        anio, mes = int(Path(f).stem.split("_")[1]), int(Path(f).stem.split("_")[2])
        with rasterio.open(f) as r:
            arr = r.read(1)
            filas, cols = rasterio.transform.rowcol(r.transform, par.lon.values, par.lat.values)
            v = arr[np.array(filas), np.array(cols)].astype("float64")
            nod = r.nodata
            v[v == nod] = np.nan
            out.append(pd.DataFrame(dict(ID_POLIGONO=par.ID_POLIGONO, anio=anio, mes=mes, **{nombre: v},
                                         **{f"{nombre}_pix": [f"{a}_{b}" for a, b in zip(filas, cols)]})))
    return pd.concat(out, ignore_index=True)

prec = lee_serie("Reto_AgroCebada_CHIRPS_Precipitacion_2022_2025/*/Precipitacion_mensual/*/PREC_*.tif", "prec_mm")
tmin = lee_serie("Reto_AgroCebada_Temperatura_2022_2025_RECORTADA_CHIRPS/*/Tmin/*/Tmin_*.tif", "tmin_c")
tmax = lee_serie("Reto_AgroCebada_Temperatura_2022_2025_RECORTADA_CHIRPS/*/Tmax/*/Tmax_*.tif", "tmax_c")
clima = prec.drop(columns="prec_mm_pix").merge(tmin.drop(columns="tmin_c_pix"), on=["ID_POLIGONO", "anio", "mes"]) \
                .merge(tmax.drop(columns="tmax_c_pix"), on=["ID_POLIGONO", "anio", "mes"])
print("Clima:", clima.shape, "| nulos:", clima[["prec_mm", "tmin_c", "tmax_c"]].isna().sum().to_dict())
npix = prec[prec.anio == 2025].groupby("mes").prec_mm_pix.nunique().iloc[0]
par["pix_clima"] = prec[(prec.anio == 2025) & (prec.mes == 1)].prec_mm_pix.values
log("clima", f"Resolución 0.05°: las 197 parcelas caen en solo {npix} píxeles distintos", "Documentado como limitación",
    "Poca variabilidad espacial climática entre parcelas", 197)
clima["tmedia_c"] = (clima.tmin_c + clima.tmax_c) / 2
clima["amplitud_c"] = clima.tmax_c - clima.tmin_c
clima.to_csv(OUT / "clima_mensual_por_parcela.csv", index=False)
bad = (clima.tmin_c > clima.tmax_c).sum()
print("Tmin>Tmax:", bad, "| prec<0:", (clima.prec_mm < 0).sum())

# topgrafias (ya me queme el cerebro)
tr = Transformer.from_crs("EPSG:4326", "EPSG:6372", always_xy=True)
topo = {}
for nombre, patron in [("elev", "Reto_AgroCebada_Topografia_INEGI_CEM4/*/*/Elevacion_*.tif"),
                       ("pend", "Reto_AgroCebada_Topografia_INEGI_CEM4/*/*/Pendiente_*.tif")]:
    f = glob.glob(str(IN / patron))[0]
    res = []
    with rasterio.open(f) as r:
        for pid, g in zip(par.ID_POLIGONO, geoms):
            gp = transform(tr.transform, g)
            try:
                arr, _ = mask(r, [mapping(gp)], crop=True, all_touched=True, nodata=-9999.0)
                v = arr[0][arr[0] != -9999.0]
            except ValueError:
                v = np.array([])
            res.append(dict(ID_POLIGONO=pid, **{f"{nombre}_media": v.mean() if len(v) else np.nan,
                                                f"{nombre}_min": v.min() if len(v) else np.nan,
                                                f"{nombre}_max": v.max() if len(v) else np.nan,
                                                f"{nombre}_std": v.std() if len(v) else np.nan,
                                                f"{nombre}_npix": len(v)}))
    topo[nombre] = pd.DataFrame(res)
tp = topo["elev"].merge(topo["pend"], on="ID_POLIGONO")
print("Topo nulos:", tp.isna().sum()[lambda s: s > 0].to_dict()); print(tp.describe().T[["min", "mean", "max"]].round(2))
log("topografia", "Parcelas más pequeñas que el píxel de 120 m (npix pequeño)", "all_touched=True; se reporta *_npix",
    "Estadísticos zonales con pocos píxeles son poco fiables", (tp.elev_npix <= 4).sum())
par = par.merge(tp, on="ID_POLIGONO")
par.to_csv(OUT / "parcelas_integradas.csv", index=False)

ciclo = clima[(clima.anio == 2025) & clima.mes.between(4, 10)].groupby("ID_POLIGONO").agg(
    prec_ciclo_mm=("prec_mm", "sum"), tmin_ciclo_c=("tmin_c", "mean"), tmax_ciclo_c=("tmax_c", "mean"),
    amplitud_ciclo_c=("amplitud_c", "mean")).reset_index()
ciclo.to_csv(OUT / "clima_ciclo2025_por_parcela_DERIVADO.csv", index=False)

old = pd.read_csv(LOGP)
pd.concat([old, pd.DataFrame(LOG)], ignore_index=True).to_csv(LOGP, index=False)
print(pd.DataFrame(LOG)[["dataset", "problema", "registros_afectados"]].to_string())
print(par[["municipio", "estado"]].value_counts().head(3)); print("pix clima distintos:", par.pix_clima.nunique())
