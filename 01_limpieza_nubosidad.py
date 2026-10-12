import pandas as pd
import numpy as np
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

BASE = Path("/home/claude/proyecto")
SRC = BASE / "datos_originales/DATASET_RETO_AGRO_2026"
OUT, REP, GRA = BASE / "datos_limpios", BASE / "reportes", BASE / "graficas"
CICLO = (pd.Timestamp("2025-04-01"), pd.Timestamp("2025-10-31"))  
LOG = []


def log(dataset, problema, accion, justificacion, afectados):
    LOG.append(dict(dataset=dataset, problema=problema, accion=accion,
                    justificacion=justificacion, registros_afectados=int(afectados)))


def limpiar(df, nombre):
    """Elimina columnas 'Unnamed' vacías y espacios sobrantes en textos."""
    vacias = [c for c in df.columns if c.startswith("Unnamed") and df[c].isna().all()]
    if vacias:
        df = df.drop(columns=vacias)
        log(nombre, f"Columna vacía por coma final ({vacias})", "Eliminada columna",
            "Residuo de formato sin información (100% nula)", len(df))
    for c in df.select_dtypes(["object", "string"]).columns:
        antes = df[c].copy()
        df[c] = df[c].str.strip()
        ch = int((antes != df[c]).sum())
        if ch:
            log(nombre, f"Espacios sobrantes en {c}", "strip()", "Evitar llaves inconsistentes", ch)
    return df


# -Aqui evaluamos el rendimiento hommies :D 
idr = limpiar(pd.read_csv(SRC / "ID_area_rendimiento_70_30_Reto_AgroCebada.csv", encoding="utf-8-sig"), "rendimiento")
assert idr.ID_POLIGONO.is_unique and len(idr) == 197
idr["rend_oculto"] = idr.RENDIMIENTO_T_HA.isna()
log("rendimiento", "Rendimiento nulo en parcelas PREDICCION", "Conservado como NaN (no imputado)",
    "Oculto por diseño del reto (documentado)", idr.rend_oculto.sum())
q1, q3 = idr.AREA_HA.quantile([.25, .75])
lim = q3 + 1.5 * (q3 - q1)
idr["flag_area_atipica"] = idr.AREA_HA > lim
log("rendimiento", f"Áreas atípicas por IQR (> {lim:.1f} ha; máx {idr.AREA_HA.max()} ha)",
    "Marcadas con flag_area_atipica, no eliminadas", "Pueden ser parcelas grandes legítimas; requiere confirmación",
    idr.flag_area_atipica.sum())
idr.to_csv(OUT / "rendimiento_limpio.csv", index=False, encoding="utf-8")


# Satelites lol
def procesar(archivo, nombre):
    df = limpiar(pd.read_csv(SRC / archivo, encoding="utf-8-sig"), nombre)
    df["fecha"] = pd.to_datetime(df.fecha_captura, format="%d/%m/%Y", errors="raise")
    log(nombre, "fecha_captura como texto dd/mm/aaaa", "Convertida a datetime en 'fecha' (original conservada)",
        "Permite análisis temporal", len(df))
    idx = [c for c in df.columns if c.endswith(("_promedio", "_std", "_max", "_min"))]
    df["sin_indices"] = df[idx].isna().all(axis=1)
    df["nube_nula"] = df.porcentaje_nubosidad.isna()
    df["utilizable"] = ~df.sin_indices
    log(nombre, "Filas con todos los índices nulos (observación no utilizable)",
        "Marcadas con sin_indices; conservadas en archivo completo",
        "Corresponden a nube total; la decisión de filtrado es del equipo", df.sin_indices.sum())
    log(nombre, "porcentaje_nubosidad nulo", "Marcado con nube_nula; no imputado",
        "Sin evidencia para asumir un valor", df.nube_nula.sum())
    df["anio"], df["mes"] = df.fecha.dt.year, df.fecha.dt.month
    df["en_ciclo_2025"] = df.fecha.between(*CICLO)
    cat = pd.cut(df.porcentaje_nubosidad, [-0.1, 0, 10, 30, 60, 99.99, 100],
                 labels=["0%", "(0-10]", "(10-30]", "(30-60]", "(60-100)", "100%"])
    df["cat_nubosidad"] = cat.astype("object")
    df["flag_inconsistencia_nube"] = (((df.porcentaje_nubosidad < 100) & df.sin_indices) |
                                      ((df.porcentaje_nubosidad >= 100) & ~df.sin_indices))
    log(nombre, "Inconsistencia nube vs datos (nube<100 sin datos, o nube=100 con datos)",
        "Marcadas con flag_inconsistencia_nube", "Verificación de calidad", df.flag_inconsistencia_nube.sum())
    return df


