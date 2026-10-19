"""Pruebas de los endpoints interactivos FIRA (Fase 3B: /api/parcels, /api/model-insights, POST /api/predict)."""

from __future__ import annotations

import re

from fastapi.testclient import TestClient

_PATRON_SEUDONIMO = re.compile(r"^Productor P-(HGO|TLX|PUE)-\d{3}$")


def test_get_api_parcels_devuelve_197_con_sublotes_y_productores_seudonimizados(
    client: TestClient,
) -> None:
    """Verifica 197 parcelas (138 train, 59 eval), 3 sub-lotes A/B/C y privacidad LFPDPPP."""
    res = client.get("/api/parcels")
    assert res.status_code == 200
    parcels = res.json()
    assert len(parcels) == 197

    n_train = sum(1 for p in parcels if p["split"] == "train")
    n_eval = sum(1 for p in parcels if p["split"] == "eval")
    assert n_train == 138
    assert n_eval == 59

    for parcel in parcels:
        # Ningún apellido real expuesto (LFPDPPP)
        assert _PATRON_SEUDONIMO.match(parcel["producerName"]), parcel["producerName"]
        # 3 sub-lotes (Lote A, Lote B, Lote C) y 6 fechas de evaluación satelital
        assert [s["code"] for s in parcel["subDivisions"]] == [
            "Lote A",
            "Lote B",
            "Lote C",
        ]
        assert len(parcel["evaluations"]) == 6


def test_get_api_model_insights(client: TestClient) -> None:
    """Verifica la estructura de métricas y las 3 preguntas guía FIRA."""
    res = client.get("/api/model-insights")
    assert res.status_code == 200
    body = res.json()
    assert len(body["metrics"]) == 5
    assert any(m["isSelected"] for m in body["metrics"])
    assert len(body["guideQuestion1_VegetationIndices"]) == 4
    assert len(body["guideQuestion2_ClimateVariables"]) == 4
    assert len(body["guideQuestion3_FeatureCombinations"]) == 4


def test_post_api_predict_valido_y_rechaza_mass_assignment(client: TestClient) -> None:
    """Verifica inferencia en vivo y bloqueo de campos no permitidos (OWASP API3:2023)."""
    payload_valido = {
        "state": "Hidalgo",
        "altitudeM": 2480,
        "regime": "Temporal",
        "ndviEspigado": 0.76,
        "ndwiLlenado": 0.28,
        "eviEncanado": 0.52,
        "precipJulAgoMm": 240,
        "tempMinSepC": 6.8,
        "gddTotal": 1420,
    }
    res_ok = client.post("/api/predict", json=payload_valido)
    assert res_ok.status_code == 200
    pred = res_ok.json()
    assert pred["source"] == "backend"
    assert 1.5 <= pred["predictedYieldTonHa"] <= 6.6
    assert len(pred["confidenceInterval"]) == 2
    assert pred["riskLevel"] in {"Bajo", "Moderado", "Alto"}

    # Mass assignment (campo inesperado) debe ser rechazado con 422
    payload_intruso = {**payload_valido, "isAdmin": True}
    res_bad = client.post("/api/predict", json=payload_intruso)
    assert res_bad.status_code == 422
    assert res_bad.json()["error"]["code"] == "validacion"
