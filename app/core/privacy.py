"""Controles de privacidad (LFPDPPP): seudonimización de productores y detección de PII.

Las coordenadas geográficas (lat/lon, center, polygon) NO se alteran ni redondean
porque MapLibre GL requiere precisión de 5–6+ decimales (~0.1 a 1 m) para dibujar
los polígonos y las 3 franjas de sub-lotes (Lote A, Lote B, Lote C).
En cambio, nombres y teléfonos de productores nunca deben exponerse (OWASP API3:2023).
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

# Campos de contacto/identidad que jamás deben viajar en respuestas de la API.
CAMPOS_PII_PROHIBIDOS: frozenset[str] = frozenset(
    {
        "telefono",
        "teléfono",
        "phone",
        "celular",
        "movil",
        "móvil",
        "email",
        "correo",
        "curp",
        "rfc",
        "direccion",
        "dirección",
        "domicilio",
        "contacto",
    }
)

_ESTADO_PREFIJO: Mapping[str, str] = {
    "hidalgo": "HGO",
    "hgo": "HGO",
    "tlaxcala": "TLX",
    "tlx": "TLX",
    "puebla": "PUE",
    "pue": "PUE",
}

# Detecta teléfonos de 10 dígitos (con o sin +52 / espacios / guiones) o emails en texto.
_PATRON_TELEFONO = re.compile(
    r"(?<!\d)(?:\+?52[\s\-]?)?(?:\d{2}[\s\-]\d{4}[\s\-]\d{4}|\d{3}[\s\-]\d{3}[\s\-]\d{4}|\d{10})(?!\d)"
)
_PATRON_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PATRON_SEUDONIMO = re.compile(r"^Productor P-[A-Z]{3}-\d{3,}$")
_PATRON_PREFIJO_ID = re.compile(r"^P-([A-Z]{3})-(\d+)$")


def seudonimizar_productor(
    parcela_id: str,
    estado: str | None = None,
    indice_fallback: int = 1,
) -> str:
    """Genera un identificador seudonimizado determinista: 'Productor P-HGO-001'."""
    match_id = _PATRON_PREFIJO_ID.match(parcela_id.strip())
    if match_id:
        prefijo_id, num_str = match_id.groups()
        return f"Productor P-{prefijo_id}-{int(num_str):03d}"

    prefijo = _ESTADO_PREFIJO.get((estado or "").strip().lower(), "HGO")
    digitos = "".join(ch for ch in parcela_id if ch.isdigit())
    numero = int(digitos) if digitos else indice_fallback
    return f"Productor P-{prefijo}-{numero:03d}"


def sanitizar_registro_parcela(raw: Mapping[str, Any], indice: int = 1) -> dict[str, Any]:
    """Elimina campos PII prohibidos y seudonimiza el nombre del productor si existe."""
    limpio: dict[str, Any] = {
        k: v for k, v in raw.items() if k.lower() not in CAMPOS_PII_PROHIBIDOS
    }
    parcela_id = str(limpio.get("id", f"AGC_{indice:03d}"))
    estado = str(limpio.get("state") or limpio.get("estado") or "Hidalgo")

    for campo_nombre in ("producerName", "nombre_productor", "productor"):
        if campo_nombre in limpio and limpio[campo_nombre] is not None:
            valor = str(limpio[campo_nombre]).strip()
            if not _PATRON_SEUDONIMO.match(valor):
                limpio[campo_nombre] = seudonimizar_productor(parcela_id, estado, indice)

    for clave, valor in limpio.items():
        if isinstance(valor, str) and (
            _PATRON_TELEFONO.search(valor) or _PATRON_EMAIL.search(valor)
        ):
            raise ValueError(
                f"PII sensible (teléfono/email) detectada en el campo '{clave}' de '{parcela_id}'"
            )

    return limpio
