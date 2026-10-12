from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats

BASE = Path("/home/claude/proyecto")
LIM, REP, GRA = BASE / "datos_limpios", BASE / "reportes", BASE / "graficas"
UMBRAL = 20
sns.set_theme(style="whitegrid")

par = pd.read_csv(LIM / "parcelas_integradas.csv")
ciclo_clima = pd.read_csv(LIM / "clima_ciclo2025_por_parcela_DERIVADO.csv")
bas = pd.read_csv(LIM / "BASICO_utilizable_sin_nube_total.csv", parse_dates=["fecha"])
pro = pd.read_csv(LIM / "PRO_utilizable_sin_nube_total.csv", parse_dates=["fecha"])
ent = par[par.CONJUNTO == "ENTRENAMIENTO"]

#ESTADISTICAS 
def descr(df, nombre):
    out = []
    for s, g in df.groupby("sensor"):
        cols = [c for c in g.columns if c.endswith("_promedio") and g[c].notna().any()]
        d = g[cols].agg(["count", "mean", "median", "std", "var", "min", "max"]).T
        d["moda"] = [g[c].round(3).mode().iloc[0] if g[c].notna().any() else np.nan for c in cols]
        d[["q05", "q25", "q75", "q95"]] = g[cols].quantile([.05, .25, .75, .95]).T.values
        d["cv"] = d["std"] / d["mean"].abs()
        d.insert(0, "sensor", s); d.insert(0, "dataset", nombre); out.append(d.reset_index(names="variable"))
    return pd.concat(out)
desc = pd.concat([descr(bas, "BASICO"), descr(pro, "PRO")])
desc.round(4).to_csv(REP / "eda_estadistica_descriptiva_indices.csv", index=False)

# Valores atipicos 
at = []
for nombre, df in [("BASICO", bas), ("PRO", pro)]:
    for s, g in df.groupby("sensor"):
        for c in [c for c in g.columns if c.endswith("_promedio") and g[c].notna().any()]:
            x = g[c].dropna(); q1, q3 = x.quantile([.25, .75]); i = q3 - q1
            n = int(((x < q1 - 1.5 * i) | (x > q3 + 1.5 * i)).sum())
            at.append(dict(dataset=nombre, sensor=s, variable=c, n=len(x), atipicos_iqr=n, pct=round(n / len(x) * 100, 2)))
at = pd.DataFrame(at); at.to_csv(REP / "eda_atipicos_iqr.csv", index=False)

# extras de la parcela 
def agrega(df, cols, prefijo, umbral):
    g = df[df.en_ciclo_2025 & (df.porcentaje_nubosidad <= umbral)]
    a = g.groupby("ID_POLIGONO")[cols].agg(["mean", "max", "std"])
    a.columns = [f"{prefijo}_{c.replace('_promedio', '')}_{f}" for c, f in a.columns]
    a[f"{prefijo}_n_obs"] = g.groupby("ID_POLIGONO").size()
    return a

s2 = bas[bas.sensor == "Sentinel-2"]; ls = bas[bas.sensor == "Landsat"]
cols_s2 = ["ndvi_promedio", "evi_promedio", "savi_promedio", "lai_promedio", "fapar_promedio", "ndwi_promedio", "msi_promedio",
           "ndti_promedio", "ndsvi_promedio", "nddi_promedio"]
cols_pl = ["ndvi_promedio", "evi_promedio", "lai_promedio", "msavi_promedio"]

#sensibilidad 
sens = []
for u in [0, 5, 10, 20, 30, 50, 100]:
    for nom, df, pref in [("Sentinel-2", s2, "s2"), ("Planet", pro, "pl")]:
        a = agrega(df, ["ndvi_promedio"], pref, u).reindex(ent.ID_POLIGONO)
        y = ent.set_index("ID_POLIGONO").RENDIMIENTO_T_HA
        for f in ["mean", "max"]:
            x = a[f"{pref}_ndvi_{f}"]; ok = x.notna()
            r, p = stats.spearmanr(x[ok], y[ok])
            sens.append(dict(umbral=u, sensor=nom, estadistico=f"ndvi_{f}", n_parcelas=int(ok.sum()), spearman=round(r, 3), p=round(p, 4)))
sens = pd.DataFrame(sens); sens.to_csv(REP / "eda_sensibilidad_umbral_nubosidad.csv", index=False)
print(sens.pivot_table(index=["sensor", "estadistico"], columns="umbral", values="spearman").to_string())

feat = par[["ID_POLIGONO"]].copy().set_index("ID_POLIGONO")
for a in [agrega(s2, cols_s2, "s2", UMBRAL), agrega(pro, cols_pl, "pl", UMBRAL), agrega(ls, ["vi6t_promedio"], "ls", UMBRAL)]:
    feat = feat.join(a)
