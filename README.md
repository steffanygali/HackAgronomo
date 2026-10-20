# AgroCebada FIRA 2026

Aplicación web para explorar parcelas de cebada de Hidalgo, Tlaxcala y Puebla. La web está publicada y conectada a una API FastAPI.

## URLs publicadas

- **Web:** <https://agrocebada-fira-web.onrender.com>
- **API:** <https://agrocebada-fira-api.onrender.com>
- **Documentación de la API:** <https://agrocebada-fira-api.onrender.com/docs>
- **Estado de la API:** <https://agrocebada-fira-api.onrender.com/health>
- **Parcelas y polígonos:** <https://agrocebada-fira-api.onrender.com/api/parcels>

La web consume la API para mostrar las 197 parcelas. La respuesta de `/api/parcels` incluye sus coordenadas de polígono. El mapa dibuja los contornos del GeoJSON; las divisiones A/B/C internas son subdivisiones esquemáticas generadas por el backend, no límites medidos en el GeoJSON.

## Ramas del repositorio

El repositorio `steffanygali/HackAgronomo` organiza los componentes en ramas independientes:

- `back`: API FastAPI, datos y `render.yaml`.
- `frontend`: aplicación React/Vite.
- `scripts`: scripts de análisis.

Para preparar una carpeta local con los dos componentes, clona las ramas `back` y `frontend` como carpetas hermanas:

```bash
mkdir HackAgronomo1
cd HackAgronomo1
git clone --branch back --single-branch https://github.com/steffanygali/HackAgronomo.git back
git clone --branch frontend --single-branch https://github.com/steffanygali/HackAgronomo.git frontend
```

## Ejecutar localmente

Se necesitan **dos terminales**: la conexión entre la web y la API está configurada, pero cada componente mantiene su propio proceso.

### 1. Iniciar la API

En la primera terminal, desde la carpeta `HackAgronomo1`:

```bash
cd back
[ -f .env ] || cp .env.example .env
uv sync
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

La API carga sus datos al iniciar, incluido `data/coordenadas.geojson`.

### 2. Iniciar el frontend

En una segunda terminal, desde la misma carpeta `HackAgronomo1`:

```bash
cd frontend
[ -f .env.local ] || cp .env.example .env.local
npm install
npm run dev
```

Abre <http://localhost:5173>. Para desarrollo local, `VITE_API_URL` apunta a `http://localhost:8000`. Si cambias ese valor, reinicia el servidor de Vite.

## Despliegue

Los servicios publicados se administran como Blueprint de Render. Para recrearlos, crea un Blueprint con el repositorio `steffanygali/HackAgronomo` y la rama `back`; Render leerá `render.yaml` y desplegará la API desde `back` y el frontend estático desde `frontend`.

El Blueprint enlaza la URL pública del frontend con `FRONTEND_ORIGIN` en la API y configura `VITE_API_URL` con la URL pública de la API. El backend acepta el origen del frontend mediante CORS explícito.

Ambos servicios están en el plan gratuito. Render suspende los servicios web gratuitos después de 15 minutos sin tráfico; la API puede tardar cerca de un minuto en responder a la primera petición tras despertarse. El sitio estático permanece servido. Consulta los [límites actuales del plan gratuito de Render](https://render.com/docs/free).

## Alcance actual

- `GET /api/parcels` entrega las 197 parcelas y sus polígonos.
- `GET /api/model-insights` entrega los indicadores del modelo.
- `POST /api/predict` está conectado, pero su implementación usa la fórmula actual del servicio backend; aún no carga el artefacto del modelo entrenado final.

Consulta también `back/README.md` y `frontend/README.md` para los detalles propios de cada componente.
