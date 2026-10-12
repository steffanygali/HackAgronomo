#Tecnica usada clustering
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
from sklearn.cluster import KMeans, AgglomerativeClustering
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest
from sklearn.feature_selection import mutual_info_regression
from sklearn.metrics import silhouette_score, adjusted_rand_score
from sklearn.preprocessing import StandardScaler

BASE = Path("/home/claude/proyecto"); LIM, REP, GRA = BASE / "datos_limpios", BASE / "reportes", BASE / "graficas"
sns.set_theme(style="whitegrid"); RS = 42
F = pd.read_csv(LIM / "features_modelado.csv")
curv = pd.read_csv(LIM / "curvas_ndvi_planet_semanal_2025.csv", index_col=0).reindex(F.ID_POLIGONO)
curv = curv.apply(lambda r: r.interpolate(limit_direction="both"), axis=1)  
print("Curvas:", curv.shape, "| nulos restantes:", int(curv.isna().sum().sum()))

# cluster por curvas 
Z = StandardScaler().fit_transform(curv.values)
pca = PCA(n_components=8, random_state=RS).fit(Z)
P = pca.transform(Z)
print("Varianza explicada PCA curvas (primeros 5):", pca.explained_variance_ratio_[:5].round(3))
res = []
for k in range(2, 9):
    km = KMeans(k, n_init=20, random_state=RS).fit(P[:, :5])
    res.append(dict(k=k, silueta=silhouette_score(P[:, :5], km.labels_), inercia=km.inertia_))
res = pd.DataFrame(res); print(res.round(3).to_string()); res.to_csv(REP / "mineria_clustering_seleccion_k.csv", index=False)
K = int(res.loc[res.silueta.idxmax(), "k"]); print("k elegido por silueta:", K)
km = KMeans(K, n_init=20, random_state=RS).fit(P[:, :5]); F["cluster_fenologico"] = km.labels_
ward = AgglomerativeClustering(K).fit_predict(P[:, :5]); print("Concordancia KMeans vs Ward (ARI):", round(adjusted_rand_score(km.labels_, ward), 3))
ent = F[F.CONJUNTO == "ENTRENAMIENTO"]
tab = pd.crosstab(F.municipio, F.cluster_fenologico); tab.to_csv(REP / "mineria_cluster_vs_municipio.csv"); print(tab)
chi = stats.chi2_contingency(pd.crosstab(F.municipio, F.cluster_fenologico)); print("chi2 cluster~municipio p =", round(chi[1], 5))
cr = ent.groupby("cluster_fenologico").RENDIMIENTO_T_HA.agg(["count", "mean", "std"]).round(2); print(cr)
kw = stats.kruskal(*[g.RENDIMIENTO_T_HA.values for _, g in ent.groupby("cluster_fenologico")]); print("Kruskal rend~cluster p =", round(kw.pvalue, 5))
# el cluster aporta más allá del municipio? 
ch = ent[ent.municipio == "Chignahuapan"]
if ch.cluster_fenologico.nunique() > 1:
    print("Dentro de Chignahuapan: Kruskal rend~cluster p =", round(stats.kruskal(*[g.RENDIMIENTO_T_HA.values for _, g in ch.groupby("cluster_fenologico") if len(g) > 2]).pvalue, 4),
          ch.groupby("cluster_fenologico").RENDIMIENTO_T_HA.agg(["count", "mean"]).round(2).to_dict())
cols = curv.columns
fig, axs = plt.subplots(1, 2, figsize=(15, 5))
for c in range(K):
    m = curv[km.labels_ == c]; axs[0].plot(range(len(cols)), m.mean(), label=f"Cluster {c} (n={len(m)})")
    axs[0].fill_between(range(len(cols)), m.quantile(.1), m.quantile(.9), alpha=.12)
