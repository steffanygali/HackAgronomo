# Dashboard AgroCebada FIRA 2026

Aplicación React que presenta el modelo de predicción de rendimiento de cebada
(ton/ha) para las 59 parcelas sin rendimiento del Reto AgroCebada FIRA 2026.
Responde en menos de 5 minutos: **cuánto rendirá una parcela**, **cuánta
confianza merece** y **de dónde sale el número**, y muestra por qué se eligió un
modelo simple (mediana municipal + ajuste fino) frente a Random Forest,
Gradient Boosting y Extra Trees.

## Stack

React 18.3.1 · Vite 6.0.5 · TypeScript 5.6.2 (estricto) · React Router 6.28.0
(una ruta por pestaña, `HashRouter`) · TanStack Query 5.62.7 · zod 3.24.1 ·
CSS con variables y CSS Modules (sin librerías de UI) · gráficas SVG propias ·
Vitest 2.1.8 + Testing Library · ESLint 9 + Prettier. Versiones exactas fijadas
en `package.json` (sin `^` ni `~`).

## Requisitos

- Node.js 20 o superior (probado en 26).

## Instalar y correr

```bash
npm install
npm run seed      # genera public/data/*.json a partir de data-raw/
npm run dev       # http://localhost:5173
```

Otros comandos:

```bash
npm test          # pruebas (genera el seed antes)
npm run lint      # ESLint
npm run build     # tsc -b && vite build  (genera el seed antes)
npm run format    # Prettier
```

## Datos semilla

`scripts/build-seed.mjs` (Node, sin dependencias) lee los archivos del modelo
desde **`data-raw/`** y escribe **`public/data/`** con exactamente la forma del
contrato (`docs/openapi.yaml`):

| Entrada (`data-raw/`)             | Salida (`public/data/`)        |
| --------------------------------- | ------------------------------ |
| `predicciones_PREDICCION.csv`     | `parcelas.json`, `anexo.csv`   |
| `features_modelado.csv`           | `parcelas.json` (lat/lon, conteo de entrenamiento) |
| `comparacion_modelos_cv.csv`      | `modelos.json`                 |
| `versiones.json` + `resumen_modelo.md` | `meta.json`               |
| —                                 | `municipios.json`              |

`data-raw/` está en `.gitignore`: no se sube al control de versiones. El script
aborta con un mensaje claro si falta un archivo o si un dato no cuadra (59
predicciones, 197 parcelas, 138 de entrenamiento, intervalos ordenados, etc.).

### Sobre `desglose` (mediana municipal + ajuste del Ridge)

El CSV de predicciones **solo exporta** `ID_parcela`,
`rendimiento_predicho_ton_ha`, `limite_inferior_90`, `limite_superior_90` y
`municipio`. Las columnas que alimentan la pestaña «¿De dónde sale?» no existen
en ese CSV, así que `build-seed.mjs` las **reconstruye de forma exacta y
determinista** desde `features_modelado.csv`, con las mismas fórmulas de
`entrenar_final.py`:

- `mediana_municipal` = mediana de `RENDIMIENTO_T_HA` de las parcelas con
  `CONJUNTO == "ENTRENAMIENTO"` del mismo municipio (el modelo híbrido usa el
  grupo `mun_g`; para los municipios con ≥ 9 parcelas ambos coinciden).
- `ajuste_ridge` = `rendimiento_predicho_ton_ha − mediana_municipal`
  (en `entrenar_final.py`: `ajuste = final − A`).
- `metodo` = `hibrido` si el municipio tiene ≥ 9 parcelas de entrenamiento;
  `knn_otros` en caso contrario (y entonces `desglose` queda en `null`).

La reconstrucción se valida contra el rango que reporta el propio modelo
(ajuste entre −0.09 y +0.08 t/ha).

**Recomendación al script de Python:** para no depender de la reconstrucción,
exporte en `predicciones_PREDICCION.csv` estas columnas por parcela:

```python
# dentro de main(), tras calcular pred_P:
med = pd.Series(y).groupby(g).median()
A_full = pd.Series(gP).map(med).fillna(np.median(y))       # mediana del grupo
pred_df["n_entrenamiento_municipio"] = P[COL_MUN].map(conteo_entrenamiento).fillna(0).astype(int)
pred_df["metodo"] = np.where(pred_df.n_entrenamiento_municipio >= MIN_PARCELAS_MUNICIPIO,
                             "hibrido", "knn_otros")
pred_df["mediana_municipal"] = np.round(A_full.values, 3)
pred_df["ajuste_ridge"] = np.round(pred_P - A_full.values, 3)
```

## Cambiar a modo API

Por defecto la app funciona con **datos embebidos** (`VITE_DATA_MODE=mock`), sin
ninguna petición de red. Para consumir un backend:

```bash
cp .env.example .env.local
# .env.local
VITE_DATA_MODE=api
VITE_API_BASE_URL=http://localhost:8080
```

