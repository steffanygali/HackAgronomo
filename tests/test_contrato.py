"""Pruebas de contrato público, no-regresión y precisión geográfica (Fases 0–3)."""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.data.loader import cargar_parcelas, filtrar_parcelas
from app.models import Meta, Modelo, Municipio, Parcela
from app.models.parcela import FiltrosParcelas

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def test_rutas_publicas_presentes_en_openapi(client: TestClient) -> None:
    """Verifica que ninguna ruta pública del contrato original se haya roto."""
    res = client.get("/openapi.json")
    assert res.status_code == 200
    paths = res.json()["paths"]
    rutas_esperadas = {
        "/",
        "/health",
        "/api/v1/meta",
        "/api/v1/parcelas",
        "/api/v1/parcelas/{parcela_id}",
        "/api/v1/municipios",
        "/api/v1/modelos",
        "/api/v1/export/anexo.csv",
        "/api/anexo-fira.csv",
        "/api/export-eval-csv",
        "/api/parcels",
        "/api/model-insights",
        "/api/predict",
    }
    assert rutas_esperadas.issubset(set(paths.keys()))


def test_root_y_health_conservan_contrato(client: TestClient) -> None:
    """Verifica payloads de / y /health."""
    r_root = client.get("/")
    assert r_root.status_code == 200
    assert r_root.json() == {
        "mensaje": "Bienvenido al Back HackAgronomo",
        "estado": "activo",
        "api_base": "/api/v1",
        "documentacion": "/docs",
    }

    r_health = client.get("/health")
    assert r_health.status_code == 200
    assert r_health.json() == {"status": "ok"}


def test_parcelas_corrige_bug_h2_y_preserva_precision_coordenadas(
    client: TestClient,
) -> None:
    """Corrige H2 (antes devolvía []) y verifica que lat/lon NO se redondeen (Pregunta 3)."""
    esperadas = json.loads((DATA_DIR / "parcelas.json").read_text(encoding="utf-8"))
    res = client.get("/api/v1/parcelas")
    assert res.status_code == 200
    obtenidas = res.json()
    assert len(obtenidas) == len(esperadas) == 59

    for orig, api_item in zip(esperadas, obtenidas, strict=True):
        Parcela.model_validate(api_item)
        # MapLibre GL requiere la precisión decimal intacta (~0.1–1 m).
        assert api_item["lat"] == orig["lat"]
        assert api_item["lon"] == orig["lon"]


def test_filtros_parcelas_municipio_y_q(client: TestClient) -> None:
    """Verifica el filtrado por municipio exacto y búsqueda insensible a mayúsculas."""
    res_muni = client.get("/api/v1/parcelas", params={"municipio": "Singuilucan"})
    assert res_muni.status_code == 200
    datos_muni = res_muni.json()
    assert len(datos_muni) > 0
    assert all(p["municipio"] == "Singuilucan" for p in datos_muni)

    res_q = client.get("/api/v1/parcelas", params={"q": "agc_003"})
    assert res_q.status_code == 200
    datos_q = res_q.json()
    assert [p["id"] for p in datos_q] == ["AGC_003"]


def test_loader_retrocompatible_con_filtros_parcelas() -> None:
    """Garantiza que app.data.loader.filtrar_parcelas soporte FiltrosParcelas y (municipio, q)."""
    raw = cargar_parcelas()
    con_modelo = filtrar_parcelas(raw, FiltrosParcelas(municipio="Singuilucan", q="AGC_003"))
    con_args = filtrar_parcelas(raw, municipio="Singuilucan", q="AGC_003")
    assert len(con_modelo) == 1
    assert con_modelo == con_args


def test_parcela_detalle_200_y_404_con_sobre_error(client: TestClient) -> None:
    """Verifica GET /api/v1/parcelas/{id} existente e inexistente."""
    r_ok = client.get("/api/v1/parcelas/AGC_003")
    assert r_ok.status_code == 200
    assert r_ok.json()["id"] == "AGC_003"

    r_404 = client.get("/api/v1/parcelas/NO_EXISTE_999")
    assert r_404.status_code == 404
    body = r_404.json()
    assert body["error"]["code"] == "no_encontrada"


def test_meta_modelos_municipios_validan_esquema(client: TestClient) -> None:
    """Verifica que /meta, /modelos y /municipios respeten sus esquemas Pydantic."""
    r_meta = client.get("/api/v1/meta")
    assert r_meta.status_code == 200
    Meta.model_validate(r_meta.json())

    r_modelos = client.get("/api/v1/modelos")
    assert r_modelos.status_code == 200
    modelos = [Modelo.model_validate(m) for m in r_modelos.json()]
    assert len(modelos) > 0

    r_munis = client.get("/api/v1/municipios")
    assert r_munis.status_code == 200
    munis = [Municipio.model_validate(m) for m in r_munis.json()]
    assert len(munis) > 0


def test_anexo_csv_headers_oficiales_y_alias(client: TestClient) -> None:
    """Verifica text/csv, Content-Disposition y las 3 rutas de descarga (Pregunta 4)."""
    rutas_csv = [
        "/api/v1/export/anexo.csv",
        "/api/anexo-fira.csv",
        "/api/export-eval-csv",
    ]
    for ruta in rutas_csv:
        res = client.get(ruta)
        assert res.status_code == 200
        assert res.headers["content-type"] == "text/csv; charset=utf-8"
        assert (
            res.headers["content-disposition"]
            == 'attachment; filename="predicciones_evaluacion_30_fira.csv"'
        )
        filas = list(csv.reader(io.StringIO(res.text)))
        assert filas[0] == ["ID_parcela", "rendimiento_predicho_ton_ha"]
        assert len(filas) - 1 == 59
