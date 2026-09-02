"""Symptom burden forecasting.

Ridge regression, fit per request on this user's own data. The choice is
deliberate and is about explainability, not about what scores best: standardised
ridge coefficients ARE the explanation. "Your short sleep pushed this up" is read
straight off the fitted model, not reconstructed afterwards by a separate
attribution method that might disagree with the number it is explaining.

A gradient-boosted model would likely predict marginally better and would fail
the project's own rule: if we can't explain why it said something, it doesn't
ship (MyLumi_Plan.md 10.2).

Nothing is persisted. The model is fit, used to answer one question, and
discarded with the request.
"""

from typing import Optional

import numpy as np

from .confidence import INTERVAL_WIDENING, has_enough, insufficient_reason, tier_for
from .features import FEATURE_LABELS, Episode, build_matrix, complete_count

MAX_BURDEN = 54

# Ordered by how much each tends to matter clinically, which is also the order
# they get dropped in when a user has not answered some of them.
FORECAST_FEATURES = [
    "symptomBurden",
    "sleepDurationHours",
    "sleepQuality",
    "preSleepStress",
    "awakenings",
]

# Minimum rows per feature before we will fit on that many features at all.
# Ridge will happily fit 5 features to 7 points and produce confident nonsense;
# this forces the feature set to shrink instead.
ROWS_PER_FEATURE = 2.5

RIDGE_ALPHA = 1.0


def _fit_ridge(x: np.ndarray, y: np.ndarray, alpha: float = RIDGE_ALPHA):
    """Standardise, solve the closed form, return (coefs, intercept, mu, sigma).

    Standardising first is what makes the coefficients comparable to each other —
    without it a feature measured in minutes would dwarf one measured 0-6 purely
    because of its units, and the "top drivers" list would be meaningless.

    A zero-variance column (the user answered identically every night) gets
    sigma=1 and a zero coefficient: it genuinely carries no information, and this
    avoids a divide-by-zero producing a spurious infinite driver.
    """
    mu = x.mean(axis=0)
    sigma = x.std(axis=0)
    sigma = np.where(sigma < 1e-9, 1.0, sigma)
    xs = (x - mu) / sigma

    y_mean = y.mean()
    yc = y - y_mean

    n_features = xs.shape[1]
    gram = xs.T @ xs + alpha * np.eye(n_features)
    try:
        coefs = np.linalg.solve(gram, xs.T @ yc)
    except np.linalg.LinAlgError:
        coefs = np.linalg.lstsq(gram, xs.T @ yc, rcond=None)[0]

    return coefs, y_mean, mu, sigma


def _select_features(episodes: list[Episode]) -> tuple[list[str], np.ndarray, np.ndarray, list[str]]:
    """Largest feature set this much data can actually support.

    Tries the full set, then drops the least-important feature and retries.
    Returning fewer features with more rows is nearly always the better trade at
    hackathon-scale n.
    """
    best: tuple[list[str], np.ndarray, np.ndarray, list[str]] = ([], np.empty((0, 0)), np.empty((0,)), [])
    for cutoff in range(len(FORECAST_FEATURES), 0, -1):
        keys = FORECAST_FEATURES[:cutoff]
        x, y, nights = build_matrix(episodes, keys)
        if len(y) >= max(4, int(np.ceil(len(keys) * ROWS_PER_FEATURE))):
            return keys, x, y, nights
        # Remember the widest set that produced anything, as a fallback.
        if len(y) > len(best[2]):
            best = (keys, x, y, nights)
    return best


def forecast(episodes: list[Episode]) -> dict:
    """Predict the next episode's symptom burden, with drivers and an interval."""
    n_complete = complete_count(episodes)
    tier = tier_for(n_complete)

    if not has_enough(n_complete):
        return {
            "available": False,
            "reason": insufficient_reason(n_complete),
            "confidence": "none",
            "nDays": n_complete,
            "predictedBurden": None,
            "interval": None,
            "drivers": [],
            "maxBurden": MAX_BURDEN,
        }

    keys, x, y, _nights = _select_features(episodes)
    if len(y) < 4:
        # Enough episodes overall, but not enough with a *next* night to learn
        # the transition from. Says so rather than falling back to an average.
        return {
            "available": False,
            "reason": "Not enough back-to-back nights yet to forecast tomorrow.",
            "confidence": tier,
            "nDays": n_complete,
            "predictedBurden": None,
            "interval": None,
            "drivers": [],
            "maxBurden": MAX_BURDEN,
        }

    coefs, y_mean, mu, sigma = _fit_ridge(x, y)

    # Predict from the most recent episode that has every feature we fitted on.
    latest = None
    for ep in reversed(episodes):
        row = [ep.get(k) for k in keys]
        if all(v is not None for v in row):
            latest = np.asarray(row, dtype=float)
            break
    if latest is None:
        return {
            "available": False,
            "reason": "Your most recent night is missing some answers, so there is nothing to forecast from.",
            "confidence": tier,
            "nDays": n_complete,
            "predictedBurden": None,
            "interval": None,
            "drivers": [],
            "maxBurden": MAX_BURDEN,
        }

    latest_scaled = (latest - mu) / sigma
    prediction = float(y_mean + latest_scaled @ coefs)
    prediction = float(np.clip(prediction, 0.0, MAX_BURDEN))

    # Interval from in-sample residual spread, widened per tier. In-sample
    # residuals understate real error, which is exactly why INTERVAL_WIDENING
    # exists rather than a bare 1.0 multiplier.
    fitted = y_mean + (x - mu) / sigma @ coefs
    residuals = y - fitted
    dof = max(1, len(y) - len(keys) - 1)
    spread = float(np.sqrt(np.sum(residuals**2) / dof))
    half = INTERVAL_WIDENING[tier] * spread
    interval = [
        round(float(max(0.0, prediction - half)), 1),
        round(float(min(MAX_BURDEN, prediction + half)), 1),
    ]

    # Per-feature contribution for THIS prediction: coefficient x how unusual
    # today's value is. A feature at the user's own average contributes ~nothing
    # and should not be reported as a driver, which is what makes this honest.
    contributions = coefs * latest_scaled
    order = np.argsort(-np.abs(contributions))
    drivers = []
    for idx in order[:3]:
        weight = float(contributions[idx])
        if abs(weight) < 0.05:
            continue
        key = keys[idx]
        drivers.append(
            {
                "feature": key,
                "label": FEATURE_LABELS.get(key, key),
                "direction": "increases" if weight > 0 else "decreases",
                "weight": round(abs(weight), 2),
            }
        )

    return {
        "available": True,
        "reason": None,
        "confidence": tier,
        "nDays": n_complete,
        "predictedBurden": round(prediction, 1),
        "interval": interval,
        "drivers": drivers,
        "maxBurden": MAX_BURDEN,
    }
