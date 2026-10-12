
# EDA en R (tidyverse + ggplot2
# Lee SOLO datos_limpios/ (producidos por los scripts de Python). Escribe en graficas_R/ y reportes_R/.
# Exploratorio: las correlaciones NO implican causalidad.
suppressPackageStartupMessages({
  library(dplyr); library(tidyr); library(readr); library(purrr); library(tibble)
  library(ggplot2); library(scales); library(forcats); library(lubridate); library(patchwork); library(stringr)
})
invisible(Sys.setlocale("LC_ALL", "C.UTF-8"))   # evita que ρ, acentos y ° salgan como ".."
dir.create("graficas_R", showWarnings = FALSE); dir.create("reportes_R", showWarnings = FALSE)
theme_set(theme_minimal(base_size = 11) + theme(plot.title = element_text(face = "bold", size = 11),
                                               plot.subtitle = element_text(colour = "grey35", size = 9),
                                               strip.text = element_text(face = "bold")))
UMBRAL <- 20                                    # umbral de nubosidad
guarda <- function(p, nombre, w = 10, h = 5.5) ggsave(file.path("graficas_R", nombre), p, width = w, height = h, dpi = 140, bg = "white")
corto  <- function(x) str_trunc(x, 20)          # recorta nombres largos de municipios


cols_s2 <- c("ID_POLIGONO", "sensor", "fecha", "porcentaje_nubosidad", "sin_indices", "anio", "mes",
             "ndvi_promedio", "evi_promedio", "savi_promedio", "lai_promedio", "fapar_promedio", "ndwi_promedio",
             "msi_promedio", "ndti_promedio", "ndsvi_promedio", "crc_promedio", "srndi_promedio", "vi6t_promedio")
bas <- read_csv("datos_limpios/BASICO_limpio_completo.csv", col_select = any_of(cols_s2), show_col_types = FALSE)
pro <- read_csv("datos_limpios/PRO_limpio_completo.csv", show_col_types = FALSE,
                col_select = any_of(c("ID_POLIGONO", "sensor", "fecha", "porcentaje_nubosidad", "sin_indices", "anio", "mes",
                                      "ndvi_promedio", "evi_promedio", "lai_promedio", "msavi_promedio")))
sat <- bind_rows(mutate(bas, dataset = "BASICO"), mutate(pro, dataset = "PRO")) %>%
  mutate(fuente = paste(dataset, sensor, sep = " · "))
F   <- read_csv("datos_limpios/features_modelado.csv", show_col_types = FALSE)
cat("Satelital:", nrow(sat), "filas | Parcelas:", nrow(F), "\n")
ent <- F %>% filter(CONJUNTO == "ENTRENAMIENTO"); pred <- F %>% filter(CONJUNTO == "PREDICCION")
stopifnot(nrow(ent) == 138, nrow(pred) == 59)


calidad <- sat %>% group_by(fuente) %>%
  summarise(filas = n(), pct_sin_indices = round(mean(sin_indices) * 100, 2), pct_nube_nula = round(mean(is.na(porcentaje_nubosidad)) * 100, 2),
            nube_media_si_hay_datos = round(mean(porcentaje_nubosidad[!sin_indices], na.rm = TRUE), 2), .groups = "drop")
print(calidad); write_csv(calidad, "reportes_R/calidad_por_fuente.csv")

p1 <- sat %>% filter(!is.na(porcentaje_nubosidad)) %>%
  ggplot(aes(porcentaje_nubosidad)) + geom_histogram(bins = 20, fill = "#2E7D32", colour = "white") +
  facet_wrap(~fuente, scales = "free_y") + scale_y_continuous(labels = comma) +
  labs(title = "Distribución de la nubosidad por fuente (distribución casi binaria: 0 % o 100 %)",
       subtitle = "Observaciones con porcentaje_nubosidad no nulo", x = "Nubosidad (%)", y = "Observaciones")
guarda(p1, "R01_hist_nubosidad.png", 11, 4.2)

mens <- sat %>% group_by(fuente, mes) %>% summarise(pct_validas = mean(!sin_indices) * 100, .groups = "drop")
p2 <- ggplot(mens, aes(mes, pct_validas, colour = fuente)) + geom_line(linewidth = 1) + geom_point(size = 2) +
  scale_x_continuous(breaks = 1:12) + scale_colour_brewer(palette = "Dark2") +
  labs(title = "Observaciones con datos válidos por mes", subtitle = "Jun-oct concentran la mayor pérdida por nube (aprox. 48-73 % de datos válidos); en Landsat también baja diciembre",
       x = "Mes", y = "% de observaciones con índices (sin nube total)", colour = NULL) + theme(legend.position = "bottom")
