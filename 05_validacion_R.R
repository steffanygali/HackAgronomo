# VALIDACIÓN COMPLEMENTARIA EN R
# Compara contra los resultados de Python
 suppressPackageStartupMessages({library(dplyr); library(readr); library(purrr); 
library(tibble); library(ggplot2)})
imap_dfr <- function(.x, .f) purrr::imap(.x, .f) |> purrr::list_rbind()
dir.create("reportes_R", showWarnings = FALSE); dir.create("graficas_R", showWarnings = FALSE)
orig <- "datos_originales/DATASET_RETO_AGRO_2026"

# 1) Dimensiones y nulos de los ORIGINALES (comparar con diagnóstico Python)
leer <- function(f) read_csv(file.path(orig, f), show_col_types = FALSE, locale = locale(encoding = "UTF-8"))
ds <- list(rend = leer("ID_area_rendimiento_70_30_Reto_AgroCebada.csv"),
           pro  = leer("Conjunto_datos_PRO_AgroCebada.csv"),
           bas  = leer("Conjunto_datos_BASICO_AgroCebada2026.csv"))
resumen <- imap_dfr(ds, ~tibble(dataset = .y, filas = nrow(.x), columnas = ncol(.x),
                                celdas_nulas_pct = round(mean(is.na(.x)) * 100, 3)))
print(resumen); write_csv(resumen, "reportes_R/dimensiones_nulos_originales.csv")


# 2) Datos limpios: filas utilizables y estadísticos de NDVI por sensor
pro <- read_csv("datos_limpios/PRO_limpio_completo.csv", show_col_types = FALSE)
bas <- read_csv("datos_limpios/BASICO_limpio_completo.csv", show_col_types = FALSE)
cat("Filas sin índices PRO:", sum(pro$sin_indices), "(esperado 12057) | BASICO:", sum(bas$sin_indices), "(esperado 31741)\n")
est <- bind_rows(mutate(pro, ds = "PRO"), mutate(bas, ds = "BASICO")) %>% filter(!sin_indices, !is.na(ndvi_promedio)) %>%
  group_by(ds, sensor) %>% summarise(n = n(), media = mean(ndvi_promedio), mediana = median(ndvi_promedio),
                                     sd = sd(ndvi_promedio), min = min(ndvi_promedio), max = max(ndvi_promedio), .groups = "drop")
print(est); write_csv(est, "reportes_R/ndvi_estadisticos.csv")

# 3) Spearman parcela-nivel vs rendimiento 
f <- read_csv("datos_limpios/features_parcela_ciclo2025_EXPLORATORIO.csv", show_col_types = FALSE) %>% filter(CONJUNTO == "ENTRENAMIENTO")
vars <- c("s2_ndvi_max", "pl_ndvi_max", "ls_vi6t_max", "amplitud_ciclo_c", "prec_ciclo_mm", "AREA_HA", "elev_media")
sp <- map_dfr(vars, ~{ok <- complete.cases(f[[.x]], f$RENDIMIENTO_T_HA); ct <- cor.test(f[[.x]][ok], f$RENDIMIENTO_T_HA[ok], method = "spearman", exact = FALSE)
                     tibble(variable = .x, n = sum(ok), rho = unname(ct$estimate), p = ct$p.value)})
print(sp); write_csv(sp, "reportes_R/spearman_vs_rendimiento.csv")

# 4) Gráfica de control: rendimiento por municipio
g <- ggplot(f, aes(reorder(municipio, RENDIMIENTO_T_HA, median), RENDIMIENTO_T_HA)) + geom_boxplot() + coord_flip() +
  labs(title = "Rendimiento por municipio (entrenamiento)", x = NULL, y = "Rendimiento (t/ha)")
ggsave("graficas_R/rendimiento_municipio.png", g, width = 8, height = 5, dpi = 130)
