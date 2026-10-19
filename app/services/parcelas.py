"""Servicio de dominio para consulta y filtrado de parcelas en memoria."""

from __future__ import annotations

from collections.abc import Iterable

from app.core.errors import AppError, NotFoundError
from app.models.parcela import FiltrosParcelas, Parcela
from app.repositories.datos_estaticos import DatosEstaticos

MAX_FILTER_LEN = 100


def filtrar_parcelas_modelo(
    parcelas: Iterable[Parcela],
    filtros: FiltrosParcelas,
) -> list[Parcela]:
    """Filtra parcelas tipadas por municipio exacto y/o búsqueda en ID o municipio."""
    resultado = list(parcelas)
    if filtros.municipio:
        resultado = [p for p in resultado if p.municipio == filtros.municipio]
    if filtros.q:
        q_lower = filtros.q.lower()
        resultado = [
            p for p in resultado if q_lower in p.id.lower() or q_lower in p.municipio.lower()
        ]
    return resultado


def obtener_parcela_por_id(datos: DatosEstaticos, parcela_id: str) -> Parcela:
    """Obtiene una parcela en O(1) desde memoria o lanza AppError/NotFoundError sin reflejar el input."""
    if len(parcela_id) > MAX_FILTER_LEN:
        # Corrige el bug de origin/back (a68558d) donde HTTPException anidaba detail.error
        raise AppError(
            status_code=400,
            code="id_invalido",
            message="Identificador demasiado largo",
        )
    parcela = datos.parcelas_por_id.get(parcela_id)
    if parcela is None:
        # Seguridad (B2): no reflejar el identificador suministrado por el cliente.
        raise NotFoundError("No existe una parcela con el identificador solicitado.")
    return parcela