guarda(p2, "R02_estacionalidad_datos_validos.png", 9, 4.8)


y_mun <- ent %>% group_by(municipio) %>%
  summarise(n = n(), media = mean(RENDIMIENTO_T_HA), mediana = median(RENDIMIENTO_T_HA), sd = sd(RENDIMIENTO_T_HA),
            min = min(RENDIMIENTO_T_HA), max = max(RENDIMIENTO_T_HA), valores_unicos = n_distinct(RENDIMIENTO_T_HA),
            pct_multiplos_0.5 = round(mean(abs(RENDIMIENTO_T_HA * 2 - round(RENDIMIENTO_T_HA * 2)) < 1e-9) * 100, 1), .groups = "drop") %>%
  arrange(desc(n))
print(y_mun); write_csv(y_mun, "reportes_R/rendimiento_por_municipio.csv")
mun_grande <- ent %>% count(municipio) %>% filter(n >= 3) %>% pull(municipio)
kw <- kruskal.test(RENDIMIENTO_T_HA ~ municipio, data = filter(ent, municipio %in% mun_grande))
cat("Kruskal rendimiento~municipio (n>=3): chi2 =", round(kw$statistic, 2), "p =", format(kw$p.value, digits = 3), "\n")

pa <- ggplot(ent, aes(RENDIMIENTO_T_HA)) + geom_histogram(aes(y = after_stat(density)), bins = 22, fill = "#8D6E63", colour = "white") +
  geom_density(colour = "#3E2723", linewidth = 1) + labs(title = "Distribución del rendimiento (n = 138)", x = "Rendimiento (t/ha)", y = "Densidad")
pb <- ent %>% mutate(m = fct_reorder(corto(municipio), RENDIMIENTO_T_HA, median)) %>%
  ggplot(aes(RENDIMIENTO_T_HA, m)) + geom_boxplot(outlier.shape = NA, fill = "#C8E6C9") + geom_jitter(height = 0.15, alpha = 0.55, size = 1.5) +
  labs(title = "Rendimiento por municipio", subtitle = sprintf("Kruskal-Wallis p = %s", format(kw$p.value, digits = 2)), x = "Rendimiento (t/ha)", y = NULL)
pc <- ggplot(ent, aes(AREA_HA, RENDIMIENTO_T_HA, colour = fct_infreq(corto(municipio)))) + geom_point(alpha = 0.7) + scale_x_log10() +
  labs(title = "Rendimiento vs. área de la parcela", x = "Área (ha, escala log)", y = "Rendimiento (t/ha)", colour = "Municipio") + theme(legend.position = "bottom")
guarda((pa | pb) / pc, "R03_rendimiento.png", 12, 9)

pd_ <- ent %>% filter(municipio %in% c("Chignahuapan", "Calpulalpan")) %>%
  ggplot(aes(RENDIMIENTO_T_HA)) + geom_histogram(binwidth = 0.1, fill = "#1565C0", colour = "white") + facet_wrap(~municipio, ncol = 1) +
  labs(title = "Calpulalpan solo reporta 3 valores (2.5, 3.0, 3.5); Chignahuapan reporta 2 decimales",
       subtitle = "Posible diferencia en el método de captura del rendimiento (hipótesis, confirmar con FIRA)", x = "Rendimiento (t/ha)", y = "Parcelas")
guarda(pd_, "R04_redondeo_rendimiento.png", 9, 6)


ndvi_ok <- sat %>% filter(!sin_indices, porcentaje_nubosidad <= UMBRAL, sensor %in% c("Sentinel-2", "Planet"))
m_s2 <- ndvi_ok %>% filter(sensor == "Sentinel-2") %>% mutate(ym = floor_date(fecha, "month")) %>%
  group_by(ym) %>% summarise(media = mean(ndvi_promedio), sd = sd(ndvi_promedio), .groups = "drop")
pt1 <- ggplot(m_s2, aes(ym, media)) + geom_ribbon(aes(ymin = media - sd, ymax = media + sd), alpha = 0.2, fill = "#2E7D32") +
  geom_line(colour = "#1B5E20", linewidth = 1) + geom_point(size = 1.5) + scale_x_date(date_breaks = "6 months", date_labels = "%Y-%m") +
  labs(title = paste0("NDVI mensual medio, Sentinel-2 2022-2025 (nube ≤ ", UMBRAL, " %)"), subtitle = "Banda = ±1 desv. estándar entre observaciones; un pico por año (ago-sep)",
       x = NULL, y = "NDVI (adimensional)") + theme(axis.text.x = element_text(angle = 45, hjust = 1))
