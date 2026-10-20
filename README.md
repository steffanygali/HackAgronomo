# AgroCebada FIRA 2026 — Frontend Geoespacial, Predicción de Rendimiento y Simulador Financiero

Aplicación web interactiva desarrollada para el **Reto AgroCebada 2026 de FIRA**, diseñada para monitorear las **197 parcelas georreferenciadas** de cebada en **Hidalgo, Tlaxcala y Puebla**, visualizar las parcelas divididas por sub-lotes y fechas de evaluación satelital, consultar las predicciones de rendimiento (ton/ha) y simular los ingresos agrícolas y la viabilidad crediticia.

---

## Características Principales

1. **Mapa Satelital y Topográfico Interactivo (`MapLibre GL JS`):**
   - Visualización de los polígonos georreferenciados de las **197 parcelas** (138 de entrenamiento = 70% con rendimiento conocido; 59 de evaluación = 30% estimado para el reto).
   - **Parcelas Divididas (Sub-lotes internos):** Cada parcela está dividida en 3 secciones georreferenciadas (`Lote A - Norte`, `Lote B - Centro`, `Lote C - Sur`) con diagnóstico individual de suelo, NDVI, humedad y cosecha estimada.
   - Capas temáticas conmutables en tiempo real: **Rendimiento Predicho (t/ha)**, **Vigor NDVI por Fecha de Toma**, **Humedad NDWI** y **Partición 70% Train / 30% Eval**.

2. **Línea de Tiempo Fenológica de Evaluaciones:**
   - Recorrido interactivo y animable por las **6 fechas de evaluación satelital** (`Sentinel-2 MSI L2A`) desde *Siembra y Emergencia* hasta *Madurez y Cosecha*, mostrando fecha y hora de captura, NDVI, NDWI, precipitación acumulada y temperaturas.

3. **Doble Experiencia de Usuario:**
   - **Vista Agricultor (*Mi Parcela Dividida*):** Enfocada en el productor cebadero para inspeccionar los sub-lotes de su parcela, comparar su rendimiento esperado frente al promedio de su municipio, ver alertas agronómicas y calcular sus ingresos y ganancia neta.
   - **Vista Analista / Evaluador del Hack (FIRA):**
     - **Simulador de Ingresos Regionales e Inclusión Financiera FIRA:** Simula precios por tonelada, costos por hectárea (Agrocostos FIRA), choques climáticos ($\pm\%$ lluvia/helada) y garantías FEGA, calculando el **Ratio de Cobertura de Deuda (DSCR)** y elegibilidad crediticia.
     - **Desempeño Predictivo (70%) y las 3 Preguntas Guía (Bonus Extra):** Métricas de validación cruzada ($RMSE$, $MAE$, $R^2$), importancia SHAP de índices vegetativos, peso de variables climáticas, estudio de ablación de combinaciones de variables y explicabilidad local SHAP por parcela.
     - **Inferencia en Vivo (`POST /api/predict`):** Ejecución interactiva del modelo predictivo modificando variables satelitales y climáticas.
     - **Exportación Oficial CSV:** Descarga en 1 clic del archivo CSV con el **30% de parcelas de evaluación** listo para entregar en la plataforma de FIRA.

---

## Instalación y Ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo (http://localhost:5173)
npm run dev

# 3. Compilar para producción
npm run build
```

---

## Configuración de la API

La aplicación consulta automáticamente la API configurada en `VITE_API_URL` (o `VITE_BACKEND_URL`) desde [`src/services/api.ts`](./src/services/api.ts). En Render, define `VITE_API_URL` con la URL pública del backend en la configuración de compilación del frontend. Para desarrollo local, crea `.env` con `VITE_API_URL=http://localhost:8000` y ejecuta el backend por separado. Si la API no está disponible, la interfaz conserva el conjunto de datos local como respaldo.

### Endpoints que consume la aplicación

1. **`GET /api/parcels`**
   Devuelve el arreglo de parcelas (`BarleyParcel[]`) o `{ "parcels": [...] }`.
2. **`POST /api/predict`**
   Recibe:
   ```json
   {
     "state": "Hidalgo",
     "altitudeM": 2488,
     "regime": "Temporal",
     "ndviEspigado": 0.76,
     "ndwiLlenado": 0.34,
     "eviEncanado": 0.61,
     "precipJulAgoMm": 265,
     "tempMinSepC": 7.8,
     "gddTotal": 1590
   }
   ```
   Devuelve:
   ```json
   {
     "predictedYieldTonHa": 4.42,
     "confidenceInterval": [4.18, 4.66],
     "firaCreditScore": 86,
     "riskLevel": "Bajo"
   }
   ```
3. **`GET /api/model-insights`**
   Devuelve las métricas del modelo (`RMSE`, `MAE`, `R2`) y las respuestas cuantitativas a las 3 Preguntas Guía de FIRA.
