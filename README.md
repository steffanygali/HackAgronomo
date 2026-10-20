# Back HackAgronomo — API AgroCebada FIRA 2026

Backend desarrollado con **FastAPI**, sin base de datos, gestionado con **uv**. Carga, valida con Pydantic y sanea los datos estáticos en memoria durante el arranque (`lifespan`) para responder en `< 5 ms` sin lecturas a disco por petición.

## Estructura del proyecto

```text
HackAgronomo-backend/
├── pyproject.toml                  # Configuración del proyecto, ruff y pytest (uv)
├── .python-version                 # Versión de Python
├── .env.example                    # Plantilla de variables de entorno
├── main.py                         # Punto de entrada y factoría create_app()
├── data/                           # Datasets estáticos validados en el arranque
│   ├── anexo.csv
│   ├── meta.json
│   ├── modelos.json
│   ├── municipios.json
│   └── parcelas.json
├── app/
│   ├── core/
│   │   ├── config.py               # Settings seguro por defecto (DEBUG=False)
│   │   ├── errors.py               # Manejadores globales { error: { code, message } }
│   │   ├── logging.py              # Configuración de logs de auditoría
│   │   ├── middleware.py           # Headers HTTP, tamaño de body, X-Request-ID
│   │   ├── privacy.py              # Privacidad LFPDPPP (seudonimización P-HGO-001)
│   │   └── rate_limit.py           # Rate limiting en memoria por ventana deslizante
│   ├── repositories/
│   │   └── datos_estaticos.py      # Carga única e inmutable en memoria (lifespan)
│   ├── services/
│   │   ├── parcelas.py             # Filtrado y búsqueda O(1) de parcelas
│   │   └── fira_live.py            # 197 parcelas FIRA (sub-lotes A/B/C) e inferencia
│   ├── models/                     # Esquemas Pydantic v2 estrictos
│   └── api/
│       ├── deps.py                 # Dependencias tipadas (DatosDep, SettingsDep)
│       └── endpoints/              # Controladores HTTP (/api/v1/* y /api/*)
└── tests/                          # Pruebas de contrato, no-regresión y AppSec
```

## Endpoints disponibles

### Contrato `/api/v1` (Dashboard)
- `GET /api/v1/meta` — Metadatos y métricas globales del modelo.
- `GET /api/v1/parcelas` — Lista las 59 parcelas de evaluación (filtros `municipio` y `q`).
- `GET /api/v1/parcelas/{parcela_id}` — Detalle de una parcela por su ID.
- `GET /api/v1/municipios` — Ranking de municipios por rendimiento esperado.
- `GET /api/v1/modelos` — Comparación de modelos por validación cruzada.
- `GET /api/v1/export/anexo.csv` — Descarga directa (`text/csv; charset=utf-8`, `attachment; filename="predicciones_evaluacion_30_fira.csv"`).

### Rutas directas FIRA (`/api`)
- `GET /api/anexo-fira.csv` y `GET /api/export-eval-csv` — Alias directos para descarga del anexo CSV mediante `curl` o scripts de evaluación.
- `GET /api/parcels` — 197 parcelas con sus 3 sub-lotes (`Lote A`, `Lote B`, `Lote C`), 6 fechas satelitales y productores seudonimizados (`Productor P-HGO-001`) conforme a la LFPDPPP.
- `GET /api/model-insights` — Métricas de validación cruzada y las 3 preguntas guía.
- `POST /api/predict` — Inferencia interactiva en vivo con validación de rangos agronómicos.

## Instalación y ejecución

```bash
# Sincronizar dependencias (incluyendo grupo dev)
uv sync --group dev

# Copiar variables de entorno para desarrollo local
cp .env.example .env

# Ejecutar en desarrollo
uv run uvicorn main:app --reload
# o directamente:
uv run python main.py

# Ejecutar suite de pruebas y linter de seguridad
uv run pytest -v
ruff check main.py app/ tests/
```

## Despliegue en Render

El archivo `render.yaml` configura el backend como web service y el frontend de la rama `frontend` como sitio estático. En Render, crea un **Blueprint** desde `steffanygali/HackAgronomo`, selecciona la rama `back` y revisa que ambos servicios usen el plan gratuito. El Blueprint conecta `VITE_API_URL` con la URL pública de la API y agrega automáticamente el origen público del frontend a CORS.

El servicio gratuito de API puede suspenderse tras inactividad y tardar cerca de un minuto en responder al primer acceso posterior. El frontend estático permanece disponible.

## Ejecutar frontend y backend juntos

Aunque se comuniquen entre sí, son dos procesos y se mantienen abiertos en dos terminales:

```bash
# Terminal 1: API
cd back
[ -f .env ] || cp .env.example .env
uv sync
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

```bash
# Terminal 2: frontend
cd frontend
[ -f .env.local ] || cp .env.example .env.local
npm install
npm run dev
```

Abre `http://localhost:5173`. La variable `VITE_API_URL` del frontend apunta a `http://localhost:8000` por defecto.
