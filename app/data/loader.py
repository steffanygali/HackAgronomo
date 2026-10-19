"""Carga los archivos estáticos de datos (JSON/CSV) que sirve la API.

La aplicación principal usa ``app.repositories.datos_estaticos`` cargando y
validando todo en memoria durante el ``lifespan`` de FastAPI. Este módulo se
conserva por retrocompatibilidad con ``origin/back``, devuelve copias defensivas
para impedir mutación accidental de ``_cache`` y soporta tanto ``FiltrosParcelas``
como argumentos sueltos ``(municipio, q)``.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

from app.models.parcela import FiltrosParcelas

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

_cache: dict[str, Any] = {}


def _cargar_json(nombre_archivo: str) -> Any:
    """Carga y devuelve una copia defensiva del contenido de un archivo JSON de data/."""
    if nombre_archivo not in _cache:
        ruta = DATA_DIR / nombre_archivo
        with ruta.open("r", encoding="utf-8") as f:
            _cache[nombre_archivo] = json.load(f)
    return copy.deepcopy(_cache[nombre_archivo])


def cargar_meta() -> dict[str, Any]:
    """Devuelve los metadatos globales del modelo (meta.json)."""
    res: dict[str, Any] = _cargar_json("meta.json")
    return res


def cargar_parcelas() -> list[dict[str, Any]]:
    """Devuelve la lista completa de parcelas con predicción (parcelas.json)."""
    res: list[dict[str, Any]] = _cargar_json("parcelas.json")
    return res


def cargar_municipios() -> list[dict[str, Any]]:
    """Devuelve el ranking de municipios (municipios.json)."""
    res: list[dict[str, Any]] = _cargar_json("municipios.json")
    return res


def cargar_modelos() -> list[dict[str, Any]]:
    """Devuelve la comparación de modelos por validación cruzada (modelos.json)."""
    res: list[dict[str, Any]] = _cargar_json("modelos.json")
    return res


def cargar_anexo_csv() -> str:
    """Devuelve el contenido CSV del anexo de predicciones (anexo.csv)."""
    if "anexo.csv" not in _cache:
        ruta = DATA_DIR / "anexo.csv"
        with ruta.open("r", encoding="utf-8") as f:
            _cache["anexo.csv"] = f.read()
    res: str = _cache["anexo.csv"]
    return res


def buscar_parcela_por_id(parcela_id: str) -> dict[str, Any] | None:
    """Busca una parcela por su ID. Devuelve None si no existe."""
    for parcela in cargar_parcelas():
        if parcela.get("id") == parcela_id:
            return parcela
    return None


def filtrar_parcelas(
    parcelas: list[dict[str, Any]],
    municipio: str | FiltrosParcelas | None = None,
    q: str | None = None,
) -> list[dict[str, Any]]:
    """Filtra la lista de parcelas aceptando FiltrosParcelas o (municipio, q)."""
    if isinstance(municipio, FiltrosParcelas):
        filtro_muni = municipio.municipio
        filtro_q = municipio.q
    else:
        filtro_muni = municipio
        filtro_q = q

    resultado = list(parcelas)
    if filtro_muni:
        resultado = [p for p in resultado if p.get("municipio") == filtro_muni]
    if filtro_q:
        q_lower = filtro_q.lower()
        resultado = [
            p
            for p in resultado
            if q_lower in str(p.get("id", "")).lower()
            or q_lower in str(p.get("municipio", "")).lower()
        ]
    return resultado