sem <- ndvi_ok %>% filter(anio == 2025) %>% mutate(sem = floor_date(fecha, "week", week_start = 1)) %>% group_by(sensor, sem) %>% summarise(ndvi = mean(ndvi_promedio), .groups = "drop")
pt2 <- ggplot(sem, aes(sem, ndvi, colour = sensor)) + annotate("rect", xmin = as.Date("2025-04-01"), xmax = as.Date("2025-10-31"), ymin = -Inf, ymax = Inf, alpha = 0.08, fill = "green4") +
  geom_line(linewidth = 1) + scale_colour_manual(values = c("Planet" = "#E65100", "Sentinel-2" = "#1565C0")) +
  labs(title = "NDVI semanal 2025: Planet vs. Sentinel-2", subtitle = "Zona verde = ciclo abr-oct. Planet es ~0.08 más alto (no intercambiables)", x = NULL, y = "NDVI (adimensional)", colour = NULL) + theme(legend.position = "bottom")
guarda(pt1 / pt2, "R05_ndvi_temporal.png", 10, 9)


cur <- read_csv("datos_limpios/curvas_ndvi_planet_semanal_2025.csv", show_col_types = FALSE) %>% rename(ID_POLIGONO = 1) %>%
  pivot_longer(-ID_POLIGONO, names_to = "mmdd", values_to = "ndvi") %>% mutate(semana = ymd(paste0("2025-", mmdd))) %>%
  left_join(select(F, ID_POLIGONO, municipio), by = "ID_POLIGONO") %>% filter(municipio %in% mun_grande, !is.na(ndvi))
cm <- cur %>% group_by(municipio, semana) %>% summarise(media = mean(ndvi), q10 = quantile(ndvi, .1), q90 = quantile(ndvi, .9), .groups = "drop")
p6 <- ggplot(cm, aes(semana, media, colour = corto(municipio), fill = corto(municipio))) + geom_ribbon(aes(ymin = q10, ymax = q90), alpha = 0.12, colour = NA) + geom_line(linewidth = 1) +
  scale_x_date(date_labels = "%b") + labs(title = "Curva fenológica de NDVI (Planet 2025) por municipio", subtitle = "Línea = media; banda = p10-p90 entre parcelas",
                                         x = NULL, y = "NDVI (adimensional)", colour = "Municipio", fill = "Municipio") + theme(legend.position = "bottom")
guarda(p6, "R06_curvas_fenologicas_municipio.png", 10, 5.2)

fen <- F %>% filter(municipio %in% mun_grande) %>%
  select(municipio, `Máx. NDVI` = pl_ndvi_max, `Día de arranque` = pl_ndvi_doy_arranque, `Día de pico` = pl_ndvi_doy_pico, `Duración (días)` = pl_ndvi_duracion, `NDVI base (ene-abr)` = pl_ndvi_base) %>%
  pivot_longer(-municipio, names_to = "rasgo", values_to = "valor")
p7 <- ggplot(fen, aes(corto(municipio), valor, fill = corto(municipio))) + geom_boxplot(outlier.size = 0.8, show.legend = FALSE) + facet_wrap(~rasgo, scales = "free_y", nrow = 2) +
  scale_fill_brewer(palette = "Set2") + labs(title = "Rasgos fenológicos (Planet) por municipio", x = NULL, y = NULL) + theme(axis.text.x = element_text(angle = 30, hjust = 1))
guarda(p7, "R07_rasgos_fenologicos_municipio.png", 11, 6.5)


idx <- c("ndvi", "evi", "savi", "lai", "fapar", "ndwi", "msi", "ndti", "ndsvi", "crc", "srndi")
s2 <- sat %>% filter(sensor == "Sentinel-2", !sin_indices) %>% select(paste0(idx, "_promedio")) %>% rename_with(~sub("_promedio", "", .x))
cm_idx <- cor(s2, method = "spearman", use = "pairwise.complete.obs")
write_csv(as_tibble(cm_idx, rownames = "indice"), "reportes_R/correlacion_indices_sentinel2.csv")
cd <- as_tibble(cm_idx, rownames = "a") %>% pivot_longer(-a, names_to = "b", values_to = "rho") %>% mutate(a = factor(a, idx), b = factor(b, rev(idx)))
p8 <- ggplot(cd, aes(a, b, fill = rho)) + geom_tile(colour = "white") + geom_text(aes(label = sprintf("%.2f", rho)), size = 2.8) +
  scale_fill_gradient2(low = "#B71C1C", mid = "white", high = "#0D47A1", limits = c(-1, 1)) +
  labs(title = "Correlación de Spearman entre índices (Sentinel-2, observaciones válidas)", subtitle = "Fuerte redundancia: muchos índices miden lo mismo", x = NULL, y = NULL, fill = "ρ")
