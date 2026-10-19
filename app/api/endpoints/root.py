"""Endpoints raíz de la API."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/ping", tags=["root"])
async def ping():
    """Endpoint simple de comprobación de conectividad."""
    return {"ping": "pong"}
