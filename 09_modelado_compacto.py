from pathlib import Path
import warnings
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.ensemble import RandomForestRegressor
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import ConstantKernel as C, RBF, WhiteKernel
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.model_selection import RepeatedKFold
from sklearn.neighbors import KNeighborsRegressor
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")
BASE = Path("/home/claude/proyecto"); LIM, REP = BASE / "datos_limpios", BASE / "reportes"
F = pd.read_csv(LIM / "features_modelado.csv")
cnt = F.municipio.value_counts(); F["mun_g"] = np.where(F.municipio.map(cnt) >= 9, F.municipio, "Otros")
F["x_km"] = (F.lon + 98.4) * 111.32 * np.cos(np.radians(19.75)); F["y_km"] = (F.lat - 19.75) * 110.57
E = F[F.CONJUNTO == "ENTRENAMIENTO"].reset_index(drop=True); y = E.RENDIMIENTO_T_HA.values
SAT = [c for c in F.columns if c.startswith(("pl_", "s2_", "ls_")) and "n_obs" not in c] + ["log_area", "elev_media", "pend_media"]
XY = E[["x_km", "y_km"]].values
SPL = list(RepeatedKFold(n_splits=5, n_repeats=4, random_state=42).split(E)); NREP = 4
print("Dispersión espacial (km): x", E.x_km.max() - E.x_km.min(), "| y", E.y_km.max() - E.y_km.min())


def med_mun(tr, idx):
    m = pd.Series(y[tr]).groupby(E.mun_g.values[tr]).median()
    return E.mun_g.iloc[idx].map(m).fillna(np.median(y[tr])).values


def mean_shrink(tr, idx, k=3):
    g = pd.Series(y[tr]).groupby(E.mun_g.values[tr]).agg(["mean", "count"]); gm = y[tr].mean()
    s = (g["count"] * g["mean"] + k * gm) / (g["count"] + k)
    return E.mun_g.iloc[idx].map(s).fillna(gm).values


def knn_pred(tr, te, k, target=None):
    t = y[tr] if target is None else target
    return KNeighborsRegressor(min(k, len(tr)), weights="distance").fit(XY[tr], t).predict(XY[te])


def gp_pred(tr, te, target):
    ker = C(0.5) * RBF(length_scale=5.0, length_scale_bounds=(0.5, 60)) + WhiteKernel(0.2, (1e-3, 2))
    mu, sd = target.mean(), target.std() + 1e-9
    g = GaussianProcessRegressor(ker, normalize_y=False, n_restarts_optimizer=2, random_state=0).fit(XY[tr], (target - mu) / sd)
    return g.predict(XY[te]) * sd + mu


def resid_ridge(tr, te, kbest, alpha, w):
    r = y[tr] - med_mun(tr, tr)  
    X = SimpleImputer(strategy="median").fit(E.iloc[tr][SAT]); Xtr = X.transform(E.iloc[tr][SAT]); Xte = X.transform(E.iloc[te][SAT])
    sc = StandardScaler().fit(Xtr); Xtr, Xte = sc.transform(Xtr), sc.transform(Xte)
    corr = np.array([abs(stats.spearmanr(Xtr[:, j], r)[0]) if Xtr[:, j].std() > 0 else 0 for j in range(Xtr.shape[1])])
    sel = np.argsort(-np.nan_to_num(corr))[:kbest]
    return med_mun(tr, te) + w * Ridge(alpha).fit(Xtr[:, sel], r).predict(Xte[:, sel])


def resid_rf(tr, te, w):
    r = y[tr] - med_mun(tr, tr)
    Xtr = SimpleImputer(strategy="median").fit_transform(E.iloc[tr][SAT]); imp = SimpleImputer(strategy="median").fit(E.iloc[tr][SAT])
    rf = RandomForestRegressor(300, max_features=0.33, min_samples_leaf=4, random_state=1, n_jobs=1).fit(imp.transform(E.iloc[tr][SAT]), r)
    return med_mun(tr, te) + w * rf.predict(imp.transform(E.iloc[te][SAT]))


