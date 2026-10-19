"""Carga los archivos estáticos de datos (JSON/CSV) que sirve la API.

El backend no usa base de datos: toda la información se lee de los archivos
ubicados en ``data/`` (copiados del frontend ``agrocebada-dashboard``).
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


def _cargar_json(nombre_archivo: str) -> Any:
    """Carga y devuelve el contenido de un archivo JSON de data/."""
    ruta = DATA_DIR / nombre_archivo
    with ruta.open("r", encoding="utf-8") as f:
        return json.load(f)


def cargar_meta() -> dict[str, Any]:
    """Devuelve los metadatos globales del modelo (meta.json)."""
    return _cargar_json("meta.json")


def cargar_parcelas() -> list[dict[str, Any]]:
    """Devuelve la lista completa de parcelas con predicción (parcelas.json)."""
    return _cargar_json("parcelas.json")


def cargar_municipios() -> list[dict[str, Any]]:
    """Devuelve el ranking de municipios (municipios.json)."""
    return _cargar_json("municipios.json")


def cargar_modelos() -> list[dict[str, Any]]:
    """Devuelve la comparación de modelos por validación cruzada (modelos.json)."""
    return _cargar_json("modelos.json")


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
    municipio: str | None = None,
    q: str | None = None,
) -> list[dict[str, Any]]:
    """Filtra la lista de parcelas por municipio exacto y/o búsqueda por ID/municipio."""
    resultado = parcelas
    if municipio:
        resultado = [p for p in resultado if p.get("municipio") == municipio]
    if q:
        q_lower = q.lower()
        resultado = [
            p
            for p in resultado
            if q_lower in str(p.get("id", "")).lower()
            or q_lower in str(p.get("municipio", "")).lower()
        ]
    return resultado