feat = feat.reset_index().merge(par.drop(columns=["conjunto_coincide"]), on="ID_POLIGONO").merge(ciclo_clima, on="ID_POLIGONO")
feat.to_csv(LIM / "features_parcela_ciclo2025_EXPLORATORIO.csv", index=False)
print("parcelas sin obs S2/PL/LS tras filtro:", feat.s2_n_obs.isna().sum(), feat.pl_n_obs.isna().sum(), feat.ls_n_obs.isna().sum())

# rendimiento 
y = ent.RENDIMIENTO_T_HA
print("Rend:", y.describe().round(2).to_dict(), "| skew", round(y.skew(), 2), "| Shapiro p", round(stats.shapiro(y)[1], 4))
fig, axs = plt.subplots(1, 3, figsize=(15, 4.5))
sns.histplot(y, kde=True, ax=axs[0]); axs[0].set(title="Distribución del rendimiento (parcelas de entrenamiento)", xlabel="Rendimiento (t/ha)", ylabel="Parcelas")
order = ent.groupby("municipio").RENDIMIENTO_T_HA.median().sort_values().index
sns.boxplot(data=ent, y="municipio", x="RENDIMIENTO_T_HA", order=order, ax=axs[1]); axs[1].set(title="Rendimiento por municipio", xlabel="Rendimiento (t/ha)", ylabel="")
sns.scatterplot(data=ent, x="AREA_HA", y="RENDIMIENTO_T_HA", hue="estado", ax=axs[2]); axs[2].set(title="Rendimiento vs. área de la parcela", xlabel="Área (ha)", ylabel="Rendimiento (t/ha)")
fig.tight_layout(); fig.savefig(GRA / "05_rendimiento.png", dpi=130); plt.close(fig)
mun = ent.groupby("municipio").RENDIMIENTO_T_HA.agg(["count", "mean", "median", "std", "min", "max"]).round(2)
mun.to_csv(REP / "eda_rendimiento_por_municipio.csv")
print(mun)
kw = stats.kruskal(*[g.RENDIMIENTO_T_HA.values for _, g in ent.groupby("municipio") if len(g) >= 3])
print("Kruskal rendimiento~municipio (municipios n>=3):", kw)

# Entremamiento y predicción 
cmp = []
for v in ["AREA_HA", "elev_media", "pend_media", "lat", "lon"]:
    a, b = par[par.CONJUNTO == "ENTRENAMIENTO"][v], par[par.CONJUNTO == "PREDICCION"][v]
    ks = stats.ks_2samp(a, b)
    cmp.append(dict(variable=v, media_ent=a.mean(), media_pred=b.mean(), ks=ks.statistic, p_ks=ks.pvalue))
cmp = pd.DataFrame(cmp).round(4); cmp.to_csv(REP / "eda_entrenamiento_vs_prediccion.csv", index=False); print(cmp)
prop = pd.crosstab(par.municipio, par.CONJUNTO, normalize="columns").round(3); print(prop)
prop.to_csv(REP / "eda_municipio_por_conjunto.csv")

# Correlacion de las variables 
corr_idx = s2[[c for c in cols_s2 + ["crc_promedio", "mcrc_promedio", "srndi_promedio", "mra_promedio", "sti_promedio", "endwi_promedio",
                                    "emsi_promedio", "dswi2_promedio", "dswi3_promedio", "dswi4_promedio", "dswi5_promedio", "enddi_promedio"]]].corr(method="spearman")
corr_idx.round(3).to_csv(REP / "eda_correlacion_indices_sentinel2.csv")
fig, ax = plt.subplots(figsize=(11, 9))
sns.heatmap(corr_idx, cmap="coolwarm", center=0, annot=True, fmt=".1f", annot_kws={"size": 6}, ax=ax)
ax.set(title="Correlación de Spearman entre índices (promedio por observación, Sentinel-2)")
fig.tight_layout(); fig.savefig(GRA / "06_correlacion_indices_s2.png", dpi=130); plt.close(fig)
pares = corr_idx.where(np.triu(np.ones(corr_idx.shape), 1).astype(bool)).stack()
alta = pares[pares.abs() >= 0.95].sort_values(key=abs, ascending=False)
print("Pares con |rho|>=0.95:", len(alta), "de", len(pares)); print(alta.head(12).round(3))

# relación parcela
fe = feat[feat.CONJUNTO == "ENTRENAMIENTO"]
cand = [c for c in feat.columns if c.startswith(("s2_", "pl_", "ls_")) and not c.endswith("_n_obs")] + \
       ["AREA_HA", "elev_media", "pend_media", "prec_ciclo_mm", "tmin_ciclo_c", "tmax_ciclo_c", "amplitud_ciclo_c"]
