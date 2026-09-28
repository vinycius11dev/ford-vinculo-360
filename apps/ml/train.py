"""Train, tune, compare, and export the Ford pilot churn-risk model."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


FEATURE_NAMES = [
    "days_since_last_service",
    "services_last_24_months",
    "vehicle_age_years",
    "voucher_usage_count",
]
TARGET_NAME = "churned_within_180d"
MODEL_VERSION = "churn-risk-pilot-v2"
SEED = 20260913
SYNTHETIC_FEATURE_RANGES = {
    "days_since_last_service": (7.0, 900.0),
    "services_last_24_months": (0.0, 10.0),
    "vehicle_age_years": (0.1, 15.0),
    "voucher_usage_count": (0.0, 8.0),
}
COUNT_FEATURES = {"services_last_24_months", "voucher_usage_count"}
METRIC_NAMES = ("roc_auc", "precision", "recall", "f1")


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
    if target.nunique() != 2:
        raise ValueError("Every validation and test partition must contain both churn classes")
    probabilities = model.predict_proba(features)[:, 1]
    predictions = (probabilities >= 0.5).astype(int)
    return {
        "roc_auc": round(float(roc_auc_score(target, probabilities)), 4),
        "precision": round(float(precision_score(target, predictions, zero_division=0)), 4),
        "recall": round(float(recall_score(target, predictions, zero_division=0)), 4),
        "f1": round(float(f1_score(target, predictions, zero_division=0)), 4),
    }


def load_and_split(
    dataset_path: Path,
    test_fraction: float,
) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, Any]]:
    dataset = pd.read_csv(dataset_path)
    required_columns = {"observation_date", TARGET_NAME, *FEATURE_NAMES}
    missing_columns = required_columns.difference(dataset.columns)
    if missing_columns:
        raise ValueError(f"Dataset is missing required columns: {', '.join(sorted(missing_columns))}")
    if dataset.empty:
        raise ValueError("Dataset must contain at least one record")

    if "synthetic_record_id" in dataset and dataset["synthetic_record_id"].duplicated().any():
        raise ValueError("Dataset contains duplicate synthetic_record_id values")

    dates = pd.to_datetime(dataset["observation_date"], errors="coerce")
    if dates.isna().any():
        raise ValueError("Dataset contains missing or invalid observation_date values")
    dataset["observation_date"] = dates

    target = pd.to_numeric(dataset[TARGET_NAME], errors="coerce")
    if target.isna().any() or not set(target.unique()).issubset({0, 1}):
        raise ValueError(f"{TARGET_NAME} must contain only non-missing 0/1 labels")
    dataset[TARGET_NAME] = target.astype(int)

    missing_values: dict[str, int] = {}
    for feature_name in FEATURE_NAMES:
        original = dataset[feature_name]
        numeric = pd.to_numeric(original, errors="coerce")
        invalid_text = original.notna() & numeric.isna()
        if invalid_text.any():
            raise ValueError(f"{feature_name} contains non-numeric values")

        finite = numeric.dropna()
        if not np.isfinite(finite.to_numpy(dtype=float)).all():
            raise ValueError(f"{feature_name} contains infinite values")
        lower, upper = SYNTHETIC_FEATURE_RANGES[feature_name]
        outside_range = (finite < lower) | (finite > upper)
        if outside_range.any():
            raise ValueError(
                f"{feature_name} contains values outside the synthetic range [{lower}, {upper}]"
            )
        if feature_name in COUNT_FEATURES and not np.isclose(finite % 1, 0).all():
            raise ValueError(f"{feature_name} must contain whole-number counts")

        dataset[feature_name] = numeric.astype(float)
        missing_values[feature_name] = int(numeric.isna().sum())

    dataset = dataset.sort_values("observation_date", kind="stable").reset_index(drop=True)
    split_index = int(len(dataset) * (1 - test_fraction))
    if split_index < 2 or len(dataset) - split_index < 2:
        raise ValueError("Dataset is too small for the requested chronological split")

    train = dataset.iloc[:split_index].copy()
    test = dataset.iloc[split_index:].copy()
    if train[TARGET_NAME].nunique() < 2 or test[TARGET_NAME].nunique() < 2:
        raise ValueError("Both chronological train and test partitions need positive and negative examples")

    quality = {
        "rows_total": len(dataset),
        "missing_values_by_feature": missing_values,
        "missing_values_total": sum(missing_values.values()),
        "duplicate_synthetic_ids": 0,
        "invalid_dates": 0,
        "invalid_numeric_values": 0,
        "out_of_range_values": 0,
        "outlier_policy": "Synthetic values are clipped by the generator; impossible values are rejected before training.",
    }
    return train, test, quality


def candidate_configurations() -> dict[str, list[dict[str, Any]]]:
    return {
        "logistic_regression": [
            {"C": 0.1, "class_weight": "balanced", "max_iter": 3000},
            {"C": 1.0, "class_weight": "balanced", "max_iter": 3000},
            {"C": 10.0, "class_weight": "balanced", "max_iter": 3000},
        ],
        "random_forest": [
            {
                "n_estimators": 200,
                "max_depth": 6,
                "min_samples_leaf": 2,
                "max_features": "sqrt",
                "class_weight": "balanced",
            },
            {
                "n_estimators": 300,
                "max_depth": 10,
                "min_samples_leaf": 4,
                "max_features": "sqrt",
                "class_weight": "balanced",
            },
            {
                "n_estimators": 400,
                "max_depth": None,
                "min_samples_leaf": 4,
                "max_features": "sqrt",
                "class_weight": "balanced",
            },
        ],
    }


def make_classifier(model_name: str, parameters: dict[str, Any]) -> Any:
    if model_name == "logistic_regression":
        return LogisticRegression(
            C=parameters["C"],
            max_iter=parameters["max_iter"],
            class_weight=parameters["class_weight"],
            random_state=SEED,
        )
    if model_name == "random_forest":
        return RandomForestClassifier(
            n_estimators=parameters["n_estimators"],
            max_depth=parameters["max_depth"],
            min_samples_leaf=parameters["min_samples_leaf"],
            max_features=parameters["max_features"],
            class_weight=parameters["class_weight"],
            random_state=SEED,
            n_jobs=-1,
        )
    raise ValueError(f"Unsupported model: {model_name}")


def mean_metrics(results: list[dict[str, float]]) -> dict[str, float]:
    return {
        metric: round(float(np.mean([result[metric] for result in results])), 4)
        for metric in METRIC_NAMES
    }


def tune_models(
    train: pd.DataFrame,
    validation_splits: int,
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, dict[str, Any]]]:
    if validation_splits < 2:
        raise ValueError("validation-splits must be at least 2")

    splitter = TimeSeriesSplit(n_splits=validation_splits)
    folds = list(splitter.split(train))
    if not folds:
        raise ValueError("Not enough training rows for chronological validation")

    tuning_results: dict[str, list[dict[str, Any]]] = {}
    best_configurations: dict[str, dict[str, Any]] = {}
    for model_name, configurations in candidate_configurations().items():
        family_results: list[dict[str, Any]] = []
        for parameters in configurations:
            fold_metrics: list[dict[str, float]] = []
            for training_indices, validation_indices in folds:
                fold_train = train.iloc[training_indices]
                fold_validation = train.iloc[validation_indices]
                model = build_pipeline(make_classifier(model_name, parameters))
                model.fit(fold_train[FEATURE_NAMES], fold_train[TARGET_NAME])
                fold_metrics.append(evaluate(model, fold_validation[FEATURE_NAMES], fold_validation[TARGET_NAME]))
            family_results.append(
                {
                    "parameters": parameters,
                    "validation_mean_metrics": mean_metrics(fold_metrics),
                }
            )

        best = max(
            family_results,
            key=lambda item: (
                item["validation_mean_metrics"]["roc_auc"],
                item["validation_mean_metrics"]["f1"],
            ),
        )
        tuning_results[model_name] = family_results
        best_configurations[model_name] = best
    return tuning_results, best_configurations


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Tune and train chronological churn-risk pilot models.")
    parser.add_argument("--data", type=Path, default=Path("data/training_data.csv"))
    parser.add_argument("--artifacts-dir", type=Path, default=Path("artifacts"))
    parser.add_argument("--test-fraction", type=float, default=0.2)
    parser.add_argument("--validation-splits", type=int, default=3)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not 0 < args.test_fraction < 0.5:
        raise ValueError("test-fraction must be greater than 0 and less than 0.5")

    train, test, data_quality = load_and_split(args.data, args.test_fraction)
    tuning_results, best_configurations = tune_models(train, args.validation_splits)

    test_metrics: dict[str, dict[str, float]] = {}
    fitted_models: dict[str, Pipeline] = {}
    for model_name, selected in best_configurations.items():
        model = build_pipeline(make_classifier(model_name, selected["parameters"]))
        model.fit(train[FEATURE_NAMES], train[TARGET_NAME])
        fitted_models[model_name] = model
        test_metrics[model_name] = evaluate(model, test[FEATURE_NAMES], test[TARGET_NAME])

    selected_model = max(
        best_configurations,
        key=lambda name: (
            best_configurations[name]["validation_mean_metrics"]["roc_auc"],
            best_configurations[name]["validation_mean_metrics"]["f1"],
        ),
    )
    trained_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    selected_validation_metrics = best_configurations[selected_model]["validation_mean_metrics"]
    metadata = {
        "feature_names": FEATURE_NAMES,
        "model_version": MODEL_VERSION,
        "selected_model": selected_model,
        "selected_parameters": best_configurations[selected_model]["parameters"],
        "selected_validation_mean_metrics": selected_validation_metrics,
        "trained_at": trained_at,
    }
    metrics = {
        "model_version": MODEL_VERSION,
        "selected_model": selected_model,
        "selection_rule": (
            "Highest mean ROC-AUC across expanding chronological validation folds; "
            "mean F1 breaks ties. The final chronological test partition is not used for selection."
        ),
        "seed": SEED,
        "preprocessing": {
            "missing_values": "Median imputation fitted within each training fold.",
            "scaling": "StandardScaler fitted within each training fold.",
            "split": "Chronological; latest test_fraction records are held out until final evaluation.",
            "classification_threshold": 0.5,
        },
        "data": {
            "source": str(args.data),
            "synthetic": True,
            "target": TARGET_NAME,
            "chronological_split": True,
            "train_records": len(train),
            "test_records": len(test),
            "train_end_date": train["observation_date"].max().date().isoformat(),
            "test_start_date": test["observation_date"].min().date().isoformat(),
            "validation_method": f"TimeSeriesSplit with {args.validation_splits} expanding folds inside train partition.",
        },
        "data_quality": data_quality,
        "tuning": {
            "candidate_count_per_model": {
                name: len(results) for name, results in tuning_results.items()
            },
            "results": tuning_results,
            "selected_configurations": {
                name: result["parameters"] for name, result in best_configurations.items()
            },
        },
        "validation_mean_metrics_for_selected_model": selected_validation_metrics,
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
        f"Selected {selected_model} using chronological validation "
        f"(mean ROC-AUC={selected_validation_metrics['roc_auc']}); "
        f"saved {args.artifacts_dir / 'churn_model.joblib'} and "
        f"{args.artifacts_dir / 'metrics.json'}."
    )


if __name__ == "__main__":
    main()
