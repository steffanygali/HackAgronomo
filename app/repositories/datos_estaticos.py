"""Repositorio en memoria cargado al inicio de la aplicación (lifespan).

Lee, sanea PII (LFPDPPP) y valida con Pydantic todos los archivos de ``data/``
además del dataset georreferenciado de 197 parcelas FIRA una sola vez al arrancar
(< 2 MB en RAM, 0 lecturas a disco por petición, latencia < 5 ms).
"""

from __future__ import annotations

import csv
import io
import json
from collections.abc import Mapping
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from types import MappingProxyType

from pydantic import TypeAdapter

from app.core.privacy import sanitizar_registro_parcela
from app.models import (
    BarleyParcel,
    Meta,
    ModelInsightsPayload,
    Modelo,
    Municipio,
    Parcela,
)
from app.services.fira_live import construir_model_insights, generar_parcelas_fira

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_CSV_HEADER = ["ID_parcela", "rendimiento_predicho_ton_ha"]
# Seguridad (B6 - OWASP CSV Injection): prefijos prohibidos en celdas exportables.
_CSV_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


@dataclass(frozen=True, slots=True)
class DatosEstaticos:
    """Contenedor inmutable en memoria con todos los datasets validados."""

    meta: Meta
    parcelas: tuple[Parcela, ...]
    parcelas_por_id: Mapping[str, Parcela]
    municipios: tuple[Municipio, ...]
    modelos: tuple[Modelo, ...]
    anexo_csv: str
    fira_parcels: tuple[BarleyParcel, ...]
    fira_model_insights: ModelInsightsPayload


def _validar_anexo(contenido: str, ids_validos: set[str]) -> None:
    """Valida estructura, correspondencia de IDs y ausencia de fórmulas en anexo.csv."""
    filas = list(csv.reader(io.StringIO(contenido)))
    if not filas or filas[0] != _CSV_HEADER:
        raise ValueError("anexo.csv: cabecera inesperada")
    for fila in filas[1:]:
        if not fila:
            continue
        if len(fila) != 2:
            raise ValueError("anexo.csv: fila con número de columnas inválido")
        if any(celda.startswith(_CSV_FORMULA_PREFIXES) for celda in fila):
            raise ValueError("anexo.csv: celda con posible fórmula ejecutable")
        if fila[0] not in ids_validos:
            raise ValueError(f"anexo.csv: ID de parcela desconocido '{fila[0]}'")
        float(fila[1])


def cargar_datos(data_dir: Path = DATA_DIR) -> DatosEstaticos:
    """Carga, sanea (LFPDPPP) y valida todos los archivos de datos estáticos."""
    meta = TypeAdapter(Meta).validate_json((data_dir / "meta.json").read_bytes())

    raw_parcelas = json.loads((data_dir / "parcelas.json").read_text(encoding="utf-8"))
    if not isinstance(raw_parcelas, list):
        raise ValueError("parcelas.json debe contener una lista JSON")

    parcelas_saneadas = [
        sanitizar_registro_parcela(item, idx) for idx, item in enumerate(raw_parcelas, start=1)
    ]
    parcelas = tuple(TypeAdapter(list[Parcela]).validate_python(parcelas_saneadas))

    municipios = tuple(
        TypeAdapter(list[Municipio]).validate_json((data_dir / "municipios.json").read_bytes())
    )
    modelos = tuple(
        TypeAdapter(list[Modelo]).validate_json((data_dir / "modelos.json").read_bytes())
    )
    anexo = (data_dir / "anexo.csv").read_text(encoding="utf-8")

    por_id = {p.id: p for p in parcelas}
    if len(por_id) != len(parcelas):
        raise ValueError("parcelas.json contiene identificadores duplicados")
    _validar_anexo(anexo, set(por_id))

    fira_parcels = generar_parcelas_fira()
    fira_insights = construir_model_insights()

    return DatosEstaticos(
        meta=meta,
        parcelas=parcelas,
        parcelas_por_id=MappingProxyType(por_id),
        municipios=municipios,
        modelos=modelos,
        anexo_csv=anexo,
        fira_parcels=fira_parcels,
        fira_model_insights=fira_insights,
    )


@lru_cache(maxsize=1)
def obtener_datos_cache() -> DatosEstaticos:
    """Devuelve una instancia cacheada en memoria (fallback si no se usó lifespan)."""
    return cargar_datos()
