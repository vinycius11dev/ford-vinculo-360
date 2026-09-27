"""Serviço de previsão de evasão do piloto Ford.

O serviço continua disponível sem o artefato treinado para não interromper a
operação local. Quando ``artifacts/churn_model.joblib`` existe, usa o modelo
versionado treinado pelo script ``train.py``; caso contrário, identifica de
forma explícita que está usando a linha de base heurística.
"""

from __future__ import annotations

from functools import lru_cache
from math import exp
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
import pandas as pd
from pydantic import BaseModel, Field

try:
    import joblib
except ImportError:
    joblib = None


app = FastAPI(title="Ford Vínculo 360 ML", version="1.0.0")

FEATURE_NAMES = (
    "days_since_last_service",
    "services_last_24_months",
    "vehicle_age_years",
    "voucher_usage_count",
)
ARTIFACT_PATH = Path(__file__).resolve().parents[1] / "artifacts" / "churn_model.joblib"


class ChurnFeatures(BaseModel):
    days_since_last_service: int = Field(ge=0)
    services_last_24_months: int = Field(ge=0)
    vehicle_age_years: float = Field(ge=0)
    voucher_usage_count: int = Field(ge=0)


class ChurnBatch(BaseModel):
    items: list[ChurnFeatures] = Field(min_length=1, max_length=250)


def feature_frame(items: list[ChurnFeatures]) -> pd.DataFrame:
    """Mantém os nomes de coluna usados no ColumnTransformer do artefato."""
    return pd.DataFrame(
        [
            {
                "days_since_last_service": float(item.days_since_last_service),
                "services_last_24_months": float(item.services_last_24_months),
                "vehicle_age_years": float(item.vehicle_age_years),
                "voucher_usage_count": float(item.voucher_usage_count),
            }
            for item in items
        ],
        columns=FEATURE_NAMES,
    )


@lru_cache(maxsize=1)
def load_model() -> dict[str, Any] | None:
    if not ARTIFACT_PATH.exists() or joblib is None:
        return None
    artifact = joblib.load(ARTIFACT_PATH)
    if not isinstance(artifact, dict) or "model" not in artifact:
        raise ValueError("Artefato de churn inválido: modelo ausente.")
    metadata = artifact.get("metadata", {})
    if tuple(metadata.get("feature_names", [])) != FEATURE_NAMES:
        raise ValueError("Artefato de churn incompatível com as variáveis da API.")
    return artifact


def heuristic_probability(item: ChurnFeatures) -> float:
    raw = -2.4 + 0.008 * item.days_since_last_service - 0.35 * min(item.services_last_24_months, 6) + 0.12 * item.vehicle_age_years - 0.18 * min(item.voucher_usage_count, 5)
    return round(1 / (1 + exp(-raw)), 4)


def classification_for(probability: float) -> str:
    if probability >= 0.80:
        return "LOST"
    if probability >= 0.55:
        return "AT_RISK"
    if probability >= 0.30:
        return "ATTENTION"
    return "ACTIVE"


def explain(item: ChurnFeatures) -> list[str]:
    reasons: list[str] = []
    if item.days_since_last_service > 730:
        reasons.append("mais de 2 anos sem serviço registrado")
    elif item.days_since_last_service > 365:
        reasons.append("retorno anual vencido")
    elif item.days_since_last_service > 240:
        reasons.append("revisão recomendada nos próximos meses")
    if item.services_last_24_months == 0:
        reasons.append("nenhum serviço nos últimos 24 meses")
    if item.vehicle_age_years >= 6:
        reasons.append("veículo com mais de 5 anos")
    if item.voucher_usage_count == 0:
        reasons.append("sem uso de benefícios na rede")
    return reasons or ["histórico de manutenção dentro do esperado"]


def score(items: list[ChurnFeatures]) -> tuple[list[dict[str, Any]], dict[str, str]]:
    artifact = load_model()
    if artifact is None:
        probabilities = [heuristic_probability(item) for item in items]
        identity = {"source": "heuristic-baseline", "model_version": "heuristic-baseline-v1"}
    else:
        probabilities = [round(float(value), 4) for value in artifact["model"].predict_proba(feature_frame(items))[:, 1]]
        metadata = artifact["metadata"]
        identity = {"source": "trained-model", "model_version": str(metadata.get("model_version", "trained-model-v1"))}
    return [{"probability": probability, "classification": classification_for(probability), "reasons": explain(item), **identity} for item, probability in zip(items, probabilities, strict=True)], identity


@app.get("/health")
def health():
    try:
        artifact = load_model()
        metadata = artifact.get("metadata", {}) if artifact else {}
        return {"status": "ok", "mode": "trained-model" if artifact else "heuristic-baseline", "model": metadata.get("model_version", "heuristic-baseline-v1")}
    except Exception as error:
        return {"status": "degraded", "mode": "artifact-error", "detail": str(error)}


@app.post("/score/churn")
def score_churn(features: ChurnFeatures):
    try:
        return score([features])[0][0]
    except Exception as error:
        raise HTTPException(status_code=503, detail="Modelo de risco indisponível.") from error


@app.post("/score/churn/batch")
def score_churn_batch(batch: ChurnBatch):
    try:
        items, identity = score(batch.items)
        return {"items": items, **identity}
    except Exception as error:
        raise HTTPException(status_code=503, detail="Modelo de risco indisponível.") from error
