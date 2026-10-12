from pathlib import Path
import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import ExtraTreesRegressor, GradientBoostingRegressor, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import RidgeCV
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import RepeatedKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
import lightgbm as lgb

warnings.filterwarnings("ignore")
BASE = Path("/home/claude/proyecto"); LIM, REP, GRA = BASE / "datos_limpios", BASE / "reportes", BASE / "graficas"
sns.set_theme(style="whitegrid"); RS = 42
F = pd.read_csv(LIM / "features_modelado.csv")

# municipios con algunas observaciones :D 
cnt = F.municipio.value_counts()
F["mun_g"] = np.where(F.municipio.map(cnt) >= 9, F.municipio, "Otros")
print(F.mun_g.value_counts().to_dict())

SAT = [c for c in F.columns if c.startswith(("pl_", "s2_", "ls_")) and "n_obs" not in c]
TOPO = ["log_area", "elev_media", "pend_media"]
CLIMA = ["prec_jun_sep", "tmin_jun_sep", "tmax_jun_sep", "amp_jun_sep", "prec_ciclo", "amp_ciclo", "prec_pre_siembra"]
GEO = ["lat", "lon"]
SETS = {"S: satélite+topografía": SAT + TOPO,
        "S+C: + clima": SAT + TOPO + CLIMA,
        "S+M: + municipio/coord.": SAT + TOPO + GEO + ["mun_g"],
        "Todo": SAT + TOPO + CLIMA + GEO + ["mun_g"]}
E = F[F.CONJUNTO == "ENTRENAMIENTO"].reset_index(drop=True); y = E.RENDIMIENTO_T_HA.values
P = F[F.CONJUNTO == "PREDICCION"].reset_index(drop=True)
assert len(E) == 138 and len(P) == 59 and P.RENDIMIENTO_T_HA.isna().all()


