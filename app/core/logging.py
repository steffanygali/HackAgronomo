"""Configuración de logging estructurado para auditoría y diagnóstico interno."""

import logging


def configure_logging(level: str = "INFO") -> None:
    """Inicializa el formato de logs sin exponer datos sensibles."""
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    logging.basicConfig(
        level=numeric_level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
