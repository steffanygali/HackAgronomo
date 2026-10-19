"""Configuración centralizada de la aplicación usando pydantic-settings.

Segura por defecto: asume entorno de producción con ``DEBUG=False`` salvo que se
indique explícitamente lo contrario mediante variables de entorno o ``.env``.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Ajustes de la aplicación leídos de variables de entorno o archivo .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Back HackAgronomo"
    # Seguridad (OWASP A05:2021): producción y DEBUG=False por defecto.
    ENVIRONMENT: Literal["development", "production"] = "production"
    DEBUG: bool = False
    API_V1_STR: str = "/api/v1"
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # Seguridad (H1 - OWASP API8:2023): lista blanca de orígenes; nunca "*" con credenciales.
    CORS_ORIGINS: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://localhost:8080",
        ]
    )
    # Seguridad (M5): validación del header Host contra Host Header Injection.
    ALLOWED_HOSTS: list[str] = Field(
        default_factory=lambda: ["localhost", "127.0.0.1", "testserver"]
    )

    DOCS_ENABLED: bool = True
    HSTS_ENABLED: bool = False
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 120
    PREDICT_RATE_LIMIT_PER_MINUTE: int = 30
    MAX_BODY_BYTES: int = 8_192  # Seguridad (M3 - OWASP API4:2023): máx. 8 KB de body
    FORWARDED_ALLOW_IPS: str = "127.0.0.1"
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    @property
    def is_development(self) -> bool:
        """Indica si la aplicación corre en modo desarrollo."""
        return self.ENVIRONMENT == "development"


@lru_cache
def get_settings() -> Settings:
    """Devuelve una instancia cacheada de la configuración."""
    return Settings()


settings = get_settings()
