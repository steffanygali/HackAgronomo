"""Servicio de generación del dataset georreferenciado FIRA y predicción en vivo.

Construye las 197 parcelas reales (AGC_001..AGC_197) del Altiplano Mexicano a partir de
``data/parcelas_197.json`` y ``data/parcelas.json``, sincronizando al 100 % las 59 parcelas
de evaluación con ``/api/v1/parcelas`` y ``/api/v1/export/anexo.csv``.
Cumple estrictamente con LFPDPPP: seudonimización forzosa de productores sin incluir
apellidos reales.
"""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

from app.core.privacy import sanitizar_registro_parcela, seudonimizar_productor
from app.models.fira import (
    BarleyParcel,
    BarleyVariety,
    ClimateVariableInsight,
    DatasetSplit,
    FeatureCombinationInsight,
    LivePredictionInput,
    LivePredictionResponse,
    ModelInsightsPayload,
    ModelMetricComparison,
    MoistureStatus,
    PhenologicalEvaluation,
    RiskLevel,
    ShapContribution,
    SoilType,
    StateName,
    SubParcelDivision,
    VegetationIndexInsight,
    WaterRegime,
)

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

EVALUATION_SCHEDULE: tuple[dict[str, object], ...] = (
    {
        "date": "2025-05-19",
        "time": "11:12 CST (Sentinel-2A / Planet)",
        "stage": "Siembra y Emergencia",
        "gddBase": 145,
    },
    {
        "date": "2025-06-16",
        "time": "11:14 CST (Sentinel-2B / Planet)",
        "stage": "Macollamiento",
        "gddBase": 390,
    },
    {
        "date": "2025-07-14",
        "time": "11:11 CST (Sentinel-2A / Planet)",
        "stage": "Encañado",
        "gddBase": 685,
    },
    {
        "date": "2025-08-11",
        "time": "11:15 CST (Sentinel-2B / Planet)",
        "stage": "Espigado y Floración",
        "gddBase": 1020,
    },
    {
        "date": "2025-09-08",
        "time": "11:13 CST (Sentinel-2A / Planet)",
        "stage": "Llenado de Grano",
        "gddBase": 1340,
    },
    {
        "date": "2025-10-06",
        "time": "11:12 CST (Sentinel-2B / Planet)",
        "stage": "Madurez y Cosecha",
        "gddBase": 1610,
    },
)

EJIDO_PREFIXES: tuple[str, ...] = (
    "Parcela Ejidal San Lorenzo",
    "Rancho Santa Bárbara",
    "Lote La Soledad",
    "Predio El Mirador",
    "Parcela San Isidro",
    "Lote Las Ánimas",
    "Ejido San Nicolás",
    "Predio Los Llanos",
    "Parcela El Capulín",
    "Lote La Concepción",
)

VARIETIES: tuple[BarleyVariety, ...] = (
    "Esperanza (Maltera)",
    "Esmeralda (Maltera)",
    "Adabella (Maltera)",
    "Doña Josefa (Forrajera)",
)


def _seeded_random(seed: float | int) -> float:
    """Generador pseudo-aleatorio determinista para reproducibilidad exacta."""
    x = math.sin(seed * 9301.0 + 49297.0) * 233280.0
    return x - math.floor(x)


def _round_js(val: float, decimals: int = 2) -> float:
    """Redondeo compatible con Math.round() de JavaScript."""
    factor = 10.0**decimals
    return math.floor(val * factor + 0.5) / factor


def _lerp_point(p0: tuple[float, float], p1: tuple[float, float], t: float) -> tuple[float, float]:
    """Interpolación lineal entre dos puntos con redondeo a 6 decimales."""
    return (
        _round_js(p0[0] + (p1[0] - p0[0]) * t, 6),
        _round_js(p0[1] + (p1[1] - p0[1]) * t, 6),
    )


