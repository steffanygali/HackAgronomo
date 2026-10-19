"""Fachada retrocompatible de carga y filtrado de datos estáticos (JSON/CSV).

La aplicación principal usa ``app.repositories.datos_estaticos`` cargando todo en
memoria durante el ``lifespan`` de FastAPI. Este módulo se conserva por
retrocompatibilidad y corrige ``filtrar_parcelas`` para aceptar tanto un objeto
``FiltrosParcelas`` como argumentos sueltos ``(municipio, q)``.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.models.parcela import FiltrosParcelas

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


def _cargar_json(nombre_archivo: str) -> Any:
    """Carga y devuelve el contenido de un archivo JSON de data/."""
    ruta = DATA_DIR / nombre_archivo
    with ruta.open("r", encoding="utf-8") as f:
        return json.load(f)


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
    ruta = DATA_DIR / "anexo.csv"
    with ruta.open("r", encoding="utf-8") as f:
        return f.read()


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
