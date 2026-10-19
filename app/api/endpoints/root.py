"""Endpoints auxiliares de conectividad de la API."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/ping", tags=["root"], summary="Comprobación rápida de conectividad")
async def ping() -> dict[str, str]:
    """Endpoint simple de comprobación de conectividad."""
    return {"ping": "pong"}