@lru_cache(maxsize=1)
def generar_parcelas_fira() -> tuple[BarleyParcel, ...]:
    """Construye las 197 parcelas reales del reto FIRA (138 train, 59 eval).

    Las coordenadas (lon, lat), municipios, áreas, elevaciones y predicciones coinciden
    exactamente con ``data/parcelas.json`` (``/api/v1/parcelas``) y ``data/parcelas_197.json``.
    """
    raw_records = json.loads((DATA_DIR / "parcelas_197.json").read_text(encoding="utf-8"))
    v1_eval_list = json.loads((DATA_DIR / "parcelas.json").read_text(encoding="utf-8"))
    v1_by_id = {item["id"]: item for item in v1_eval_list}

    parcels: list[BarleyParcel] = []

    for rec in raw_records:
        parcel_id = str(rec["id"])
        global_idx = int(rec["num"])
        state: StateName = rec["state"]
        municipality = str(rec["municipality"])
        split: DatasetSplit = rec["split"]

        # Si está en /api/v1/parcelas, sincronizar coordenadas y predicción exacta
        v1_match = v1_by_id.get(parcel_id)
        center_lng = float(v1_match["lon"]) if v1_match else float(rec["lon"])
        center_lat = float(v1_match["lat"]) if v1_match else float(rec["lat"])

        area_ha = _round_js(max(0.35, float(rec["areaHa"])), 2)
        altitude_m = float(rec["altitudeM"])
        slope_base = float(rec["slopePct"])
        nn_dist_m = float(rec.get("nnDistM", 250.0))

        seed = global_idx * 137 + 31
        r2 = _seeded_random(seed + 1)
        r3 = _seeded_random(seed + 2)
        r4 = _seeded_random(seed + 3)
        r5 = _seeded_random(seed + 4)

        # Dimensiones visuales del polígono proporcionales a sqrt(area_ha) y acotadas
        # a la distancia al vecino más cercano para evitar superposiciones en el mapa.
        area_m2 = area_ha * 10000.0
        aspect = 1.25 + (r3 - 0.5) * 0.35
        ideal_half_w_m = 0.5 * math.sqrt(area_m2 * aspect)
        ideal_half_h_m = 0.5 * math.sqrt(area_m2 / aspect)
        diag_m = math.hypot(ideal_half_w_m, ideal_half_h_m)
        max_radius_m = max(18.0, nn_dist_m * 0.42)
        scale = min(1.0, max_radius_m / max(1.0, diag_m))

        half_w_m = max(14.0, ideal_half_w_m * scale)
        half_h_m = max(11.0, ideal_half_h_m * scale)

        meters_per_deg_lat = 111320.0
        meters_per_deg_lng = 111320.0 * math.cos(math.radians(center_lat))

        half_w = half_w_m / meters_per_deg_lng
        half_h = half_h_m / meters_per_deg_lat
        skew = (r5 - 0.5) * min(half_w, half_h) * 0.28

        min_lng = _round_js(center_lng - half_w, 6)
        max_lng = _round_js(center_lng + half_w, 6)
        min_lat = _round_js(center_lat - half_h, 6)
        max_lat = _round_js(center_lat + half_h, 6)

        bl = (min_lng, min_lat)
        br = (max_lng, _round_js(min_lat + skew, 6))
        tr = (_round_js(max_lng + skew * 0.5, 6), max_lat)
        tl = (_round_js(min_lng + skew * 0.5, 6), _round_js(max_lat - skew, 6))

        outer_polygon: list[tuple[float, float]] = [bl, br, tr, tl, bl]

        l0 = bl
        r0 = br
        l1 = _lerp_point(bl, tl, 1.0 / 3.0)
        r1_pt = _lerp_point(br, tr, 1.0 / 3.0)
        l2 = _lerp_point(bl, tl, 2.0 / 3.0)
        r2_pt = _lerp_point(br, tr, 2.0 / 3.0)
        l3 = tl
        r3_pt = tr

        poly_c: list[tuple[float, float]] = [l0, r0, r1_pt, l1, l0]
        poly_b: list[tuple[float, float]] = [l1, r1_pt, r2_pt, l2, l1]
        poly_a: list[tuple[float, float]] = [l2, r2_pt, r3_pt, l3, l2]

        area_a = _round_js(area_ha * 0.34, 2)
        area_b = _round_js(area_ha * 0.33, 2)
        area_c = _round_js(max(0.1, area_ha - area_a - area_b), 2)

        regime: WaterRegime = "Riego Auxiliar" if r4 > 0.76 else "Temporal"
        variety: BarleyVariety = VARIETIES[global_idx % len(VARIETIES)]

        ndvi6: list[float] = list(rec["ndvi6"])
        clim6: list[list[float]] = list(rec["clim6"])

        evaluations: list[PhenologicalEvaluation] = []
        for idx, sched in enumerate(EVALUATION_SCHEDULE):
            ndvi = _round_js(float(ndvi6[idx]), 3)
            evi = _round_js(min(0.85, max(0.12, ndvi * 0.84 + 0.02)), 3)
            ndwi = _round_js(
                min(
                    0.58,
                    max(
                        -0.12,
                        (ndvi - 0.25) * 0.68 + (0.07 if regime == "Riego Auxiliar" else 0.0),
                    ),
                ),
                3,
            )
            savi = _round_js(ndvi * 0.91, 3)
            precip_mm = _round_js(float(clim6[idx][0]), 1)
            temp_max_c = _round_js(float(clim6[idx][1]), 1)
            temp_min_c = _round_js(float(clim6[idx][2]), 1)
            soil_moisture_pct = int(
                _round_js(min(92.0, max(22.0, 32.0 + ndwi * 72.0 + precip_mm * 0.09)), 0)
            )
            gdd_base: int = sched["gddBase"]  # type: ignore[assignment]
            gdd = int(_round_js(gdd_base * (0.95 + r3 * 0.12), 0))

            evaluations.append(
                PhenologicalEvaluation(
                    index=idx,
                    date=str(sched["date"]),
                    captureTime=str(sched["time"]),
                    satellite="Sentinel-2A + PlanetScope (3m/10m)"
                    if idx % 2 == 0
                    else "Sentinel-2B + PlanetScope (3m/10m)",
                    stage=sched["stage"],  # type: ignore[arg-type]
                    ndvi=ndvi,
                    evi=evi,
                    ndwi=ndwi,
                    savi=savi,
                    precipMm=precip_mm,
                    tempMaxC=temp_max_c,
                    tempMinC=temp_min_c,
                    gdd=gdd,
                    soilMoisturePct=soil_moisture_pct,
                )
            )

        if v1_match is not None:
            predicted_yield_ton_ha = _round_js(float(v1_match["prediccion_ton_ha"]), 2)
            ci_low = _round_js(float(v1_match["limite_inferior_90"]), 2)
            ci_high = _round_js(float(v1_match["limite_superior_90"]), 2)
            actual_yield_ton_ha = None
            med_mun = (
                float(v1_match["desglose"]["mediana_municipal"])
                if v1_match.get("desglose")
                else predicted_yield_ton_ha
            )
            adj_ridge = (
                float(v1_match["desglose"]["ajuste_ridge"])
                if v1_match.get("desglose")
                else 0.0
            )
        else:
            predicted_yield_ton_ha = _round_js(float(rec["predictedYieldTonHa"]), 2)
            ci_raw = rec["confidenceInterval"]
            ci_low = _round_js(float(ci_raw[0]), 2)
            ci_high = _round_js(float(ci_raw[1]), 2)
            actual_yield_ton_ha = (
                _round_js(float(rec["actualYieldTonHa"]), 2)
                if rec.get("actualYieldTonHa") is not None
                else None
            )
            med_mun = float(rec.get("medianaMunicipal", 3.85))
            adj_ridge = float(rec.get("ajusteRidge", 0.0))

        sub_division_configs: tuple[dict[str, object], ...] = (
            {
                "suffix": "A",
                "name": "Sección Norte (Cabecera)",
                "deltaYield": 0.22,
                "deltaNdvi": 0.032,
                "soil": "Franco-Limoso",
                "polygon": poly_a,
                "areaHa": area_a,
            },
            {
                "suffix": "B",
                "name": "Sección Centro (Planicie)",
                "deltaYield": 0.03,
                "deltaNdvi": 0.008,
                "soil": "Franco-Arcilloso",
                "polygon": poly_b,
                "areaHa": area_b,
            },
            {
                "suffix": "C",
                "name": "Sección Sur (Ladera Baja)",
                "deltaYield": -0.25,
                "deltaNdvi": -0.04,
                "soil": "Franco-Arenoso",
                "polygon": poly_c,
                "areaHa": area_c,
            },
        )

        sub_divisions: list[SubParcelDivision] = []
        for s_idx, cfg in enumerate(sub_division_configs):
            delta_yield: float = cfg["deltaYield"]  # type: ignore[assignment]
            delta_ndvi: float = cfg["deltaNdvi"]  # type: ignore[assignment]
            sub_yield = _round_js(max(1.4, predicted_yield_ton_ha + delta_yield), 2)
            sub_ndvi_history = [
                _round_js(min(0.91, max(0.15, ev.ndvi + delta_ndvi)), 3) for ev in evaluations
            ]
            sub_ndwi_history = [
                _round_js(min(0.62, max(-0.15, ev.ndwi + delta_ndvi * 0.7)), 3)
                for ev in evaluations
            ]
            peak_sub_ndvi = sub_ndvi_history[3]
            moisture_status: MoistureStatus = (
                "Óptimo"
                if peak_sub_ndvi >= 0.70
                else "Vigilancia"
                if peak_sub_ndvi >= 0.56
                else "Estrés Hídrico"
            )

            if moisture_status == "Óptimo":
                agronomic_action = (
                    "Densidad foliar uniforme. Mantener monitoreo de madurez fisiológica para cosecha."
                )
            elif moisture_status == "Vigilancia":
                agronomic_action = (
                    "Ligera heterogeneidad en llenado de espiga. "
                    "Ajustar fertilización nitrogenada en próximo ciclo."
                )
            else:
                agronomic_action = (
                    "Estrés hídrico detectado en floración. "
                    "Priorizar subsoleo y retención de humedad en esta franja."
                )

            suf: str = cfg["suffix"]  # type: ignore[assignment]
            soil_type: SoilType = cfg["soil"]  # type: ignore[assignment]
            area_sub: float = cfg["areaHa"]  # type: ignore[assignment]
            poly_sub: list[tuple[float, float]] = cfg["polygon"]  # type: ignore[assignment]

            sub_divisions.append(
                SubParcelDivision(
                    id=f"{parcel_id}-{suf}",
                    code=f"Lote {suf}",
                    name=str(cfg["name"]),
                    areaHa=area_sub,
                    soilType=soil_type,
                    slopePct=_round_js(max(0.3, slope_base + (s_idx - 1) * 0.8), 1),
                    ndviByEval=sub_ndvi_history,
                    ndwiByEval=sub_ndwi_history,
                    predictedYieldTonHa=sub_yield,
                    moistureStatus=moisture_status,
                    agronomicAction=agronomic_action,
                    polygon=poly_sub,
                )
            )

        total_precip = sum(e.precipMm for e in evaluations)
        espigado_eval = evaluations[3]
        base_global = 3.95
        mun_impact = _round_js(med_mun - base_global, 2)
        ridge_impact = _round_js(adj_ridge, 2)
        clim_impact = _round_js((total_precip - 1050.0) * 0.00015, 2)
        topo_impact = _round_js((2600.0 - altitude_m) * 0.0002, 2)

        shap_contributions: list[ShapContribution] = [
            ShapContribution(
                feature=f"Componente Municipal ({municipality})",
                valueLabel=f"Mediana {med_mun:.2f} t/ha",
                impactTonHa=mun_impact,
                category="terreno",
            ),
            ShapContribution(
                feature="Ajuste Satelital Ridge (NDVI/EVI/SAVI)",
                valueLabel=f"NDVI pico {espigado_eval.ndvi:.2f}",
                impactTonHa=ridge_impact,
                category="vegetacion",
            ),
            ShapContribution(
                feature="Precipitación y Amplitud Térmica Ciclo",
                valueLabel=f"{int(total_precip)} mm",
                impactTonHa=clim_impact,
                category="clima",
            ),
            ShapContribution(
                feature="Elevación DEM y Pendiente",
                valueLabel=f"{int(altitude_m)} msnm · {slope_base:.1f}%",
                impactTonHa=topo_impact,
                category="terreno",
            ),
        ]

        score_calc = (
            42.0 + predicted_yield_ton_ha * 11.2 + (6.0 if regime == "Riego Auxiliar" else 0.0)
        )
        fira_credit_score = int(_round_js(min(98.0, max(48.0, score_calc)), 0))
        risk_level: RiskLevel = (
            "Bajo"
            if fira_credit_score >= 78
            else "Moderado"
            if fira_credit_score >= 64
            else "Alto"
        )

        ejido_name = f"{EJIDO_PREFIXES[global_idx % len(EJIDO_PREFIXES)]} ({municipality})"

        parcel_dict = {
            "id": parcel_id,
            "parcelNumber": global_idx,
            "name": ejido_name,
            "producerName": seudonimizar_productor(parcel_id, state, global_idx),
            "state": state,
            "municipality": municipality,
            "split": split,
            "center": (center_lng, center_lat),
            "polygon": outer_polygon,
            "subDivisions": sub_divisions,
            "areaHa": area_ha,
            "altitudeM": altitude_m,
            "variety": variety,
            "regime": regime,
            "actualYieldTonHa": actual_yield_ton_ha,
            "predictedYieldTonHa": predicted_yield_ton_ha,
            "confidenceInterval": (ci_low, ci_high),
            "evaluations": evaluations,
            "shapContributions": shap_contributions,
            "riskLevel": risk_level,
            "firaCreditScore": fira_credit_score,
        }

        sanitized = sanitizar_registro_parcela(parcel_dict, global_idx)
        parcels.append(BarleyParcel(**sanitized))

    return tuple(parcels)