M = {
    "Base: mediana municipio": lambda tr, te: med_mun(tr, te),
    "Media municipio con contracción (k=3)": lambda tr, te: mean_shrink(tr, te, 3),
    **{f"KNN espacial k={k}": (lambda tr, te, k=k: knn_pred(tr, te, k)) for k in [3, 5, 8, 12]},
    "Mediana mun. + KNN residuos k=5": lambda tr, te: med_mun(tr, te) + knn_pred(tr, te, 5, y[tr] - med_mun(tr, tr)),
    "Mediana mun. + KNN residuos k=8 (x0.5)": lambda tr, te: med_mun(tr, te) + 0.5 * knn_pred(tr, te, 8, y[tr] - med_mun(tr, tr)),
    "GP espacial (coordenadas)": lambda tr, te: gp_pred(tr, te, y[tr]),
    "Mediana mun. + GP espacial de residuos": lambda tr, te: med_mun(tr, te) + gp_pred(tr, te, y[tr] - med_mun(tr, tr)),
    "Mediana mun. + Ridge(3 var. satélite)": lambda tr, te: resid_ridge(tr, te, 3, 30, 1.0),
    "Mediana mun. + Ridge(5 var. satélite)": lambda tr, te: resid_ridge(tr, te, 5, 30, 1.0),
    "Mediana mun. + Ridge(10 var., x0.5)": lambda tr, te: resid_ridge(tr, te, 10, 50, 0.5),
    "Mediana mun. + RF residuos satélite (x0.5)": lambda tr, te: resid_rf(tr, te, 0.5),
}
OOF, rows = {}, []
for nm, fn in M.items():
    o = np.zeros((NREP, len(E)))
    for i, (tr, te) in enumerate(SPL):
        o[i // 5, te] = fn(tr, te)
    OOF[nm] = o
    rm = [np.sqrt(np.mean((y - o[r]) ** 2)) for r in range(NREP)]; ma = [np.mean(np.abs(y - o[r])) for r in range(NREP)]
    r2 = [1 - np.sum((y - o[r]) ** 2) / np.sum((y - y.mean()) ** 2) for r in range(NREP)]
    nc = E.municipio.values != "Calpulalpan"
    rows.append(dict(modelo=nm, rmse=np.mean(rm), rmse_sd=np.std(rm), mae=np.mean(ma), r2=np.mean(r2), rmse_sin_Calpulalpan=np.mean([np.sqrt(np.mean((y[nc] - o[r][nc]) ** 2)) for r in range(NREP)])))
    print(f"{nm:46s} RMSE={rows[-1]['rmse']:.3f} MAE={rows[-1]['mae']:.3f} R2={rows[-1]['r2']:.3f}", flush=True)
R = pd.DataFrame(rows).sort_values("rmse"); R.round(4).to_csv(REP / "modelado_compacto_cv.csv", index=False)

# prueba pareada por parcela:
best = R.iloc[0].modelo; base = "Base: mediana municipio"
d = ((y - OOF[best].mean(0)) ** 2) - ((y - OOF[base].mean(0)) ** 2) if False else (np.mean((y - OOF[best]) ** 2, 0) - np.mean((y - OOF[base]) ** 2, 0))
w = stats.wilcoxon(d) if best != base else None
print("\nMejor:", best, "| Δ MSE medio por parcela vs base:", d.mean().round(4), "| Wilcoxon p:", None if w is None else round(w.pvalue, 4))
pd.DataFrame({"ID": E.ID_POLIGONO, "municipio": E.municipio, "y": y, "oof_best": OOF[best].mean(0), "oof_base": OOF[base].mean(0)}).to_csv(REP / "modelado_compacto_oof.csv", index=False)
print("Ensamble base+mejor 2:", end=" ")
top2 = R.head(2).modelo.tolist(); en = np.mean([OOF[t] for t in top2], 0); print(top2, "RMSE", np.mean([np.sqrt(np.mean((y - en[r]) ** 2)) for r in range(NREP)]).round(3))
