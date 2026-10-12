
import numpy as np, pandas as pd
from scipy import stats
from sklearn.model_selection import RepeatedKFold
from sklearn.linear_model import RidgeCV
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
rng = np.random.default_rng(42)
F = pd.read_csv("datos_limpios/features_modelado.csv"); cnt = F.municipio.value_counts(); F["mun_g"] = np.where(F.municipio.map(cnt) >= 9, F.municipio, "Otros")
E = F[F.CONJUNTO == "ENTRENAMIENTO"].reset_index(drop=True)
X = E.select_dtypes("number").drop(columns=["RENDIMIENTO_T_HA", "lat", "lon", "cluster_fenologico", "anomalia_score"], errors="ignore")
X = X.loc[:, X.nunique() > 3]; X = X.fillna(X.median())
CLIM = ["prec_jun_sep", "tmin_jun_sep", "tmax_jun_sep", "amp_jun_sep", "prec_ciclo", "amp_ciclo", "prec_pre_siembra"]
g = E.mun_g.values; y = E.RENDIMIENTO_T_HA.values
yc = y - pd.Series(y).groupby(g).transform("mean").values; Xc = X - X.groupby(g).transform("mean")
def maxrho(yv):
    r = np.array([np.corrcoef(Xc[c].rank(), pd.Series(yv).rank())[0, 1] if Xc[c].std() > 0 else 0 for c in Xc.columns]); return r
obs = maxrho(yc); order = np.argsort(-np.abs(obs))
null = []
for _ in range(1000):
    yp = yc.copy()
    for m in np.unique(g):
        i = np.where(g == m)[0]; yp[i] = rng.permutation(yc[i])
    null.append(np.abs(maxrho(yp)).max())
null = np.array(null); p_max = lambda r: (np.sum(null >= abs(r)) + 1) / (len(null) + 1)
tab = pd.DataFrame({"variable": Xc.columns[order][:15], "rho_intra_municipio": obs[order][:15], "p_ajustada_permutacion": [p_max(obs[i]) for i in order[:15]]})
tab["es_clima"] = tab.variable.isin(CLIM); tab.round(4).to_csv("reportes/senal_intra_municipio_permutacion.csv", index=False)
print("max|rho| observado:", abs(obs).max().round(3), "| nulo p95:", np.quantile(null, .95).round(3), "| nulo mediana:", np.median(null).round(3)); print(tab.round(3).head(10).to_string())
# CV dentro de Chignahuapan
for mun in ["Chignahuapan", "Singuilucan"]:
    D = E[E.mun_g == mun].reset_index(drop=True); Xd = D[X.columns].fillna(X.median()); yd = D.RENDIMIENTO_T_HA.values
    res = {"base": [], "ridge": [], "rf": []}
    for tr, te in RepeatedKFold(n_splits=5, n_repeats=10, random_state=1).split(D):
        res["base"].append(np.mean((yd[te] - np.median(yd[tr])) ** 2))
        m = make_pipeline(SimpleImputer(), StandardScaler(), RidgeCV(alphas=np.logspace(0, 4, 20))).fit(Xd.iloc[tr], yd[tr]); res["ridge"].append(np.mean((yd[te] - m.predict(Xd.iloc[te])) ** 2))
        m = RandomForestRegressor(200, max_features=.33, min_samples_leaf=3, random_state=0).fit(Xd.iloc[tr], yd[tr]); res["rf"].append(np.mean((yd[te] - m.predict(Xd.iloc[te])) ** 2))
    print(mun, len(D), {k: round(float(np.sqrt(np.mean(v))), 3) for k, v in res.items()}, "| sd y:", yd.std().round(3))