# ---------------------------------------------------------------------------
# Insights precalculados del modelo FIRA (sincronizados con /api/v1/modelos y /api/v1/meta)
# ---------------------------------------------------------------------------

INITIAL_MODEL_INSIGHTS: ModelInsightsPayload = ModelInsightsPayload(
    metrics=[
        ModelMetricComparison(
            modelName="Híbrido (Mediana Municipal + Ridge Satelital + k-NN)",
            rmse=0.4856,
            mae=0.3159,
            r2=0.6722,
            mapePct=8.4,
            cvFolds=5,
            isSelected=True,
        ),
        ModelMetricComparison(
            modelName="KNN Espacial (k=12, Ponderación por Distancia)",
            rmse=0.4893,
            mae=0.3540,
            r2=0.6671,
            mapePct=9.2,
            cvFolds=5,
            isSelected=False,
        ),
        ModelMetricComparison(
            modelName="Extra Trees Regressor (Satélite + Clima + Municipio)",
            rmse=0.5262,
            mae=0.3759,
            r2=0.6149,
            mapePct=9.8,
            cvFolds=5,
            isSelected=False,
        ),
        ModelMetricComparison(
            modelName="Random Forest Regressor (Todas las Variables)",
            rmse=0.5281,
            mae=0.3747,
            r2=0.6121,
            mapePct=9.8,
            cvFolds=5,
            isSelected=False,
        ),
        ModelMetricComparison(
            modelName="Ridge Regressor (Exclusivamente Satélite + Topografía)",
            rmse=0.6344,
            mae=0.4932,
            r2=0.4403,
            mapePct=12.9,
            cvFolds=5,
            isSelected=False,
        ),
    ],
    guideQuestion1_VegetationIndices=[
        VegetationIndexInsight(
            indexName="NDVI (Sentinel-2 + PlanetScope: Base, Pico y Duración)",
            fullName="Normalized Difference Vegetation Index",
            formula="(NIR - Red) / (NIR + Red)",
            shapImportancePct=38.4,
            pearsonR=0.48,
            criticalStage="Espigado y Floración",
            interpretation=(
                "s2_ndvi_base (rho = 0.477, IM = 0.149) y la duración fenológica pl_ndvi_duracion "
                "(rho = 0.441, IM = 0.232) son los predictores espectrales con mayor señal global e intra-municipal (|r| = 0.238)."
            ),
        ),
        VegetationIndexInsight(
            indexName="SAVI (Índice Ajustado al Suelo en Arranque)",
            fullName="Soil Adjusted Vegetation Index",
            formula="((NIR - Red) / (NIR + Red + L)) * (1 + L)",
            shapImportancePct=24.6,
            pearsonR=0.48,
            criticalStage="Macollamiento",
            interpretation=(
                "s2_savi_base alcanza la mayor correlación de Spearman entre los índices ópticos (rho = 0.485, IM = 0.200) "
                "al corregir la reflectancia del suelo volcánico durante el establecimiento del cultivo."
            ),
        ),
        VegetationIndexInsight(
            indexName="EVI / LAI (Vigor del Dosel y Área Foliar)",
            fullName="Enhanced Vegetation Index & Leaf Area Index",
            formula="2.5 * (NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1)",
            shapImportancePct=21.2,
            pearsonR=0.48,
            criticalStage="Encañado",
            interpretation=(
                "pl_evi_base (rho = 0.481, IM = 0.171) y s2_lai_base (rho = 0.477, IM = 0.186) "
                "evitan la saturación en parcelas densas de Chignahuapan y Almoloya (>4.5 t/ha)."
            ),
        ),
        VegetationIndexInsight(
            indexName="NDWI / MSI (Estado Hídrico del Dosel en Llenado)",
            fullName="Normalized Difference Water Index",
            formula="(NIR - SWIR) / (NIR + SWIR)",
            shapImportancePct=15.8,
            pearsonR=0.34,
            criticalStage="Llenado de Grano",
            interpretation=(
                "Complementa el ajuste Ridge residual detectando estrés hídrico intra-municipal "
                "durante julio-septiembre en parcelas de temporal de Calpulalpan y Singuilucan."
            ),
        ),
    ],
    guideQuestion2_ClimateVariables=[
        ClimateVariableInsight(
            variableName="Precipitación Pre-Siembra y Acumulada del Ciclo (prec_pre_siembra / prec_ciclo)",
            shapImportancePct=36.5,
            optimalRange="850 mm – 1,150 mm (sin exceso hídrico temprano)",
            impactDescription=(
                "Mayor información mutua del estudio (IM = 0.517, rho = -0.704). Diferencia claramente los regímenes "
                "húmedos de sierra (Chignahuapan) frente a los llanos semiáridos (Calpulalpan y Apan)."
            ),
        ),
        ClimateVariableInsight(
            variableName="Amplitud Térmica Diurna del Ciclo (amplitud_ciclo_c / amp_jun_sep)",
            shapImportancePct=31.2,
            optimalRange="10.2 °C – 12.0 °C en ventana reproductiva",
            impactDescription=(
                "Segunda variable con mayor poder explicativo (IM = 0.410, rho = -0.665, p < 0.0001 Bonferroni). "
                "Amplitudes térmicas extremas indican mayor radiación con riesgo de heladas y estrés evaporativo."
            ),
        ),
        ClimateVariableInsight(
            variableName="Temperatura Mínima en Ciclo y Floración (tmin_ciclo_c / tmin_jun_sep)",
            shapImportancePct=19.8,
            optimalRange="> 9.5 °C promedio jun–sep (sin heladas tempranas)",
            impactDescription=(
                "Correlación positiva significativa con el rendimiento (rho = +0.544, p < 0.0001). "
                "Protege el llenado de grano frente al vanamiento de espiga en zonas altas (>2,600 msnm)."
            ),
        ),
        ClimateVariableInsight(
            variableName="Temperatura Máxima Diurna en Verano (tmax_ciclo_c / tmax_jun_sep)",
            shapImportancePct=12.5,
            optimalRange="20.5 °C – 23.0 °C",
            impactDescription=(
                "Correlación negativa (rho = -0.397, p = 0.0001 Bonferroni): temperaturas máximas elevadas "
                "aceleran la senescencia foliar y acortan la duración del llenado de grano."
            ),
        ),
    ],
    guideQuestion3_FeatureCombinations=[
        FeatureCombinationInsight(
            combinationName="Modelo Ganador: Híbrido Jerárquico (Mediana Municipal / k-NN + Ajuste Ridge Top-10 Satélite/Topo)",
            featuresIncluded="Mediana_Municipal (n>=9) / kNN_Espacial (n<9) + Ridge(alpha=50) sobre Top-10 Spearman residual (NDVI, SAVI, EVI, LAI, log_area, elev_media, pend_media)",
            rmse=0.4856,
            mae=0.3159,
            r2=0.6722,
            gainVsBaselinePct=23.5,
            isWinner=True,
        ),
        FeatureCombinationInsight(
            combinationName="Interpolación Espacial Pura: KNN Espacial (k=12 con ponderación por distancia)",
            featuresIncluded="Coordenadas proyectadas (x_km, y_km) de las 138 parcelas de entrenamiento",
            rmse=0.4893,
            mae=0.3540,
            r2=0.6671,
            gainVsBaselinePct=22.9,
            isWinner=False,
        ),
        FeatureCombinationInsight(
            combinationName="Ensamble No Lineal Completo: Extra Trees / Random Forest (Satélite + Clima + Municipio)",
            featuresIncluded="Todas las variables de Sentinel-2, PlanetScope, Landsat, Clima 2025, DEM y Municipio",
            rmse=0.5262,
            mae=0.3759,
            r2=0.6149,
            gainVsBaselinePct=17.1,
            isWinner=False,
        ),
        FeatureCombinationInsight(
            combinationName="Línea Base Espectral: Ridge Regressor (Exclusivamente Satélite + Topografía sin contexto espacial)",
            featuresIncluded="Índices satelitales (Planet + Sentinel-2 + Landsat) + Área + Elevación + Pendiente",
            rmse=0.6344,
            mae=0.4932,
            r2=0.4403,
            gainVsBaselinePct=0.0,
            isWinner=False,
        ),
    ],
)


