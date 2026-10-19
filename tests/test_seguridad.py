"""Pruebas de seguridad de aplicaciones (AppSec) y privacidad LFPDPPP."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_datos
from app.core.privacy import sanitizar_registro_parcela, seudonimizar_productor
from app.repositories.datos_estaticos import DATA_DIR, cargar_datos
from main import create_app
from tests.conftest import build_test_settings


def test_privacidad_lfpdppp_seudonimiza_productor_y_elimina_telefono() -> None:
    """Verifica cumplimiento LFPDPPP: seudónimos P-XXX-NNN y eliminación de teléfonos."""
    assert seudonimizar_productor("AGC_003", "Hidalgo") == "Productor P-HGO-003"
    assert seudonimizar_productor("P-TLX-077", "Tlaxcala") == "Productor P-TLX-077"

    registro_crudo = {
        "id": "P-HGO-005",
        "state": "Hidalgo",
        "producerName": "Hernández Morales",
        "telefono": "771-123-4567",
        "phone": "+52 55 1234 5678",
        "email": "productor@ejemplo.mx",
        "lat": 19.98137239099777,
        "lon": -98.3749956660925,
    }
    limpio = sanitizar_registro_parcela(registro_crudo, indice=5)
    assert limpio["producerName"] == "Productor P-HGO-005"
    assert "telefono" not in limpio
    assert "phone" not in limpio
    assert "email" not in limpio
    # Coordenadas intactas (sin redondear)
    assert limpio["lat"] == 19.98137239099777
    assert limpio["lon"] == -98.3749956660925


def test_privacidad_rechaza_telefono_o_email_infiltrado_en_texto() -> None:
    """Si un teléfono de 10 dígitos o email se filtra en otro campo, falla en carga."""
    with pytest.raises(ValueError, match="PII sensible"):
        sanitizar_registro_parcela(
            {"id": "AGC_001", "municipio": "Apan tel 7712345678"},
            indice=1,
        )

    with pytest.raises(ValueError, match="PII sensible"):
        sanitizar_registro_parcela(
            {"id": "AGC_001", "municipio": "contacto Juan@agro.mx"},
            indice=1,
        )


def test_cors_bloquea_origen_no_autorizado_y_deshabilita_credenciales(
    client: TestClient,
) -> None:
    """Corrige H1: un origen malicioso no recibe Access-Control-Allow-Origin."""
    r_evil = client.get("/api/v1/meta", headers={"Origin": "https://evil.attacker.com"})
    assert r_evil.status_code == 200
    assert "access-control-allow-origin" not in r_evil.headers
    assert "access-control-allow-credentials" not in r_evil.headers

    r_ok = client.get("/api/v1/meta", headers={"Origin": "http://localhost:5173"})
    assert r_ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "access-control-allow-credentials" not in r_ok.headers
    assert "Content-Disposition" in r_ok.headers.get("access-control-expose-headers", "")


def test_cabeceras_de_seguridad_http_presentes(client: TestClient) -> None:
    """Verifica M4: nosniff, X-Frame-Options, Referrer-Policy, CSP, HSTS y X-Request-ID."""
    res = client.get("/api/v1/meta")
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"
    assert res.headers["referrer-policy"] == "no-referrer"
    assert "default-src 'none'" in res.headers["content-security-policy"]
    assert "max-age=31536000" in res.headers["strict-transport-security"]
    assert len(res.headers["x-request-id"]) >= 8


def test_error_500_no_filtra_rutas_ni_detalles_internos() -> None:
    """Verifica M1: los errores 500 devuelven un mensaje genérico sin exponer str(exc)."""
    app = create_app(build_test_settings())

    def _fallo_interno() -> None:
        raise FileNotFoundError("/mnt/secreto/privado/data/meta.json")

    app.dependency_overrides[get_datos] = _fallo_interno
    with TestClient(app, raise_server_exceptions=False) as c:
        res = c.get("/api/v1/meta")

    assert res.status_code == 500
    assert res.json() == {
        "error": {
            "code": "error_interno",
            "message": "Error interno del servidor.",
        }
    }
    assert "/mnt/secreto" not in res.text
    assert res.headers["x-content-type-options"] == "nosniff"


def test_404_y_422_no_reflejan_payload_malicioso(client: TestClient) -> None:
    """Verifica B1 y B2: no reflejar payloads XSS en 404 ni en errores 422."""
    xss_payload = "<script>alert(1)</script>"
    r_404 = client.get(f"/api/v1/parcelas/{xss_payload}")
    assert r_404.status_code == 404
    assert xss_payload not in r_404.text

    r_422 = client.get("/api/v1/parcelas", params={"q": "X" * 150})
    assert r_422.status_code == 422
    assert r_422.json()["error"]["code"] == "validacion"
    assert "XXXX" not in r_422.text


def test_parcela_id_demasiado_largo_400_sin_anidar_detail(client: TestClient) -> None:
    """Corrige bug de origin/back (a68558d): 400 devuelve {error:{code,message}} sin anidar en detail."""
    r_400 = client.get(f"/api/v1/parcelas/{'A' * 105}")
    assert r_400.status_code == 400
    assert r_400.json() == {
        "error": {
            "code": "id_invalido",
            "message": "Identificador demasiado largo",
        }
    }


def test_loader_cache_defensiva_no_permite_corrupcion_en_memoria() -> None:
    """Corrige vulnerabilidad de origin/back (a68558d): mutar el retorno de loader no corrompe _cache."""
    from app.data.loader import cargar_meta, cargar_parcelas

    parcelas_1 = cargar_parcelas()
    parcelas_1.clear()
    parcelas_2 = cargar_parcelas()
    assert len(parcelas_2) == 59

    meta_1 = cargar_meta()
    meta_1["modelo"] = "CORROMPIDO"
    meta_2 = cargar_meta()
    assert meta_2["modelo"] != "CORROMPIDO"


def test_trusted_host_bloquea_host_header_injection(client: TestClient) -> None:
    """Verifica M5: solicitudes con Host no autorizado reciben HTTP 400."""
    res = client.get("/health", headers={"Host": "evil.attacker.com"})
    assert res.status_code == 400


def test_rate_limiting_bloquea_abuso_con_429() -> None:
    """Verifica M3 (OWASP API4:2023): devuelve 429 al superar el umbral por minuto."""
    app = create_app(
        build_test_settings(
            RATE_LIMIT_ENABLED=True,
            RATE_LIMIT_PER_MINUTE=3,
        )
    )
    with TestClient(app) as c:
        codigos = [c.get("/api/v1/meta").status_code for _ in range(4)]

    assert codigos[:3] == [200, 200, 200]
    assert codigos[3] == 429


def test_payload_excesivo_rechazado_con_413() -> None:
    """Verifica M3: rechaza solicitudes cuyo cuerpo supere MAX_BODY_BYTES."""
    app = create_app(build_test_settings(MAX_BODY_BYTES=128))
    with TestClient(app) as c:
        res = c.post(
            "/api/predict",
            content="{" + ('"a":1,' * 50) + '"b":2}',
            headers={"Content-Type": "application/json"},
        )
    assert res.status_code == 413
    assert res.json()["error"]["code"] == "payload_demasiado_grande"


def test_request_id_con_crlf_es_reemplazado(client: TestClient) -> None:
    """Verifica M2: impide inyección de cabeceras o logs mediante X-Request-ID."""
    malicioso = "id-valido\r\nX-Injected: pwned"
    res = client.get("/health", headers={"X-Request-ID": malicioso})
    assert res.headers["x-request-id"] != malicioso


def test_repositorio_rechaza_csv_injection_e_ids_duplicados(tmp_path: Path) -> None:
    """Verifica B6: falla en arranque si anexo.csv contiene fórmulas (=, +, -, @)."""
    for nombre in ("meta.json", "parcelas.json", "municipios.json", "modelos.json", "anexo.csv"):
        shutil.copy(DATA_DIR / nombre, tmp_path / nombre)

    (tmp_path / "anexo.csv").write_text(
        "ID_parcela,rendimiento_predicho_ton_ha\n=CMD|' /C calc'!A0,3.27\n",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="fórmula"):
        cargar_datos(tmp_path)

    # Verifica también rechazo de IDs duplicados en parcelas.json
    shutil.copy(DATA_DIR / "anexo.csv", tmp_path / "anexo.csv")
    parcelas_raw = json.loads((tmp_path / "parcelas.json").read_text(encoding="utf-8"))
    parcelas_raw[1]["id"] = parcelas_raw[0]["id"]
    (tmp_path / "parcelas.json").write_text(json.dumps(parcelas_raw), encoding="utf-8")
    with pytest.raises(ValueError, match="duplicados"):
        cargar_datos(tmp_path)
