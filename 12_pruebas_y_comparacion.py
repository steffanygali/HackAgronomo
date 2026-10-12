#pythonzzz vs RGod 
import hashlib, numpy as np, pandas as pd
from pathlib import Path
B = Path("."); OK = []
def t(nombre, cond, detalle=""):
    OK.append(dict(prueba=nombre, resultado="OK" if cond else "FALLA", detalle=detalle)); assert cond, f"{nombre}: {detalle}"
import zipfile, io
z = zipfile.ZipFile("/mnt/user-data/uploads/DataSet__1_.zip"); nombre = [n for n in z.namelist() if n.endswith("Conjunto_datos_PRO_AgroCebada.csv")][0]
t("Original PRO idéntico al entregado", hashlib.md5(z.read(nombre)).hexdigest() == hashlib.md5(open(f"datos_originales/{nombre}", "rb").read()).hexdigest() if Path(f"datos_originales/{nombre}").exists() else (_ for _ in ()).throw(FileNotFoundError(nombre)))

pro = pd.read_csv("datos_limpios/PRO_limpio_completo.csv"); bas = pd.read_csv("datos_limpios/BASICO_limpio_completo.csv")
t("PRO filas = 47,804", len(pro) == 47804); t("BASICO filas = 107,666", len(bas) == 107666)
t("PRO sin_indices = 12,057", int(pro.sin_indices.sum()) == 12057); t("BASICO sin_indices = 31,741", int(bas.sin_indices.sum()) == 31741)
t("Sin duplicados (ID,fecha,sensor)", not pro.duplicated(["ID_POLIGONO", "fecha", "sensor"]).any() and not bas.duplicated(["ID_POLIGONO", "fecha", "sensor"]).any())

f = pd.read_csv("datos_limpios/features_modelado.csv"); e = f[f.CONJUNTO == "ENTRENAMIENTO"]; t("197 parcelas únicas", f.ID_POLIGONO.nunique() == 197)
t("Sin NaN en rasgos (excepto rendimiento)", int(f.drop(columns=["RENDIMIENTO_T_HA"]).select_dtypes("number").isna().sum().sum()) == 0)
t("Rendimiento nulo solo en PREDICCION", f[f.RENDIMIENTO_T_HA.isna()].CONJUNTO.eq("PREDICCION").all() and f[f.CONJUNTO == "ENTRENAMIENTO"].RENDIMIENTO_T_HA.notna().all())

p = pd.read_csv("reportes/predicciones_parcelas_PREDICCION.csv"); pred_ids = set(f[f.CONJUNTO == "PREDICCION"].ID_POLIGONO)
t("59 predicciones", len(p) == 59); t("IDs = parcelas PREDICCION", set(p.ID_parcela) == pred_ids and p.ID_parcela.is_unique)
t("Sin NaN en predicciones", p.rendimiento_predicho_ton_ha.notna().all()); y = f.RENDIMIENTO_T_HA.dropna()
t("Predicciones en rango plausible", p.rendimiento_predicho_ton_ha.between(y.min() - 0.5, y.max() + 0.5).all(), f"{p.rendimiento_predicho_ton_ha.min()}–{p.rendimiento_predicho_ton_ha.max()}")
t("Intervalos ordenados", (p.limite_inf_90 < p.rendimiento_predicho_ton_ha).all() and (p.rendimiento_predicho_ton_ha < p.limite_sup_90).all())

r = pd.read_csv("reportes_R/spearman_vs_rendimiento.csv"); e = f[f.CONJUNTO == "ENTRENAMIENTO"]
from scipy import stats
mm = []
for _, row in r.iterrows():
    ok = e[row.variable].notna() & e.RENDIMIENTO_T_HA.notna() if row.variable in e else None
    if ok is None: continue
    py = stats.spearmanr(e[row.variable][ok], e.RENDIMIENTO_T_HA[ok])[0] if False else None
src = pd.read_csv("datos_limpios/features_parcela_ciclo2025_EXPLORATORIO.csv"); se = src[src.CONJUNTO == "ENTRENAMIENTO"]
cmp = []
for _, row in r.iterrows():
    ok = se[row.variable].notna() & se.RENDIMIENTO_T_HA.notna(); py = stats.spearmanr(se[row.variable][ok], se.RENDIMIENTO_T_HA[ok])[0]
    cmp.append(dict(variable=row.variable, rho_python=round(py, 6), rho_R=round(row.rho, 6), dif_abs=abs(py - row.rho)))
cmp = pd.DataFrame(cmp); cmp.to_csv("reportes/comparacion_python_vs_R.csv", index=False); print(cmp.to_string())
t("Spearman Python = R (tol 1e-6)", (cmp.dif_abs < 1e-6).all(), f"max dif {cmp.dif_abs.max():.2e}")
ne = pd.read_csv("reportes_R/ndvi_estadisticos.csv"); d = pd.read_csv("reportes/eda_estadistica_descriptiva_indices.csv")
for _, row in ne.iterrows():
    pyv = d[(d.sensor == row.sensor) & (d.variable == "ndvi_promedio")].iloc[0]
    t(f"NDVI media/n {row.sensor} Python=R", abs(pyv["mean"] - row.media) < 1e-4 and int(pyv["count"]) == int(row.n), f"n={row.n}")
# 6) EDA en R (14_eda_ggplot.R) vs Python
rr = pd.read_csv("reportes_R/resumen_numerico_R.csv").set_index("metrica").valor_R
mun = [m for m, g in e.groupby("municipio") if len(g) >= 3]
kw = stats.kruskal(*[e[e.municipio == m].RENDIMIENTO_T_HA.values for m in mun]).pvalue
t("Kruskal rendimiento~municipio R = Python", abs(np.log10(rr["kruskal_p_rend_municipio"]) - np.log10(kw)) < 1e-6, f"R={rr['kruskal_p_rend_municipio']:.3e} Py={kw:.3e}")
t("Spearman global amp_ciclo R = Python", abs(rr["spearman_global_amp_ciclo"] - stats.spearmanr(e.amp_ciclo, e.RENDIMIENTO_T_HA)[0]) < 1e-9)
t("Rendimiento medio entrenamiento R = Python", abs(rr["rendimiento_media_entrenamiento"] - e.RENDIMIENTO_T_HA.mean()) < 1e-9)
oo = pd.read_csv("reportes/prediccion_final_oof.csv"); t("RMSE OOF (predicción promedio) R = Python", abs(rr["oof_rmse"] - np.sqrt((oo.resid ** 2).mean())) < 1e-6)
pd.DataFrame(OK).to_csv("reportes/pruebas_pipeline.csv", index=False); print(pd.DataFrame(OK).to_string())
