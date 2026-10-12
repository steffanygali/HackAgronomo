import pandas as pd, numpy as np, matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt, seaborn as sns
sns.set_theme(style="whitegrid")
o = pd.read_csv("reportes/prediccion_final_oof.csv"); p = pd.read_csv("reportes/predicciones_parcelas_PREDICCION.csv")
a = pd.read_csv("reportes/modelado_cv_resultados.csv"); b = pd.read_csv("reportes/modelado_compacto_cv.csv")
fig, axs = plt.subplots(1, 3, figsize=(18, 5.3))
sns.scatterplot(data=o, x="obs", y="oof_pred", hue="municipio", ax=axs[0], s=35); axs[0].plot([2, 5.8], [2, 5.8], "k--", lw=1)
axs[0].set(title="Modelo final: observado vs. predicho (OOF, CV 5x4)", xlabel="Observado (t/ha)", ylabel="Predicho OOF (t/ha)")
order = o.groupby("municipio").resid.apply(lambda s: np.sqrt((s ** 2).mean())).sort_values().index
sns.boxplot(data=o, y="municipio", x="resid", order=order, ax=axs[1]); axs[1].axvline(0, c="k", lw=1)
axs[1].set(title="Residuos OOF por municipio (observado − predicho)", xlabel="Residuo (t/ha)", ylabel="")
aa = a[~a.modelo.str.startswith(("Base", "Ensamble"))].copy(); aa["modelo"] = aa.modelo + " | " + aa.conjunto.astype(str).str.slice(0, 12)
c = pd.concat([aa.sort_values("rmse").head(6).assign(grupo="ML con ~80 variables")[["modelo", "rmse", "grupo"]],
               b.sort_values("rmse").head(8).assign(grupo="Compactos / espaciales")[["modelo", "rmse", "grupo"]]]).sort_values("rmse").iloc[::-1]
cols = c.grupo.map({"ML con ~80 variables": "tab:orange", "Compactos / espaciales": "tab:blue"})
axs[2].barh(c.modelo.str.slice(0, 46), c.rmse, color=cols); axs[2].axvline(0.855, c="r", ls="--", label="Media global (0.855)")
axs[2].set(title="RMSE de CV: ML (naranja) vs compactos (azul)", xlabel="RMSE (t/ha)"); axs[2].legend(loc="upper right"); axs[2].tick_params(axis="y", labelsize=7)
fig.tight_layout(); fig.savefig("graficas/14_modelo_final_y_comparacion.png", dpi=130); plt.close(fig)
fig, ax = plt.subplots(figsize=(9, 4.5)); sns.histplot(p.rendimiento_predicho_ton_ha, bins=20, ax=ax)
ax.set(title="Distribución de rendimientos predichos (59 parcelas de PREDICCION)", xlabel="Rendimiento predicho (t/ha)", ylabel="Parcelas")
fig.tight_layout(); fig.savefig("graficas/15_distribucion_predicciones.png", dpi=130); plt.close(fig)
