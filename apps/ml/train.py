"""Train and select the Ford pilot churn-risk model reproducibly."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


FEATURE_NAMES = [
    "days_since_last_service",
    "services_last_24_months",
    "vehicle_age_years",
    "voucher_usage_count",
]
TARGET_NAME = "churned_within_180d"
MODEL_VERSION = "churn-risk-pilot-v1"
SEED = 20260913


def build_pipeline(classifier: Any) -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numeric",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                FEATURE_NAMES,
            )
        ],
        remainder="drop",
    )
    return Pipeline(steps=[("preprocessor", preprocessor), ("classifier", classifier)])


def evaluate(model: Pipeline, features: pd.DataFrame, target: pd.Series) -> dict[str, float]:
    probabilities = model.predict_proba(features)[:, 1]
    predictions = (probabilities >= 0.5).astype(int)
    return {
        "roc_auc": round(float(roc_auc_score(target, probabilities)), 4),
        "precision": round(float(precision_score(target, predictions, zero_division=0)), 4),
        "recall": round(float(recall_score(target, predictions, zero_division=0)), 4),
        "f1": round(float(f1_score(target, predictions, zero_division=0)), 4),
    }


def load_and_split(dataset_path: Path, test_fraction: float) -> tuple[pd.DataFrame, pd.DataFrame]:
    dataset = pd.read_csv(dataset_path)
    required_columns = {"observation_date", TARGET_NAME, *FEATURE_NAMES}
    missing = required_columns.difference(dataset.columns)
    if missing:
        raise ValueError(f"Dataset is missing required columns: {', '.join(sorted(missing))}")

    dataset["observation_date"] = pd.to_datetime(dataset["observation_date"], errors="raise")
    dataset = dataset.sort_values("observation_date", kind="stable").reset_index(drop=True)
    split_index = int(len(dataset) * (1 - test_fraction))
    if split_index < 1 or len(dataset) - split_index < 1:
        raise ValueError("Dataset is too small for the requested chronological split")

    train, test = dataset.iloc[:split_index].copy(), dataset.iloc[split_index:].copy()
    if train[TARGET_NAME].nunique() < 2 or test[TARGET_NAME].nunique() < 2:
        raise ValueError("Both chronological splits must contain positive and negative churn examples")
    return train, test


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train churn-risk pilot models and save the winner.")
    parser.add_argument("--data", type=Path, default=Path("data/training_data.csv"))
    parser.add_argument("--artifacts-dir", type=Path, default=Path("artifacts"))
    parser.add_argument("--test-fraction", type=float, default=0.2)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not 0 < args.test_fraction < 0.5:
        raise ValueError("test-fraction must be greater than 0 and less than 0.5")

    train, test = load_and_split(args.data, args.test_fraction)
    candidates = {
        "logistic_regression": build_pipeline(
            LogisticRegression(max_iter=2_000, class_weight="balanced", random_state=SEED)
        ),
        "random_forest": build_pipeline(
            RandomForestClassifier(
                n_estimators=400,
                min_samples_leaf=4,
                class_weight="balanced",
                random_state=SEED,
                n_jobs=-1,
            )
        ),
    }

    test_metrics: dict[str, dict[str, float]] = {}
    fitted_models: dict[str, Pipeline] = {}
    for name, model in candidates.items():
        model.fit(train[FEATURE_NAMES], train[TARGET_NAME])
        fitted_models[name] = model
        test_metrics[name] = evaluate(model, test[FEATURE_NAMES], test[TARGET_NAME])

    selected_model = max(test_metrics, key=lambda name: (test_metrics[name]["roc_auc"], test_metrics[name]["f1"]))
    trained_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    metadata = {
        "feature_names": FEATURE_NAMES,
        "model_version": MODEL_VERSION,
        "selected_model": selected_model,
        "trained_at": trained_at,
    }
    metrics = {
        "model_version": MODEL_VERSION,
        "selected_model": selected_model,
        "selection_rule": "Highest ROC-AUC on chronological test data; F1 breaks ties.",
        "seed": SEED,
        "data": {
            "source": str(args.data),
            "synthetic": True,
            "target": TARGET_NAME,
            "chronological_split": True,
            "train_records": len(train),
            "test_records": len(test),
            "train_end_date": train["observation_date"].max().date().isoformat(),
            "test_start_date": test["observation_date"].min().date().isoformat(),
        },
        "test_metrics": test_metrics,
        "metadata": metadata,
    }

    args.artifacts_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {"model": fitted_models[selected_model], "metadata": metadata},
        args.artifacts_dir / "churn_model.joblib",
    )
    (args.artifacts_dir / "metrics.json").write_text(
        json.dumps(metrics, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(
        f"Selected {selected_model} (ROC-AUC={test_metrics[selected_model]['roc_auc']}) and saved "
        f"{args.artifacts_dir / 'churn_model.joblib'} plus {args.artifacts_dir / 'metrics.json'}."
    )


if __name__ == "__main__":
    main()