Y para probarlo sin backend real:

```bash
npm run mock-api                                     # sirve el contrato en :8080
VITE_DATA_MODE=api VITE_API_BASE_URL=http://localhost:8080 npm run dev
```

No hay que tocar ningún componente: ambos orígenes implementan la misma interfaz
`DataSource` (`src/api/`). Cada respuesta se valida con zod; si el formato no
coincide, la app muestra un error claro («no cumple el contrato») y **no** datos
a medias. En modo `api` hay timeout de 10 s por petición y reintento automático
(2 intentos) además del botón «Reintentar».

## Endpoints que debe implementar el backend

Base `/api/v1`. Todos los errores: `{ "error": { "code": string, "message": string } }`.
Esquema completo en `docs/openapi.yaml`.

| Método y ruta                | Devuelve |
| ---------------------------- | -------- |
| `GET /meta`                  | `{ n_parcelas_total, n_entrenamiento, n_prediccion, metricas: { rmse, mae, r2 }, semiancho_global_90, modelo, generado_en }` |
| `GET /parcelas?municipio=&q=`| `[{ id, municipio, lat, lon, prediccion_ton_ha, limite_inferior_90, limite_superior_90, n_entrenamiento_municipio, confianza, metodo, desglose }]` |
| `GET /parcelas/{id}`         | un objeto igual al anterior |
| `GET /municipios`            | `[{ municipio, n_prediccion, n_entrenamiento, rendimiento_medio_predicho, semiancho_90, confianza }]` |
| `GET /modelos`               | `[{ modelo, rmse, rmse_sd, mae, r2, elegido }]` |
| `GET /export/anexo.csv`      | CSV con cabecera `ID_parcela,rendimiento_predicho_ton_ha` |

Regla de confianza (la calcula el backend o el script semilla; el frontend solo
la muestra): `baja` si `n_entrenamiento_municipio < 2`; `media` si está entre 2
y 8 (grupo «Otros»); `alta` si ≥ 9.

### Nota de CORS

El navegador llama a `VITE_API_BASE_URL` desde otro origen (el dev server de
Vite). El backend debe responder con `Access-Control-Allow-Origin` para el
origen del frontend (o `*` en desarrollo) y aceptar los métodos `GET`. El
`scripts/mock-api.mjs` incluido ya trae CORS abierto para desarrollo.

## Desplegar la versión estática (modo mock)

```bash
npm run build      # genera dist/ (incluye el seed)
```

`dist/` es totalmente estática y **no necesita internet**: los datos van
embebidos en el bundle y la navegación usa `HashRouter`, así que funciona en
cualquier hosting estático (Netlify, S3, un servidor de archivos) o incluso
abriendo `dist/index.html` directamente. Al no haber backend no se necesitan
rewrites.

## Estructura

```
agrocebada-dashboard/
├─ data-raw/                 # archivos del modelo (ignorados por git)
├─ docs/openapi.yaml         # contrato de la API
├─ public/data/              # JSON del seed (generados)
├─ scripts/
│  ├─ build-seed.mjs         # CSV del modelo → JSON del contrato
│  └─ mock-api.mjs           # backend mock para probar el modo api
└─ src/
   ├─ api/                   # DataSource, mockSource, httpSource, esquemas zod, hooks
   ├─ components/            # Layout (franja fija), Estados, ConfianzaBadge,
   │                         # IntervaloBarra, ParcelaSelector, DescargarAnexo
   ├─ features/
   │  ├─ mapa/               # dispersión SVG, lista con búsqueda, ficha
   │  ├─ origen/             # cascada mediana → Ridge → predicción
   │  ├─ simulador/          # ingreso y crédito (3 escenarios)
   │  └─ riesgo/             # ranking de municipios y modelos
   ├─ lib/                   # formato es-MX y cálculos puros del simulador
   └─ styles/tokens.css      # tokens de color, tipografía, espaciado y radios
```

## Pruebas

```bash
npm test
```

- `src/lib/calculos.test.ts`: caso base, no cubre el crédito, cero hectáreas,
  límite inferior (pesimista) y superior (optimista), entradas inválidas
  (vacías, negativas, no numéricas) y parseo.
- `src/api/mockSource.test.ts`: 59 parcelas con IDs únicos y coincidentes con el
  CSV, valores de 5 parcelas (y de las 59) contra el CSV, Anexo con 59 filas,
  métricas de `meta.json` contra `comparacion_modelos_cv.csv`, regla de
  confianza y `desglose`.
- `src/api/httpSource.test.ts`: levanta un servidor local con la forma del
  contrato y comprueba que el modo `api` funciona sin tocar componentes
  (criterio 6), más errores 404/500 y respuestas que no cumplen el contrato.
- `src/App.test.tsx`: monta la app y verifica la franja fija y las 59 parcelas.
