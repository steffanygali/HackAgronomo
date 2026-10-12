
from pathlib import Path
import numpy as np
import pandas as pd

BASE = Path("/home/claude/proyecto")
LIM = BASE / "datos_limpios"
UMBRAL = 20
MAX_HUECO_SEM = 6  

par = pd.read_csv(LIM / "parcelas_integradas.csv")
clima = pd.read_csv(LIM / "clima_mensual_por_parcela.csv")
bas = pd.read_csv(LIM / "BASICO_utilizable_sin_nube_total.csv", parse_dates=["fecha"])
pro = pd.read_csv(LIM / "PRO_utilizable_sin_nube_total.csv", parse_dates=["fecha"])
bas = bas[bas.porcentaje_nubosidad <= UMBRAL]
pro = pro[pro.porcentaje_nubosidad <= UMBRAL]
s2, ls = bas[bas.sensor == "Sentinel-2"], bas[bas.sensor == "Landsat"]
SEM = pd.date_range("2025-01-06", "2025-12-29", freq="7D")  

def curva(df, col, pid, anio=2025):
    """Serie semanal interpolada para una parcela (NaN si hueco > MAX_HUECO_SEM)."""
    g = df[(df.ID_POLIGONO == pid) & (df.anio == anio)]
    if g.empty:
        return pd.Series(np.nan, index=SEM)
    d = g.groupby("fecha")[col].mean()
    if anio != 2025:  
        d.index = d.index + pd.DateOffset(years=2025 - anio)
    w = pd.Series(np.nan, index=SEM)
    for t in SEM:  
        sel = d[(d.index >= t - pd.Timedelta(days=3)) & (d.index < t + pd.Timedelta(days=4))]
        if len(sel):
            w[t] = sel.mean()
    return w.interpolate(limit=MAX_HUECO_SEM, limit_area="inside")


def fenologia(c, pref):
    """Rasgos fenológicos de una curva semanal (índice de vegetación)."""
    out = {f"{pref}_{k}": np.nan for k in ["base", "max", "amp", "doy_pico", "doy_arranque", "doy_senesc", "duracion",
                                           "media_jun_oct", "media_jul_sep", "auc_jun_oct", "pend_arranque"]}
    if c.notna().sum() < 8:
        return out
    cs = c.rolling(3, center=True, min_periods=1).median()
    doy = cs.index.dayofyear.values
    base = cs[cs.index.month <= 4].median()
    vent = cs[(cs.index.month >= 6) & (cs.index.month <= 11)]
    if vent.notna().sum() < 4:
        return out
    pico, doy_pico = vent.max(), vent.idxmax().dayofyear
    umb = base + 0.5 * (pico - base)
    antes = cs[(cs.index.dayofyear <= doy_pico)]
    despues = cs[(cs.index.dayofyear >= doy_pico)]
    ar = antes[antes >= umb]
    se = despues[despues <= umb]
    d_ar = ar.index[0].dayofyear if len(ar) else np.nan
    d_se = se.index[0].dayofyear if len(se) else np.nan
    jo = cs[(cs.index.month >= 6) & (cs.index.month <= 10)]
    js = cs[(cs.index.month >= 7) & (cs.index.month <= 9)]
    out.update({f"{pref}_base": base, f"{pref}_max": pico, f"{pref}_amp": pico - base, f"{pref}_doy_pico": doy_pico,
                f"{pref}_doy_arranque": d_ar, f"{pref}_doy_senesc": d_se, f"{pref}_duracion": d_se - d_ar,
                f"{pref}_media_jun_oct": jo.mean(), f"{pref}_media_jul_sep": js.mean(),
                f"{pref}_auc_jun_oct": np.trapezoid(jo.dropna().values) if jo.notna().sum() > 2 else np.nan,
                f"{pref}_pend_arranque": (pico - base) / max(doy_pico - d_ar, 7) if not np.isnan(d_ar) else np.nan})
    return out


def resumen_simple(c, pref):
    """Base (ene-abr), máximo y media jul-sep de una curva para índices secundarios."""
    if c.notna().sum() < 8:
        return {f"{pref}_base": np.nan, f"{pref}_max": np.nan, f"{pref}_jas": np.nan}
    return {f"{pref}_base": c[c.index.month <= 4].mean(), f"{pref}_max": c.max(), f"{pref}_jas": c[(c.index.month >= 7) & (c.index.month <= 9)].mean()}


