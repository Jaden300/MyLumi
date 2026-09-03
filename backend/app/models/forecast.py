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

from .confidence import (
    MIN_FOR_ANY_INSIGHT,
    has_enough,
    insufficient_reason,
    tier_for,
    widening_for,
)
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

# Smallest half-width the prediction interval may report, in burden points.
# Guards the degenerate case where every logged night is identical: the residuals
# are all zero, and an unfloored interval would render as a single number and
# read as a promise.
MIN_INTERVAL_HALF_WIDTH = 1.0

# Fewest training pairs the forecast will fit on. One below MIN_FOR_ANY_INSIGHT
# because the newest logged night has no following night and so cannot be a
# pair - see the guard in forecast() for why that one row is structural.
MIN_PAIRS_TO_FIT = MIN_FOR_ANY_INSIGHT - 1


def _fit_ridge(x: np.ndarray, y: np.ndarray, alpha: float = RIDGE_ALPHA):
    """Standardise, solve the closed form, return (coefs, intercept, mu, sigma).

    Standardising first is what makes the coefficients comparable to each other -
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


def forecast(
    episodes: list[Episode], interval_half_width: Optional[float] = None
) -> dict:
    """Predict the next episode's symptom burden, with drivers and an interval.

    `interval_half_width`, when given, is a conformal half-width measured from
    this model's own out-of-sample errors (see models/validation.py). It is
    passed in rather than computed here because validation.py fits this model to
    produce it, and importing it back would be circular. The caller that has
    both - routers/insights.py - wires them together.
    """
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
    # Enough episodes overall, but not enough with a *next* night to learn the
    # transition from. Says so rather than falling back to an average.
    #
    # The bar is one BELOW the episode threshold, and that is deliberate: this
    # model learns "night -> next night", so the final logged night can never be
    # a training pair. Requiring 7 pairs would silently push the first forecast
    # to the 8th night and move a threshold the product documents as 7. The lost
    # row is structural, not missing data.
    if len(y) < MIN_PAIRS_TO_FIT:
        return {
            "available": False,
            "reason": "Not enough back-to-back nights yet to forecast tomorrow.",
            "confidence": "none",
            "nDays": int(len(y)),
            "predictedBurden": None,
            "interval": None,
            "drivers": [],
            "maxBurden": MAX_BURDEN,
        }

    coefs, y_mean, mu, sigma = _fit_ridge(x, y)

    # The tier that governs the interval and the badge must reflect the rows
    # actually FITTED, not the episode count. A user with 25 logged episodes but
    # only 8 back-to-back pairs was being told "good confidence" (the 21+ tier)
    # and handed the NARROWEST interval multiplier - the least data earning the
    # most confident-looking band, which is exactly backwards.
    n_fitted = int(len(y))
    # A fit sitting one pair below the threshold (the structural case above) is
    # reported as `low` rather than `none`: `none` means "no number at all", and
    # we are about to emit one. It gets the widest interval either way.
    fit_tier = tier_for(n_fitted)
    if fit_tier == "none":
        fit_tier = "low"

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

    # Interval. Two sources, in order of preference.
    #
    # PREFERRED: a conformal half-width computed from the model's own
    # one-step-ahead errors on this user's history, passed in by the caller.
    # That is an out-of-sample quantity and it is what makes the band mean what
    # it says.
    #
    # FALLBACK: in-sample residual spread widened per tier, used when there is
    # not enough history to conformalise. It is kept because "no interval" is
    # not an option once a number is being shown, but it is measurably
    # optimistic - simulation put the `good` tier's nominal ~80% band at about
    # 51% real coverage - so the conformal path is used whenever it exists.
    if interval_half_width is not None and np.isfinite(interval_half_width):
        half = max(float(interval_half_width), MIN_INTERVAL_HALF_WIDTH)
    else:
        fitted = y_mean + (x - mu) / sigma @ coefs
        residuals = y - fitted
        dof = max(1, len(y) - len(keys) - 1)
        spread = float(np.sqrt(np.sum(residuals**2) / dof))
        # A perfectly flat history yields zero residuals and would collapse the
        # interval to a point - a +/-0 band claims certainty no 7-night personal
        # model has. Floor it so the interval always carries visible uncertainty.
        half = max(widening_for(fit_tier) * spread, MIN_INTERVAL_HALF_WIDTH)
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
        if not np.isfinite(weight) or abs(weight) < 0.05:
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

    # Non-finite values can be PRODUCED by the maths even from finite inputs
    # (an overflowing mean gives inf, and inf/inf is NaN). np.clip does not catch
    # NaN, and a bare NaN is not valid JSON - it 500s. Refuse rather than emit.
    if not np.isfinite(prediction) or not all(np.isfinite(v) for v in interval):
        return {
            "available": False,
            "reason": "MyLumi could not compute a reliable forecast from these nights.",
            "confidence": fit_tier,
            "nDays": n_fitted,
            "predictedBurden": None,
            "interval": None,
            "drivers": [],
            "maxBurden": MAX_BURDEN,
        }

    return {
        "available": True,
        "reason": None,
        "confidence": fit_tier,
        "nDays": n_fitted,
        "predictedBurden": round(prediction, 1),
        "interval": interval,
        "drivers": drivers,
        "maxBurden": MAX_BURDEN,
    }