guarda(p8, "R08_correlacion_indices_s2.png", 8.5, 7)

# Spearman de rasgos de parcela vs rendimiento (entrenamiento) con corrección de Bonferroni
excl <- c("RENDIMIENTO_T_HA", "lat", "lon", "cluster_fenologico", "anomalia_score")
num <- ent %>% select(where(is.numeric)) %>% select(-any_of(excl)) %>% select(where(~ n_distinct(.x) > 3))
sp <- map_dfr(names(num), function(v) { ok <- !is.na(num[[v]]); ct <- suppressWarnings(cor.test(num[[v]][ok], ent$RENDIMIENTO_T_HA[ok], method = "spearman", exact = FALSE))
  tibble(variable = v, n = sum(ok), rho = unname(ct$estimate), p = ct$p.value) }) %>%
  mutate(p_bonferroni = pmin(p * n(), 1), significativa = p_bonferroni < 0.05) %>% arrange(desc(abs(rho)))
write_csv(sp, "reportes_R/spearman_rasgos_vs_rendimiento.csv"); print(head(sp, 8))
top <- sp %>% slice_head(n = 20) %>% mutate(variable = fct_reorder(variable, rho))
p9 <- ggplot(top, aes(rho, variable, fill = significativa)) + geom_col() + scale_fill_manual(values = c("TRUE" = "#2E7D32", "FALSE" = "grey60"), labels = c("TRUE" = "Significativa global (confundida por municipio)", "FALSE" = "No significativa"), drop = FALSE) +
  labs(title = "Top 20 |Spearman| de rasgos de parcela con el rendimiento (n = 138)", subtitle = str_wrap(paste0(nrow(sp), " pruebas (Bonferroni). Significancia GLOBAL, confundida por municipio: dentro de municipio ninguna sobrevive (prueba de permutaciones, informe §9)"), 95),
       x = "Spearman ρ", y = NULL, fill = NULL) + theme(legend.position = "bottom")
guarda(p9, "R09_spearman_vs_rendimiento.png", 9, 7)


rho_glob <- cor(ent$amp_ciclo, ent$RENDIMIENTO_T_HA, method = "spearman")
rho_int <- ent %>% filter(municipio %in% c("Chignahuapan", "Calpulalpan")) %>% group_by(municipio) %>% summarise(rho = cor(amp_ciclo, RENDIMIENTO_T_HA, method = "spearman"), n = n(), .groups = "drop")
cat("Spearman global amplitud-rendimiento:", round(rho_glob, 3), "\n"); print(rho_int)
p10 <- ggplot(ent, aes(amp_ciclo, RENDIMIENTO_T_HA)) + geom_point(aes(colour = corto(municipio)), alpha = 0.75, size = 2) +
  geom_smooth(method = "lm", se = FALSE, colour = "black", linetype = "dashed") +
  geom_smooth(data = filter(ent, municipio %in% c("Chignahuapan", "Calpulalpan")), aes(colour = corto(municipio)), method = "lm", se = FALSE) +
  labs(title = "El clima parece asociarse con el rendimiento, pero es un efecto del municipio",
       subtitle = sprintf("Línea negra (global): ρ = %.2f. Líneas de color (dentro de municipio): ρ = %.2f (Chignahuapan) y %.2f (Calpulalpan)", rho_glob,
                          rho_int$rho[rho_int$municipio == "Chignahuapan"], rho_int$rho[rho_int$municipio == "Calpulalpan"]),
       x = "Amplitud térmica media del ciclo abr-oct (°C)", y = "Rendimiento (t/ha)", colour = "Municipio") + theme(legend.position = "bottom")
guarda(p10, "R10_confusion_clima_municipio.png", 10, 6)


cmp <- F %>% select(CONJUNTO, `Área (ha, log10)` = AREA_HA, `Elevación media (m)` = elev_media, `Pendiente media` = pend_media, `NDVI máx. (Planet)` = pl_ndvi_max) %>%
  mutate(`Área (ha, log10)` = log10(`Área (ha, log10)`)) %>% pivot_longer(-CONJUNTO, names_to = "variable", values_to = "valor")