filas, curvas = [], {}
for pid in par.ID_POLIGONO:
    f = {"ID_POLIGONO": pid}

    cp = curva(pro, "ndvi_promedio", pid); curvas[pid] = cp
    f.update(fenologia(cp, "pl_ndvi"))
    for idx in ["evi", "lai", "msavi"]:
        f.update(resumen_simple(curva(pro, f"{idx}_promedio", pid), f"pl_{idx}"))
    
    cs2 = curva(s2, "ndvi_promedio", pid)
    f.update(fenologia(cs2, "s2_ndvi"))
    for idx in ["evi", "savi", "lai", "fapar", "ndwi", "msi", "ndti", "ndsvi", "crc", "nddi"]:
        f.update(resumen_simple(curva(s2, f"{idx}_promedio", pid), f"s2_{idx}"))
    
    for nom, df in [("pl", pro), ("s2", s2)]:
        g = df[(df.ID_POLIGONO == pid) & (df.anio == 2025) & df.mes.between(7, 9)]
        f[f"{nom}_ndvi_std_jas"] = g.ndvi_std.mean() if len(g) else np.nan
        f[f"{nom}_n_obs_jas"] = len(g)
    
    g = ls[(ls.ID_POLIGONO == pid) & (ls.anio == 2025) & ls.mes.between(7, 9)]
    f["ls_vi6t_jas"] = g.vi6t_promedio.mean() if len(g) else np.nan
    f["ls_vi6t_std_jas"] = g.vi6t_std.mean() if len(g) else np.nan

    mx = []
    for a in [2022, 2023, 2024]:
        c = curva(s2, "ndvi_promedio", pid, anio=a)
        mx.append(c.max() if c.notna().sum() >= 8 else np.nan)
    f["s2_ndvi_max_hist"] = np.nanmean(mx) if not np.all(np.isnan(mx)) else np.nan
    f["s2_ndvi_anom_2025"] = f["s2_ndvi_max"] - f["s2_ndvi_max_hist"]
    filas.append(f)

F = pd.DataFrame(filas)


c25 = clima[clima.anio == 2025]
cl = c25[c25.mes.between(6, 9)].groupby("ID_POLIGONO").agg(prec_jun_sep=("prec_mm", "sum"), tmin_jun_sep=("tmin_c", "mean"),
                                                         tmax_jun_sep=("tmax_c", "mean"), amp_jun_sep=("amplitud_c", "mean")).reset_index()
cl2 = c25[c25.mes.between(4, 10)].groupby("ID_POLIGONO").agg(prec_ciclo=("prec_mm", "sum"), amp_ciclo=("amplitud_c", "mean")).reset_index()
cl3 = c25[c25.mes.between(1, 5)].groupby("ID_POLIGONO").agg(prec_pre_siembra=("prec_mm", "sum")).reset_index()
F = F.merge(cl, on="ID_POLIGONO").merge(cl2, on="ID_POLIGONO").merge(cl3, on="ID_POLIGONO")


est = par[["ID_POLIGONO", "AREA_HA", "elev_media", "pend_media", "lat", "lon", "municipio", "estado", "pix_clima", "CONJUNTO", "RENDIMIENTO_T_HA"]]
F = F.merge(est, on="ID_POLIGONO")
F["log_area"] = np.log(F.AREA_HA)
F.to_csv(LIM / "features_modelado.csv", index=False)

pd.DataFrame(curvas).T.rename(columns=lambda t: t.strftime("%m-%d")).to_csv(LIM / "curvas_ndvi_planet_semanal_2025.csv")
nulos = F.drop(columns=["RENDIMIENTO_T_HA"]).isna().mean().sort_values(ascending=False)
print(F.shape, "| columnas con nulos:", int((nulos > 0).sum()))
print(nulos[nulos > 0].round(3).head(15).to_string())
print(F[["pl_ndvi_max", "pl_ndvi_doy_pico", "pl_ndvi_doy_arranque", "pl_ndvi_duracion", "s2_ndvi_max", "s2_ndvi_max_hist"]].describe().round(2).T)