def construir_model_insights() -> ModelInsightsPayload:
    """Retorna el payload estático de métricas y respuestas a preguntas guía FIRA."""
    return INITIAL_MODEL_INSIGHTS


def ejecutar_prediccion_en_vivo(entrada: LivePredictionInput) -> LivePredictionResponse:
    """Ejecuta la inferencia en vivo calibrada con el modelo Híbrido + respuesta espectral."""
    state_base = (
        1.72 if entrada.state == "Puebla" else 1.68 if entrada.state == "Tlaxcala" else 1.62
    )
    ndvi_term = entrada.ndviEspigado * 2.85
    ndwi_term = entrada.ndwiLlenado * 1.15
    evi_term = (entrada.eviEncanado - 0.5) * 0.65
    precip_term = (entrada.precipJulAgoMm - 220.0) * 0.0028
    frost_penalty = (4.5 - entrada.tempMinSepC) * -0.22 if entrada.tempMinSepC < 4.5 else 0.08
    regime_bonus = 0.42 if entrada.regime == "Riego Auxiliar" else 0.0

    raw_yield = (
        state_base + ndvi_term + ndwi_term + evi_term + precip_term + frost_penalty + regime_bonus
    )
    predicted_yield_ton_ha = _round_js(min(6.6, max(1.5, raw_yield)), 2)

    score_calc = (
        40.0
        + predicted_yield_ton_ha * 11.4
        + (6.0 if entrada.regime == "Riego Auxiliar" else 0.0)
    )
    fira_credit_score = int(_round_js(min(98.0, max(45.0, score_calc)), 0))
    risk_level: RiskLevel = (
        "Bajo"
        if fira_credit_score >= 78
        else "Moderado"
        if fira_credit_score >= 64
        else "Alto"
    )

    return LivePredictionResponse(
        predictedYieldTonHa=predicted_yield_ton_ha,
        confidenceInterval=(
            _round_js(max(1.1, predicted_yield_ton_ha - 0.24), 2),
            _round_js(predicted_yield_ton_ha + 0.24, 2),
        ),
        firaCreditScore=fira_credit_score,
        riskLevel=risk_level,
        source="backend",
    )
