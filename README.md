# Back HackAgronomo

Backend desarrollado con **FastAPI**, sin base de datos, gestionado con **uv**.

## Estructura del proyecto (estilo backendboom)

```text
back hackagronomo/
├── pyproject.toml         # Configuración del proyecto y dependencias (uv)
├── .python-version        # Versión de Python
├── .gitignore
├── README.md
├── main.py                # Punto de entrada de la aplicación
└── app/
    ├── __init__.py
    ├── core/
    │   ├── __init__.py
    │   └── config.py      # Configuración (settings)
    ├── api/
    │   ├── __init__.py
    │   ├── deps.py        # Dependencias compartidas
    │   └── endpoints/
    │       ├── __init__.py
    │       └── root.py    # Endpoints raíz y healthcheck
    └── models/
        ├── __init__.py    # Exportes de modelos
        └── parcela.py     # Modelo Pydantic (sin BD)
```

> Se omite intencionadamente `migrations/` y `serializers/` porque no se usa base de datos.

## Requisitos

- [uv](https://docs.astral.sh/uv/) instalado.
- Python 3.10+

## Instalación y ejecución

Desde la carpeta del proyecto:

```bash
# Crear entorno virtual llamado "dev"
uv venv dev

# Activar el entorno (Linux/macOS)
source dev/bin/activate

# Instalar dependencias de producción
uv sync

# Instalar dependencias de desarrollo
uv sync --group dev

# Ejecutar el servidor
uv run uvicorn main:app --reload
# o directamente
uv run main.py
```

Documentación automática de la API:
- Swagger UI: http://localhost:8000/docs
- Redoc: http://localhost:8000/redoc

## Modelo

El proyecto incluye un modelo Pydantic `Parcela` en `app/models/parcela.py`, usado para validar los datos de entrada y salida sin depender de una base de datos.
