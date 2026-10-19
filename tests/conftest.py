"""Fixtures compartidas para pruebas de contrato, regresiones y seguridad AppSec."""

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from main import create_app


def build_test_settings(**overrides: Any) -> Settings:
    """Construye una instancia aislada de Settings para pruebas."""
    defaults: dict[str, Any] = {
        "ENVIRONMENT": "development",
        "DEBUG": False,
        "CORS_ORIGINS": ["http://localhost:5173"],
        "ALLOWED_HOSTS": ["testserver", "localhost", "127.0.0.1"],
        "RATE_LIMIT_ENABLED": False,
        "HSTS_ENABLED": True,
    }
    defaults.update(overrides)
    return Settings(_env_file=None, **defaults)


@pytest.fixture
def client() -> Iterator[TestClient]:
    """Cliente de pruebas con lifespan activo y captura de errores 500."""
    test_app = create_app(build_test_settings())
    with TestClient(test_app, raise_server_exceptions=False) as test_client:
        yield test_client