pro = procesar("Conjunto_datos_PRO_AgroCebada.csv", "PRO")
bas = procesar("Conjunto_datos_BASICO_AgroCebada2026.csv", "BASICO")
pro.to_csv(OUT / "PRO_limpio_completo.csv", index=False)
bas.to_csv(OUT / "BASICO_limpio_completo.csv", index=False)
pro[pro.utilizable].to_csv(OUT / "PRO_utilizable_sin_nube_total.csv", index=False)
bas[bas.utilizable].to_csv(OUT / "BASICO_utilizable_sin_nube_total.csv", index=False)

# nubosidad 
def tabla_cat(df, nombre):
    t = df.groupby(["sensor", "cat_nubosidad"], dropna=False).agg(
        filas=("ID_POLIGONO", "size"), con_datos=("utilizable", "sum")).reset_index()
    t["pct_sensor"] = (t.filas / t.groupby("sensor").filas.transform("sum") * 100).round(2)
    t.insert(0, "dataset", nombre)
    return t


cats = pd.concat([tabla_cat(pro, "PRO"), tabla_cat(bas, "BASICO")])
cats.to_csv(REP / "nubosidad_categorias.csv", index=False)


def tabla_umbral(df, nombre):
    filas = []
    for s, g in df.groupby("sensor"):
        for u in UMBRALES:
            ok = g[g.utilizable & (g.porcentaje_nubosidad <= u)]
            gc = ok[ok.en_ciclo_2025]
            por_parcela = gc.groupby("ID_POLIGONO").size().reindex(idr.ID_POLIGONO, fill_value=0)
            filas.append(dict(dataset=nombre, sensor=s, umbral_nube_max=u, filas_utilizables=len(ok),
                              pct_de_total=round(len(ok) / len(g) * 100, 2), obs_ciclo2025=len(gc),
                              parcelas_con_obs_ciclo=int((por_parcela > 0).sum()), parcelas_totales=197,
                              mediana_obs_por_parcela_ciclo=float(por_parcela.median())))
    return pd.DataFrame(filas)


tu = pd.concat([tabla_umbral(pro, "PRO"), tabla_umbral(bas, "BASICO")])
tu.to_csv(REP / "nubosidad_umbrales.csv", index=False)

cob = []
for nombre, df in [("PRO", pro), ("BASICO", bas)]:
    for s, g in df[df.en_ciclo_2025].groupby("sensor"):
        c = g.groupby("ID_POLIGONO").agg(obs_totales=("utilizable", "size"), obs_con_datos=("utilizable", "sum"),
                                         nube_media=("porcentaje_nubosidad", "mean"))
        c["obs_nube_le20"] = g[g.utilizable & (g.porcentaje_nubosidad <= 20)].groupby("ID_POLIGONO").size()
        c = c.reindex(idr.ID_POLIGONO)
        c[["obs_totales", "obs_con_datos", "obs_nube_le20"]] = c[["obs_totales", "obs_con_datos", "obs_nube_le20"]].fillna(0)
        c = c.reset_index()
        c.insert(0, "sensor", s)
        c.insert(0, "dataset", nombre)
        cob.append(c)