def prep(cols, escalar):
    num = [c for c in cols if c != "mun_g"]
    t = [("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler() if escalar else "passthrough"), num)]
    if "mun_g" in cols:
        t.append(("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), ["mun_g"]))
    return ColumnTransformer(t)


MODELOS = {
    "Ridge": (lambda: RidgeCV(alphas=np.logspace(-1, 3, 20)), True),
    "RandomForest": (lambda: RandomForestRegressor(300, max_features=0.33, min_samples_leaf=2, random_state=RS, n_jobs=1), False),
    "ExtraTrees": (lambda: ExtraTreesRegressor(300, max_features=0.5, min_samples_leaf=2, random_state=RS, n_jobs=1), False),
    "GradBoost": (lambda: GradientBoostingRegressor(n_estimators=250, learning_rate=0.03, max_depth=2, subsample=0.7, random_state=RS), False),
    "LightGBM": (lambda: lgb.LGBMRegressor(n_estimators=250, learning_rate=0.03, num_leaves=7, min_child_samples=8, colsample_bytree=0.5,
                                           subsample=0.7, subsample_freq=1, reg_lambda=5, random_state=RS, n_jobs=1, verbose=-1), False),
}


def pipe(nombre, cols):
    mk, esc = MODELOS[nombre]
    return make_pipeline(prep(cols, esc), mk())


def metr(yt, yp):
    return dict(rmse=float(np.sqrt(mean_squared_error(yt, yp))), mae=float(mean_absolute_error(yt, yp)), r2=float(r2_score(yt, yp)))


rkf = RepeatedKFold(n_splits=5, n_repeats=4, random_state=RS)
SPL = list(rkf.split(E))
NREP = 4


def oof_baseline(kind):
    """Predicciones OOF por repetición para líneas base."""
    out = np.zeros((NREP, len(E)))
    for i, (tr, te) in enumerate(SPL):
        r = i // 5
        if kind == "media":
            out[r, te] = y[tr].mean()
        else:  
            med = pd.Series(y[tr]).groupby(E.mun_g.values[tr]).median()
            out[r, te] = E.mun_g.iloc[te].map(med).fillna(np.median(y[tr])).values
    return out


def oof_model(nombre, cols):
    out = np.zeros((NREP, len(E)))
    for i, (tr, te) in enumerate(SPL):
        m = pipe(nombre, cols).fit(E.iloc[tr][cols], y[tr])
        out[i // 5, te] = m.predict(E.iloc[te][cols])
    return out


def resume(oof, nombre, conjunto):
    ms = [metr(y, oof[r]) for r in range(NREP)]
    d = pd.DataFrame(ms).mean().to_dict(); d.update({k + "_sd": v for k, v in pd.DataFrame(ms).std().items()})
    nc = E.municipio.values != "Calpulalpan"
    d["rmse_sin_Calpulalpan"] = float(np.mean([np.sqrt(mean_squared_error(y[nc], oof[r][nc])) for r in range(NREP)]))
    d.update(modelo=nombre, conjunto=conjunto); return d


res, OOF = [], {}
for nm, k in [("Base: media global", "media"), ("Base: mediana municipio", "mun")]:
    o = oof_baseline(k); OOF[(nm, "-")] = o; res.append(resume(o, nm, "-"))
for cs, cols in SETS.items():
    for nm in MODELOS:
        o = oof_model(nm, cols); OOF[(nm, cs)] = o; res.append(resume(o, nm, cs)); print(f"{cs:28s} {nm:13s} RMSE={res[-1]['rmse']:.3f} R2={res[-1]['r2']:.3f}", flush=True)
R = pd.DataFrame(res)[["conjunto", "modelo", "rmse", "rmse_sd", "mae", "r2", "r2_sd", "rmse_sin_Calpulalpan"]].sort_values("rmse")
R.round(4).to_csv(REP / "modelado_cv_resultados.csv", index=False); print(R.head(14).round(3).to_string())

# vemos si el satelite tiene alguna utilidad 
base_m = np.array([metr(y, OOF[("Base: mediana municipio", "-")][r])["rmse"] for r in range(NREP)])
print("RMSE base municipio:", base_m.mean().round(3), "| base media global:", np.mean([metr(y, OOF[("Base: media global", "-")][r])["rmse"] for r in range(NREP)]).round(3))
best = R[~R.modelo.str.startswith("Base")].iloc[0]; print("Mejor modelo por CV:", best.modelo, "|", best.conjunto)
mejor = np.array([metr(y, OOF[(best.modelo, best.conjunto)][r])["rmse"] for r in range(NREP)])
print("RMSE mejor:", mejor.mean().round(3), "| mejora vs base municipio (rel.):", ((base_m.mean() - mejor.mean()) / base_m.mean() * 100).round(1), "%")


top = R[~R.modelo.str.startswith("Base")].head(3)[["modelo", "conjunto"]].values.tolist(); print("Ensamble:", top)
ens = np.mean([OOF[(m, c)] for m, c in top], axis=0); OOF[("Ensamble", "top3")] = ens
re_ = resume(ens, "Ensamble top3", "mixto"); print("Ensamble CV:", {k: round(v, 3) for k, v in re_.items() if isinstance(v, float)})
pd.concat([R, pd.DataFrame([re_])]).round(4).to_csv(REP / "modelado_cv_resultados.csv", index=False)


lomo = []
for mun in ["Chignahuapan", "Calpulalpan", "Singuilucan", "Almoloya"]:
    te = np.where(E.municipio == mun)[0]; tr = np.where(E.municipio != mun)[0]
    row = dict(municipio_excluido=mun, n=len(te), rmse_base_media=float(np.sqrt(mean_squared_error(y[te], np.full(len(te), y[tr].mean())))))
    for nm in ["Ridge", "RandomForest", "LightGBM"]:
        row[f"rmse_{nm}"] = float(np.sqrt(mean_squared_error(y[te], pipe(nm, SETS["S: satélite+topografía"]).fit(E.iloc[tr][SETS["S: satélite+topografía"]], y[tr]).predict(E.iloc[te][SETS["S: satélite+topografía"]]))))
    lomo.append(row)
lomo = pd.DataFrame(lomo); lomo.round(3).to_csv(REP / "modelado_lomo.csv", index=False); print(lomo.round(3).to_string())

# -evaluacion de los municipios 
oo = ens.mean(axis=0); E["pred_oof"] = oo; E["resid"] = y - oo
pm = E.groupby("municipio").apply(lambda g: pd.Series(dict(n=len(g), rmse=np.sqrt((g.resid ** 2).mean()), sesgo=g.resid.mean()))).round(3)
pm.to_csv(REP / "modelado_error_por_municipio.csv"); print(pm)
E.sort_values("resid", key=abs, ascending=False).head(12)[["ID_POLIGONO", "municipio", "AREA_HA", "RENDIMIENTO_T_HA", "pred_oof", "resid"]].round(2).to_csv(REP / "modelado_parcelas_mayor_error.csv", index=False)

# cuantiles 
q = np.quantile(np.abs(E.resid), 0.9); cob = float((np.abs(E.resid) <= q).mean()); print("Semi-ancho intervalo 90 % (t/ha):", round(q, 3))

# -importancia 
from sklearn.inspection import permutation_importance
cols_b = SETS[best.conjunto] if best.conjunto in SETS else SETS["Todo"]
imps = []
for i, (tr, te) in enumerate(SPL[:10]):
    m = pipe(best.modelo, cols_b).fit(E.iloc[tr][cols_b], y[tr])
    pi = permutation_importance(m, E.iloc[te][cols_b], y[te], n_repeats=5, random_state=RS, scoring="neg_root_mean_squared_error")
    imps.append(pi.importances_mean)
imp = pd.DataFrame({"variable": cols_b, "importancia_rmse": np.mean(imps, axis=0)}).sort_values("importancia_rmse", ascending=False)
imp.round(4).to_csv(REP / "modelado_importancia_permutacion.csv", index=False); print(imp.head(12).round(3).to_string())

#graficas
fig, axs = plt.subplots(1, 2, figsize=(14, 5.2))
sns.scatterplot(data=E, x="RENDIMIENTO_T_HA", y="pred_oof", hue="municipio", ax=axs[0], s=35); lim = [1.8, 5.8]; axs[0].plot(lim, lim, "k--", lw=1)
axs[0].set(title="Rendimiento observado vs. predicho fuera de muestra (ensamble, CV repetida)", xlabel="Observado (t/ha)", ylabel="Predicho OOF (t/ha)")
top_i = imp.head(15).iloc[::-1]; axs[1].barh(top_i.variable, top_i.importancia_rmse, color="tab:blue")
axs[1].set(title=f"Importancia por permutación (aumento de RMSE, t/ha) - {best.modelo}", xlabel="Δ RMSE al permutar (t/ha)")
fig.tight_layout(); fig.savefig(GRA / "12_obs_vs_pred_importancia.png", dpi=130); plt.close(fig)
fig, ax = plt.subplots(figsize=(10, 5)); rr = pd.read_csv(REP / "modelado_cv_resultados.csv").sort_values("rmse").head(16).iloc[::-1]
ax.barh(rr.modelo + " | " + rr.conjunto, rr.rmse, xerr=rr.rmse_sd, color="tab:green"); ax.axvline(base_m.mean(), c="r", ls="--", label="Base: mediana por municipio")
ax.set(title="RMSE de validación cruzada repetida (5 pliegues × 4 repeticiones; barras = desv. entre repeticiones)", xlabel="RMSE (t/ha)"); ax.legend(); fig.tight_layout(); fig.savefig(GRA / "13_comparacion_modelos.png", dpi=130); plt.close(fig)

# entrenamiento 
preds = []
for m, c in top:
    cols = SETS.get(c, SETS["Todo"]); fit = pipe(m, cols).fit(E[cols], y); preds.append(fit.predict(P[cols]))
pf = np.mean(preds, axis=0)
out = pd.DataFrame({"ID_parcela": P.ID_POLIGONO, "rendimiento_predicho_ton_ha": np.round(pf, 3), "limite_inf_90": np.round(pf - q, 3),
                    "limite_sup_90": np.round(pf + q, 3), "municipio": P.municipio})
out.to_csv(REP / "predicciones_parcelas_PREDICCION.csv", index=False)
print(out.describe().round(2)); print("Predicho medio por municipio:", out.groupby("municipio").rendimiento_predicho_ton_ha.mean().round(2).to_dict())
print("Observado medio por municipio (entrenamiento):", E.groupby("municipio").RENDIMIENTO_T_HA.mean().round(2).to_dict())
