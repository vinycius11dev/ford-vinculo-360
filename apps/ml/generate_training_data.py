"""Generate a deterministic, anonymous pilot dataset for churn-risk training.

The generated records describe vehicle service behaviour only. They deliberately
exclude names, e-mails, CPF/CNPJ, VIN, licence plates and any other direct
identifier.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd


DEFAULT_ROWS = 1_200
DEFAULT_SEED = 20260913
DEFAULT_REFERENCE_DATE = "2026-09-13"
DEFAULT_MISSING_RATE = 0.01
FEATURE_NAMES = (
    "days_since_last_service",
    "services_last_24_months",
    "vehicle_age_years",
    "voucher_usage_count",
)


def sigmoid(value: np.ndarray) -> np.ndarray:
    return 1 / (1 + np.exp(-value))


def generate_dataset(
    rows: int,
    seed: int,
    reference_date: str,
    missing_rate: float = DEFAULT_MISSING_RATE,
) -> pd.DataFrame:
    """Return a synthetic, anonymised historical service dataset.

    `churned_within_180d` is 1 when a synthetic vehicle did not return to the
    Ford service network in the following 180 days. The label is generated from
    plausible fleet-service signals plus small random variation; it is not based
    on any real customer or vehicle.
    """
    if rows < 100:
        raise ValueError("rows must be at least 100 so train and test retain useful samples")
    if not 0 <= missing_rate < 0.2:
        raise ValueError("missing_rate must be at least 0 and less than 0.2")

    rng = np.random.default_rng(seed)
    reference = pd.Timestamp(reference_date).normalize()
    earliest_observation = reference - pd.DateOffset(days=1_460)
    observation_dates = earliest_observation + pd.to_timedelta(
        rng.integers(0, 1_281, size=rows), unit="D"
    )

    vehicle_age_years = np.clip(rng.gamma(shape=2.2, scale=2.1, size=rows), 0.1, 15.0).round(1)
    services_last_24_months = np.clip(
        rng.poisson(lam=np.maximum(0.6, 3.9 - vehicle_age_years * 0.12)), 0, 10
    )
    days_since_last_service = np.clip(
        rng.normal(
            loc=175 + vehicle_age_years * 17 - services_last_24_months * 15,
            scale=74,
            size=rows,
        ),
        7,
        900,
    ).round().astype(int)
    voucher_usage_count = np.clip(
        rng.poisson(lam=np.where(services_last_24_months >= 3, 1.4, 0.55)), 0, 8
    ).astype(int)

    # A modest time effect makes a chronological hold-out meaningful without
    # leaking future labels into training. Noise avoids a deterministic rule.
    calendar_effect = (observation_dates - earliest_observation).days.to_numpy() / 1_280
    log_odds = (
        -2.35
        + 0.0075 * days_since_last_service
        - 0.38 * services_last_24_months
        + 0.11 * vehicle_age_years
        - 0.15 * voucher_usage_count
        + 0.22 * calendar_effect
        + rng.normal(0, 0.48, size=rows)
    )
    churned_within_180d = rng.binomial(1, sigmoid(log_odds)).astype(int)

    dataset = pd.DataFrame(
        {
            "synthetic_record_id": [f"SYN-{index:06d}" for index in range(1, rows + 1)],
            "observation_date": observation_dates.strftime("%Y-%m-%d"),
            "days_since_last_service": days_since_last_service,
            "services_last_24_months": services_last_24_months,
            "vehicle_age_years": vehicle_age_years,
            "voucher_usage_count": voucher_usage_count,
            "churned_within_180d": churned_within_180d,
        }
    ).sort_values("observation_date", kind="stable").reset_index(drop=True)

    # Inject reproducible, feature-only missingness so the imputation step is
    # exercised by the academic dataset. The synthetic target is not changed.
    for feature_name in FEATURE_NAMES:
        missing_mask = rng.random(rows) < missing_rate
        dataset.loc[missing_mask, feature_name] = np.nan

    return dataset


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate anonymous synthetic churn training data.")
    parser.add_argument("--output", type=Path, default=Path("data/training_data.csv"))
    parser.add_argument("--rows", type=int, default=DEFAULT_ROWS)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--reference-date", default=DEFAULT_REFERENCE_DATE)
    parser.add_argument("--missing-rate", type=float, default=DEFAULT_MISSING_RATE)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    dataset = generate_dataset(args.rows, args.seed, args.reference_date, args.missing_rate)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    dataset.to_csv(args.output, index=False)
    print(
        f"Generated {len(dataset)} anonymous synthetic records at {args.output} "
        f"(seed={args.seed}, missing rate={args.missing_rate:.1%}, "
        f"churn rate={dataset['churned_within_180d'].mean():.1%})."
    )


if __name__ == "__main__":
    main()