axs[0].set_xticks(range(0, len(cols), 4)); axs[0].set_xticklabels(cols[::4], rotation=45)
axs[0].set(title="Curvas fenológicas de NDVI (Planet 2025) por cluster: media y banda p10-p90", xlabel="Semana (mm-dd)", ylabel="NDVI (adimensional)"); axs[0].legend()
sc = axs[1].scatter(P[:, 0], P[:, 1], c=km.labels_, cmap="tab10", s=25)
for m_ in F.municipio.unique():
    pass
sns.scatterplot(x=P[:, 0], y=P[:, 1], hue=F.municipio, ax=axs[1], s=28, legend="brief")
axs[1].set(title="PCA de curvas de NDVI coloreado por municipio (cluster en el análisis)", xlabel=f"PC1 ({pca.explained_variance_ratio_[0]*100:.0f}%)", ylabel=f"PC2 ({pca.explained_variance_ratio_[1]*100:.0f}%)")
fig.tight_layout(); fig.savefig(GRA / "10_clustering_fenologia.png", dpi=130); plt.close(fig)

#PCA 
excl = ["RENDIMIENTO_T_HA", "lat", "lon", "pix_clima", "AREA_HA"]
num = F.select_dtypes("number").drop(columns=excl + ["cluster_fenologico", "anomalia_score"], errors="ignore")
num = num.loc[:, num.nunique() > 3]
Zr = StandardScaler().fit_transform(num.fillna(num.median()))
pr = PCA(random_state=RS).fit(Zr); cum = pr.explained_variance_ratio_.cumsum()
n90, n95 = int(np.argmax(cum >= .9) + 1), int(np.argmax(cum >= .95) + 1)
print(f"Rasgos: {num.shape[1]} | componentes para 90 % varianza: {n90}, para 95 %: {n95}")
fig, ax = plt.subplots(figsize=(7, 4.2)); ax.plot(range(1, len(cum) + 1), cum, marker="."); ax.axhline(.9, ls="--", c="gray")
ax.set(title="Varianza acumulada del PCA sobre los rasgos por parcela", xlabel="Número de componentes", ylabel="Varianza explicada acumulada"); fig.tight_layout(); fig.savefig(GRA / "11_pca_varianza_rasgos.png", dpi=130); plt.close(fig)
cargas = pd.DataFrame(pr.components_[:3].T, index=num.columns, columns=["PC1", "PC2", "PC3"]); cargas.round(3).to_csv(REP / "mineria_pca_cargas.csv")
print("Top cargas PC1:", cargas.PC1.abs().sort_values(ascending=False).head(6).index.tolist())

#Vemos diferencias 
iso = IsolationForest(n_estimators=500, contamination=0.05, random_state=RS).fit(Zr)
F["anomalia_score"] = -iso.score_samples(Zr); F["flag_parcela_anomala"] = iso.predict(Zr) == -1
an = F[F.flag_parcela_anomala][["ID_POLIGONO", "municipio", "CONJUNTO", "AREA_HA", "RENDIMIENTO_T_HA", "anomalia_score"]].sort_values("anomalia_score", ascending=False)
an.to_csv(REP / "mineria_parcelas_anomalas.csv", index=False); print("Parcelas anómalas:", len(an)); print(an.head(8).round(2).to_string())

# ---------- 4. Información mutua vs Spearman ----------
e = F[F.CONJUNTO == "ENTRENAMIENTO"]; X = e[num.columns].fillna(num.median())
mi = mutual_info_regression(X, e.RENDIMIENTO_T_HA, random_state=RS, n_neighbors=5)
sp = [stats.spearmanr(X[c], e.RENDIMIENTO_T_HA)[0] for c in X.columns]
imp = pd.DataFrame({"variable": X.columns, "info_mutua": mi, "spearman": sp}).sort_values("info_mutua", ascending=False)
imp.round(4).to_csv(REP / "mineria_info_mutua_vs_spearman.csv", index=False); print(imp.head(12).round(3).to_string())
F.to_csv(LIM / "features_modelado.csv", index=False)