p11 <- ggplot(cmp, aes(valor, fill = CONJUNTO)) + geom_density(alpha = 0.5) + facet_wrap(~variable, scales = "free", nrow = 1) + scale_fill_manual(values = c("ENTRENAMIENTO" = "#1565C0", "PREDICCION" = "#E65100")) +
  labs(title = "Entrenamiento vs. predicción: distribuciones comparables (no hay desplazamiento evidente)", x = NULL, y = "Densidad", fill = NULL) + theme(legend.position = "bottom")
guarda(p11, "R11_entrenamiento_vs_prediccion.png", 13, 4.2)
mp <- F %>% count(CONJUNTO, municipio) %>% group_by(CONJUNTO) %>% mutate(pct = n / sum(n)) %>% ungroup()
p12 <- ggplot(mp, aes(fct_reorder(corto(municipio), pct), pct, fill = CONJUNTO)) + geom_col(position = "dodge") + coord_flip() + scale_y_continuous(labels = percent) +
  scale_fill_manual(values = c("ENTRENAMIENTO" = "#1565C0", "PREDICCION" = "#E65100")) + labs(title = "Mezcla de municipios por conjunto", x = NULL, y = "% de parcelas del conjunto", fill = NULL) + theme(legend.position = "bottom")
guarda(p12, "R12_municipios_por_conjunto.png", 8, 5)


oof <- read_csv("reportes/prediccion_final_oof.csv", show_col_types = FALSE)
pr  <- read_csv("reportes/predicciones_parcelas_PREDICCION.csv", show_col_types = FALSE)
rmse <- sqrt(mean(oof$resid^2)); mae <- mean(abs(oof$resid)); r2 <- 1 - sum(oof$resid^2) / sum((oof$obs - mean(oof$obs))^2)
cat(sprintf("Modelo final (OOF promedio de repeticiones): RMSE=%.3f MAE=%.3f R2=%.3f\n", rmse, mae, r2))
q1 <- ggplot(oof, aes(obs, oof_pred, colour = corto(municipio))) + geom_abline(slope = 1, intercept = 0, linetype = "dashed") + geom_point(size = 2, alpha = 0.8) +
  labs(title = "Observado vs. predicho fuera de muestra", subtitle = sprintf("RMSE = %.2f, MAE = %.2f t/ha (sobre predicción promedio de 4 repeticiones)", rmse, mae),
       x = "Observado (t/ha)", y = "Predicho OOF (t/ha)", colour = "Municipio") + theme(legend.position = "bottom") +
  guides(colour = guide_legend(title.position = "top", nrow = 3))
q2 <- oof %>% mutate(m = fct_reorder(corto(municipio), resid, ~ sqrt(mean(.x^2)))) %>% ggplot(aes(resid, m)) + geom_vline(xintercept = 0) + geom_boxplot(fill = "#FFE0B2", outlier.size = 1) +
  labs(title = "Residuos por municipio", subtitle = "Chignahuapan concentra el mayor error", x = "Residuo = observado − predicho (t/ha)", y = NULL)
guarda(q1 | q2, "R13_modelo_final_validacion.png", 13, 5.5)
q3 <- ggplot(pr, aes(fct_reorder(ID_parcela, rendimiento_predicho_ton_ha), rendimiento_predicho_ton_ha, colour = corto(municipio))) +
  geom_pointrange(aes(ymin = limite_inf_90, ymax = limite_sup_90), size = 0.3) + coord_flip() + theme(axis.text.y = element_text(size = 5)) +
  labs(title = "Rendimiento predicho con intervalo del 90 % (59 parcelas de PREDICCION)", x = "ID_parcela", y = "Rendimiento predicho (t/ha)", colour = "Municipio") + theme(legend.position = "bottom")
guarda(q3, "R14_predicciones_intervalos.png", 8, 10)


resumen <- tibble(
  metrica = c("kruskal_p_rend_municipio", "spearman_global_amp_ciclo", "rendimiento_media_entrenamiento", "oof_rmse", "oof_mae", "oof_r2", "n_rasgos_probados", "n_significativos_bonferroni"),
  valor_R = c(kw$p.value, rho_glob, mean(ent$RENDIMIENTO_T_HA), rmse, mae, r2, nrow(sp), sum(sp$significativa)))
write_csv(resumen, "reportes_R/resumen_numerico_R.csv"); print(resumen)
cat("\nGráficas generadas:", length(list.files("graficas_R", pattern = "^R[0-9]+.*png$")), "\n")
