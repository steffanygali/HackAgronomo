#Aqui vemos que cumplan las euaciones de los documentos lol
import numpy as np, pandas as pd
b = pd.read_csv("datos_limpios/BASICO_utilizable_sin_nube_total.csv"); s = b[b.sensor == "Sentinel-2"].copy()
p = pd.read_csv("datos_limpios/PRO_utilizable_sin_nube_total.csv")
R = []
def chk(nombre, ecuacion, esperado, observado, nota=""):
    ok = esperado.notna() & observado.notna(); d = (esperado[ok] - observado[ok]).abs()
    R.append(dict(verificacion=nombre, ecuacion=ecuacion, n=int(ok.sum()), err_abs_mediano=round(d.median(), 5),
                  err_abs_p95=round(d.quantile(.95), 5), err_abs_max=round(d.max(), 5),
                  corr=round(np.corrcoef(esperado[ok], observado[ok])[0, 1], 5), nota=nota))
with np.errstate(all="ignore"):
    chk("NDTI desde STI", "NDTI=(STI-1)/(STI+1)", (s.sti_promedio - 1) / (s.sti_promedio + 1), s.ndti_promedio, "identidad por píxel")
    chk("NDWI desde MSI", "NDWI=(1-MSI)/(1+MSI)", (1 - s.msi_promedio) / (1 + s.msi_promedio), s.ndwi_promedio, "identidad por píxel")
    chk("ENDWI desde EMSI", "ENDWI=(1-EMSI)/(1+EMSI)", (1 - s.emsi_promedio) / (1 + s.emsi_promedio), s.endwi_promedio, "identidad por píxel")
    chk("LAI desde SAVI", "LAI=-ln((0.69-SAVI)/0.59)/0.91", -np.log((0.69 - s.savi_promedio) / 0.59) / 0.91, s.lai_promedio, "documentado como log; se asume ln (comprobar)")
    chk("LAI desde SAVI (log10)", "LAI=-log10((0.69-SAVI)/0.59)/0.91", -np.log10((0.69 - s.savi_promedio) / 0.59) / 0.91, s.lai_promedio, "alternativa si 'log' fuera base 10")
    chk("NDDI desde NDVI y ENDWI", "NDDI=(NDVI-ENDWI)/(NDVI+ENDWI)", (s.ndvi_promedio - s.endwi_promedio) / (s.ndvi_promedio + s.endwi_promedio), s.nddi_promedio, "usa datos remuestreados a 8 bits: no se espera igualdad")
    chk("PRO: MSAVI vs NDVI (monotonía)", "MSAVI≈f(NDVI)", p.ndvi_promedio.rank(), p.msavi_promedio.rank(), "solo correlación de rangos")
rng = [dict(verificacion="SAVI < 0.69 (LAI calculable)", n=int(s.savi_promedio.notna().sum()), violaciones=int((s.savi_promedio >= 0.69).sum())),
       dict(verificacion="Sentinel-2 NDVI en [-1,1]", n=int(s.ndvi_promedio.notna().sum()), violaciones=int(((s.ndvi_promedio < -1) | (s.ndvi_promedio > 1)).sum())),
       dict(verificacion="Planet NDVI en [-1,1]", n=int(p.ndvi_promedio.notna().sum()), violaciones=int(((p.ndvi_promedio < -1) | (p.ndvi_promedio > 1)).sum())),
       dict(verificacion="FAPAR en [0,1]", n=int(s.fapar_promedio.notna().sum()), violaciones=int(((s.fapar_promedio < 0) | (s.fapar_promedio > 1)).sum())),
       dict(verificacion="STI, MSI, EMSI >0 (cocientes de reflectancia)", n=int(s.sti_promedio.notna().sum()), violaciones=int(((s.sti_promedio <= 0) | (s.msi_promedio <= 0) | (s.emsi_promedio <= 0)).sum())),
       dict(verificacion="Planet LAI2 < 0 (posible por la ecuación)", n=int(p.lai_promedio.notna().sum()), violaciones=int((p.lai_promedio < 0).sum()))]
pd.DataFrame(R).to_csv("reportes/validacion_ecuaciones_identidades.csv", index=False); pd.DataFrame(rng).to_csv("reportes/validacion_ecuaciones_rangos.csv", index=False)
pd.set_option("display.width", 250); print(pd.DataFrame(R).to_string()); print(pd.DataFrame(rng).to_string())
print("MRA: rango", s.mra_promedio.min(), s.mra_promedio.max(), "| nº valores distintos redondeados a 4 dec:", s.mra_promedio.round(4).nunique())
print("FAPAR nulos con otros índices presentes:", int(s.fapar_promedio.isna().sum()))