cob = pd.concat(cob).merge(idr[["ID_POLIGONO", "CONJUNTO"]], on="ID_POLIGONO")
cob.to_csv(REP / "nubosidad_cobertura_por_parcela_ciclo2025.csv", index=False)

COLS = ["ID_POLIGONO", "sensor", "anio", "mes", "utilizable", "porcentaje_nubosidad"]
mens = pd.concat([df[COLS].assign(dataset=n) for n, df in [("PRO", pro), ("BASICO", bas)]], ignore_index=True).groupby(
    ["dataset", "sensor", "anio", "mes"]).agg(
    filas=("utilizable", "size"), pct_con_datos=("utilizable", lambda x: round(x.mean() * 100, 2)),
    nube_media=("porcentaje_nubosidad", "mean")).reset_index()
mens.to_csv(REP / "nubosidad_mensual.csv", index=False)

# Graficas siuu 
sns.set_theme(style="whitegrid")
allr = pd.concat([pro[COLS].assign(dataset="PRO"), bas[COLS].assign(dataset="BASICO")], ignore_index=True)
allr["ds_sensor"] = allr.dataset + " · " + allr.sensor
fig, ax = plt.subplots(figsize=(8, 4.5))
sns.histplot(data=allr, x="porcentaje_nubosidad", hue="ds_sensor", bins=20, multiple="dodge", ax=ax)
ax.set(title="Distribución del porcentaje de nubosidad por dataset y sensor",
       xlabel="Nubosidad (%)", ylabel="Número de observaciones")
fig.tight_layout(); fig.savefig(GRA / "01_hist_nubosidad.png", dpi=130); plt.close(fig)

fig, ax = plt.subplots(figsize=(9, 4.5))
for (d, s), g in mens.groupby(["dataset", "sensor"]):
    gg = g.groupby("mes").pct_con_datos.mean()
    ax.plot(gg.index, gg.values, marker="o", label=f"{d} · {s}")
ax.set(title="Observaciones con datos válidos por mes (promedio de años disponibles)",
       xlabel="Mes", ylabel="% de observaciones con índices (sin nube total)", xticks=range(1, 13))
ax.legend()
fig.tight_layout(); fig.savefig(GRA / "02_estacionalidad_datos_validos.png", dpi=130); plt.close(fig)

fig, ax = plt.subplots(figsize=(8, 4.5))
for (d, s), g in tu.groupby(["dataset", "sensor"]):
    ax.plot(g.umbral_nube_max, g.obs_ciclo2025, marker="o", label=f"{d} · {s}")
ax.set(title="Observaciones utilizables en el ciclo abr-oct 2025 según umbral de nubosidad",
       xlabel="Umbral máximo de nubosidad (%)", ylabel="Número de observaciones")
ax.legend()
fig.tight_layout(); fig.savefig(GRA / "03_umbral_vs_observaciones.png", dpi=130); plt.close(fig)

grupos = list(cob.groupby(["dataset", "sensor"]))
fig, axs = plt.subplots(1, len(grupos), figsize=(14, 4.5), sharey=True)
for ax, ((d, s), g) in zip(axs, grupos):
    sns.histplot(g.obs_nube_le20, bins=20, ax=ax)
    ax.set(title=f"{d} · {s}", xlabel="Obs. con nubosidad ≤20% por parcela", ylabel="Parcelas")
fig.suptitle("Cobertura por parcela en el ciclo abr-oct 2025 (nubosidad ≤20%)")
fig.tight_layout(); fig.savefig(GRA / "04_cobertura_por_parcela.png", dpi=130); plt.close(fig)

pd.DataFrame(LOG).to_csv(BASE / "logs/registro_transformaciones.csv", index=False)
pd.set_option("display.width", 250); pd.set_option("display.max_colwidth", 70)
print(pd.DataFrame(LOG).to_string())
print(cats.to_string())
print(tu.to_string())
print(cob.groupby(["dataset", "sensor"]).agg(
    sin_obs_le20=("obs_nube_le20", lambda x: int((x == 0).sum())), mediana_obs_le20=("obs_nube_le20", "median")))