rs = []
for c in cand:
    x = fe[c]; ok = x.notna() & fe.RENDIMIENTO_T_HA.notna()
    if ok.sum() >= 30 and x[ok].nunique() > 2:
        r, p = stats.spearmanr(x[ok], fe.RENDIMIENTO_T_HA[ok]); rs.append(dict(variable=c, n=int(ok.sum()), spearman=r, p=p))
rs = pd.DataFrame(rs).sort_values("spearman", key=abs, ascending=False)
rs["p_bonferroni"] = (rs.p * len(rs)).clip(upper=1); rs.round(4).to_csv(REP / "eda_spearman_vs_rendimiento.csv", index=False)
print("n pruebas:", len(rs)); print(rs.head(12).round(3).to_string())
fig, ax = plt.subplots(figsize=(8, 7))
top = rs.head(20).iloc[::-1]
ax.barh(top.variable, top.spearman, color=np.where(top.spearman > 0, "tab:green", "tab:red"))
ax.set(title="Top 20 |Spearman| con el rendimiento (parcelas de entrenamiento, n≈138)", xlabel="Spearman ρ")
fig.tight_layout(); fig.savefig(GRA / "07_spearman_vs_rendimiento.png", dpi=130); plt.close(fig)

# clima: variación 
print("Variación entre parcelas (std) clima ciclo:", ciclo_clima.drop(columns="ID_POLIGONO").std().round(2).to_dict())
print("Corr clima-ciclo vs elevación (Spearman):", {c: round(stats.spearmanr(feat[c], feat.elev_media)[0], 2) for c in ["prec_ciclo_mm", "tmin_ciclo_c", "tmax_ciclo_c"]})

#Dato temporal 
fig, axs = plt.subplots(1, 2, figsize=(15, 4.8))
s2m = s2[s2.porcentaje_nubosidad <= UMBRAL].assign(ym=lambda d: d.fecha.dt.to_period("M").dt.to_timestamp()).groupby("ym").ndvi_promedio.agg(["mean", "std"])
axs[0].plot(s2m.index, s2m["mean"], marker=".", label="Sentinel-2"); axs[0].fill_between(s2m.index, s2m["mean"] - s2m["std"], s2m["mean"] + s2m["std"], alpha=.2)
axs[0].set(title=f"NDVI mensual medio entre parcelas, Sentinel-2 2022-2025 (nube ≤{UMBRAL}%)", xlabel="Mes", ylabel="NDVI (adimensional)")
for nom, df, col in [("Sentinel-2", s2, "C0"), ("Planet", pro, "C1")]:
    g = df[(df.anio == 2025) & (df.porcentaje_nubosidad <= UMBRAL)].assign(sem=lambda d: d.fecha.dt.to_period("W").dt.start_time).groupby("sem").ndvi_promedio.mean()
    axs[1].plot(g.index, g.values, label=nom, color=col)
axs[1].axvspan(pd.Timestamp("2025-04-01"), pd.Timestamp("2025-10-31"), alpha=.1, color="green", label="Ciclo abr-oct")
axs[1].set(title="NDVI semanal 2025: Sentinel-2 vs Planet (nube ≤20%)", xlabel="Semana", ylabel="NDVI (adimensional)"); axs[1].legend()
fig.tight_layout(); fig.savefig(GRA / "08_ndvi_temporal.png", dpi=130); plt.close(fig)

# comparabilidad 
w = lambda df: df[(df.anio == 2025) & (df.porcentaje_nubosidad <= UMBRAL)].assign(sem=lambda d: d.fecha.dt.to_period("W")).groupby(["ID_POLIGONO", "sem"]).ndvi_promedio.mean()
j = pd.concat([w(s2).rename("s2"), w(pro).rename("pl")], axis=1).dropna()
print("Pares parcela-semana S2/Planet:", len(j), "| Spearman:", round(stats.spearmanr(j.s2, j.pl)[0], 3), "| sesgo medio (pl-s2):", round((j.pl - j.s2).mean(), 3))

# gráfico de caja de NDVI por sensor y ciclo
fig, ax = plt.subplots(figsize=(7, 4.5))
dd = pd.concat([s2.assign(fuente="Sentinel-2")[["fuente", "ndvi_promedio"]], pro.assign(fuente="Planet")[["fuente", "ndvi_promedio"]]])
sns.boxplot(data=dd, x="fuente", y="ndvi_promedio", ax=ax); ax.set(title="Distribución del NDVI por fuente (observaciones válidas)", xlabel="Fuente", ylabel="NDVI (adimensional)")
fig.tight_layout(); fig.savefig(GRA / "09_boxplot_ndvi_fuente.png", dpi=130); plt.close(fig)

print("\nATÍPICOS (top):"); print(at.sort_values("pct", ascending=False).head(8).to_string())
