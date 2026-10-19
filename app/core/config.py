"""Configuración centralizada de la aplicación usando pydantic-settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Ajustes de la aplicación. Se leen de variables de entorno o .env."""

    APP_NAME: str = "Back HackAgronomo"
    DEBUG: bool = False
    API_V1_STR: str = "/api/v1"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
