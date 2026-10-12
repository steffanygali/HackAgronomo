
from pathlib import Path
import warnings
import numpy as np
import pandas as pd
from scipy import stats
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
SAT = [c for c in F.columns if c.startswith(("pl_", "s2_", "ls_")) and "n_obs" not in c] + ["log_area", "elev_media", "pend_media"]
E = F[F.CONJUNTO == "ENTRENAMIENTO"].reset_index(drop=True); P = F[F.CONJUNTO == "PREDICCION"].reset_index(drop=True)
assert len(E) == 138 and len(P) == 59 and P.RENDIMIENTO_T_HA.isna().all() and E.RENDIMIENTO_T_HA.notna().all()
y = E.RENDIMIENTO_T_HA.values


def predecir(Dtr, ytr, Dte, usar_knn_otros):
    """Ajusta con Dtr/ytr y predice Dte. Devuelve (final, base, ridge_resid)."""
    med = pd.Series(ytr).groupby(Dtr.mun_g.values).median(); gm = np.median(ytr)
    base_tr = Dtr.mun_g.map(med).values; base_te = Dte.mun_g.map(med).fillna(gm).values
    if usar_knn_otros:  
        kn = KNeighborsRegressor(3, weights="distance").fit(Dtr[["x_km", "y_km"]].values, ytr)
        m = (Dte.mun_g == "Otros").values
        if m.any():
            base_te = base_te.copy(); base_te[m] = kn.predict(Dte.loc[m, ["x_km", "y_km"]].values)
    r = ytr - base_tr
    imp = SimpleImputer(strategy="median").fit(Dtr[SAT]); Xtr = imp.transform(Dtr[SAT]); Xte = imp.transform(Dte[SAT])
    sc = StandardScaler().fit(Xtr); Xtr, Xte = sc.transform(Xtr), sc.transform(Xte)
    corr = np.array([abs(stats.spearmanr(Xtr[:, j], r)[0]) if Xtr[:, j].std() > 0 else 0 for j in range(Xtr.shape[1])])
    sel = np.argsort(-np.nan_to_num(corr))[:10]
    rr = Ridge(50).fit(Xtr[:, sel], r).predict(Xte[:, sel])
    return 0.5 * base_te + 0.5 * (base_te + 0.5 * rr), base_te, rr


SPL = list(RepeatedKFold(n_splits=5, n_repeats=4, random_state=42).split(E)); NREP = 4
oof = {k: np.zeros((NREP, len(E))) for k in [False, True]}
for k in [False, True]:
    for i, (tr, te) in enumerate(SPL):
        oof[k][i // 5, te] = predecir(E.iloc[tr], y[tr], E.iloc[te], k)[0]
mo = (E.mun_g == "Otros").values
for k in [False, True]:
    print(f"usar_knn_otros={k}: RMSE total={np.mean([np.sqrt(np.mean((y - oof[k][r]) ** 2)) for r in range(NREP)]):.3f} | "
          f"RMSE solo 'Otros' (n={mo.sum()})={np.mean([np.sqrt(np.mean((y[mo] - oof[k][r][mo]) ** 2)) for r in range(NREP)]):.3f}")
rm = {k: np.mean([np.sqrt(np.mean((y[mo] - oof[k][r][mo]) ** 2)) for r in range(NREP)]) for k in [False, True]}
USAR_KNN = bool(rm[True] < rm[False]); print("Decisión 'Otros' -> KNN espacial:", USAR_KNN)
o = oof[USAR_KNN].mean(0); res = y - o
met = dict(rmse=float(np.sqrt(np.mean((y - oof[USAR_KNN]) ** 2))), mae=float(np.mean(np.abs(y - oof[USAR_KNN]))),
           r2=float(np.mean([1 - np.sum((y - oof[USAR_KNN][r]) ** 2) / np.sum((y - y.mean()) ** 2) for r in range(NREP)])))
print("Métricas CV finales:", {k: round(v, 3) for k, v in met.items()}); pd.DataFrame([met]).round(4).to_csv(REP / "prediccion_final_metricas_cv.csv", index=False)

pool = np.quantile(np.abs(res), 0.9); semi = {}
for g in E.mun_g.unique():
    ix = (E.mun_g == g).values; semi[g] = np.quantile(np.abs(res[ix]), 0.9) if ix.sum() >= 10 else pool
cov = np.mean([abs(res[i]) <= semi[E.mun_g.iloc[i]] for i in range(len(E))]); print("Semi-anchos 90 % (t/ha):", {k: round(v, 2) for k, v in semi.items()}, "| cobertura OOF:", round(float(cov), 3))


fin, base, rr = predecir(E, y, P, USAR_KNN)
out = pd.DataFrame({"ID_parcela": P.ID_POLIGONO, "rendimiento_predicho_ton_ha": np.round(fin, 3),
                    "limite_inf_90": np.round(fin - P.mun_g.map(semi).values, 3), "limite_sup_90": np.round(fin + P.mun_g.map(semi).values, 3),
                    "municipio": P.municipio, "componente_municipal": np.round(base, 3), "ajuste_satelital": np.round(fin - base, 3)})
out.to_csv(REP / "predicciones_parcelas_PREDICCION.csv", index=False)
print(out.describe().round(3).T[["min", "mean", "max"]]); print(out.groupby("municipio").rendimiento_predicho_ton_ha.agg(["count", "mean"]).round(2))
pd.DataFrame({"ID_POLIGONO": E.ID_POLIGONO, "municipio": E.municipio, "obs": y, "oof_pred": o.round(3), "resid": res.round(3)}).to_csv(REP / "prediccion_final_oof.csv", index=False)
