"""Does the forecast actually work? Measured, not asserted.

Every other model in this service produces a number. This one grades them, and
it is the only place in the app that can answer the question a careful reader
asks first: is any of this better than guessing?

Three things it measures, all by refitting the real model on real history:

1. WALK-FORWARD ERROR. Expanding window, one step ahead. To score night t the
   model is refit on nights 0..t-1 only, so every error is genuinely
   out-of-sample. This is the honest version of the in-sample residual the
   forecast currently reports its interval from.

2. SKILL AGAINST A NAIVE BASELINE. "Tomorrow will be like today" is the thing a
   personal model has to beat to be worth running. If it does not, this says so.
   That is the entire point of building this: a validation layer that can only
   return good news is decoration, not validation.

3. INTERVAL CALIBRATION. An 80% interval should contain the truth about 80% of
   the time. Measuring it found that it did not - see conformal_half_width().

Nothing here is persisted, and nothing about it is user-specific beyond the rows
in the request, exactly like every other model in this service.
"""

import numpy as np

from .confidence import MIN_FOR_VALIDATION, tier_for_model
from .features import Episode, build_matrix, complete_count
from .forecast import (
    FORECAST_FEATURES,
    MIN_INTERVAL_HALF_WIDTH,
    ROWS_PER_FEATURE,
    _fit_ridge,
)

# Fewest training rows before the first fold. Below this the fitted model is not
# the same object the app would actually serve, so scoring it teaches us nothing
# about the thing users see.
MIN_TRAIN = 6

# Fewest scored folds before an average means anything. Two out-of-sample errors
# do not establish an error rate.
MIN_FOLDS = 5

# Upper bound on refits per request. Each fold is a handful of microseconds, but
# a 1000-row payload should not be able to turn a fast request into a timeout on
# a shared free-tier CPU. Beyond this the origins are strided.
MAX_FOLDS = 60

# The coverage the interval aims for. Not 95%: at these sample sizes a 95% band
# on a 0-54 scale is so wide it stops being informative, and a band that always
# contains the answer tells the user nothing either.
TARGET_COVERAGE = 0.80


def _fold_origins(n_pairs: int) -> list[int]:
    """Indices to score, capped so a huge history cannot blow the time budget."""
    origins = list(range(MIN_TRAIN, n_pairs))
    if len(origins) <= MAX_FOLDS:
        return origins
    # Even stride across the whole history rather than the most recent MAX_FOLDS:
    # scoring only the tail would measure the model on its best-informed period
    # and flatter it.
    picks = np.linspace(0, len(origins) - 1, MAX_FOLDS).round().astype(int)
    return [origins[i] for i in sorted(set(picks.tolist()))]


def _predict_from(x_train, y_train, x_row):
    """Fit on the training slice and predict one row. None if it cannot."""
    if len(y_train) < MIN_TRAIN:
        return None
    coefs, y_mean, mu, sigma = _fit_ridge(x_train, y_train)
    value = float(y_mean + ((x_row - mu) / sigma) @ coefs)
    if not np.isfinite(value):
        return None
    return float(np.clip(value, 0.0, 54.0))


def walk_forward(episodes: list[Episode]) -> dict:
    """One-step-ahead errors for the model and for the naive baseline."""
    # Score the model on the feature set it would actually use for this user,
    # picked the same way forecast() picks it.
    keys = FORECAST_FEATURES
    for cutoff in range(len(FORECAST_FEATURES), 0, -1):
        candidate = FORECAST_FEATURES[:cutoff]
        _x, y, _nights = build_matrix(episodes, candidate)
        if len(y) >= max(4, int(np.ceil(len(candidate) * ROWS_PER_FEATURE))):
            keys = candidate
            break

    x, y, nights = build_matrix(episodes, keys)
    n_pairs = len(y)
    if n_pairs < MIN_TRAIN + MIN_FOLDS:
        return {"folds": 0, "errors": [], "naive": [], "nights": []}

    # The naive baseline needs today's burden to predict tomorrow's. It is a
    # fitted feature, so it is always present in the matrix.
    try:
        burden_col = keys.index("symptomBurden")
    except ValueError:
        burden_col = None

    errors, naive, used = [], [], []
    for t in _fold_origins(n_pairs):
        predicted = _predict_from(x[:t], y[:t], x[t])
        if predicted is None:
            continue
        errors.append(abs(predicted - float(y[t])))
        if burden_col is not None:
            naive.append(abs(float(x[t, burden_col]) - float(y[t])))
        used.append(nights[t])

    return {"folds": len(errors), "errors": errors, "naive": naive, "nights": used}


def conformal_half_width(
    episodes: list[Episode], target: float = TARGET_COVERAGE
) -> float | None:
    """Interval half-width from out-of-sample errors, not in-sample residuals.

    This replaces a multiplier applied to the in-sample residual spread. That
    approach was measured by simulation and does not deliver what it claims: the
    `good` tier's 1.28, documented as "~80%", produced about 51% empirical
    coverage. The most-confident tier was handing out the least honest interval,
    which is precisely backwards.

    Split-conformal instead: take the quantile of the model's actual
    one-step-ahead errors, with the finite-sample correction ceil((n+1)*q)/n.
    Distribution-free, assumes only that tomorrow looks like the recent past,
    and it is the *same* quantity the honesty card reports - so the interval and
    the accuracy claim can never disagree.

    Returns None when there are too few folds, and the caller keeps its existing
    behaviour rather than showing a band built on three numbers.
    """
    result = walk_forward(episodes)
    errors = result["errors"]
    if len(errors) < MIN_FOLDS:
        return None

    ordered = np.sort(np.asarray(errors, dtype=float))
    rank = int(np.ceil((len(ordered) + 1) * target))
    if rank > len(ordered):
        # Asking for a quantile this sample cannot support. Widest observed
        # error is the honest answer rather than an extrapolated one.
        half = float(ordered[-1])
    else:
        half = float(ordered[rank - 1])

    if not np.isfinite(half):
        return None
    return max(half, MIN_INTERVAL_HALF_WIDTH)


def _statement(skill: float | None, beats: bool | None, folds: int) -> str:
    """Plain language, including when the news is bad."""
    if beats is None:
        return (
            f"MyLumi re-checked its forecast against {folds} of your past nights."
        )
    if beats:
        percent = round((skill or 0.0) * 100)
        return (
            f"Tested on {folds} of your own nights, MyLumi's forecast was about "
            f"{percent}% closer than simply assuming tomorrow matches today."
        )
    return (
        f"Tested on {folds} of your own nights, MyLumi's forecast was no better "
        "than assuming tomorrow matches today. That is why the range matters "
        "more than the single number."
    )


def validate(episodes: list[Episode]) -> dict:
    """Grade the forecast on this user's own history."""
    n_complete = complete_count(episodes)
    result = walk_forward(episodes)
    folds = result["folds"]

    if folds < MIN_FOLDS:
        return {
            "available": False,
            "reason": (
                "MyLumi needs a few more back-to-back nights before it can "
                "check its own forecasts."
            ),
            "confidence": "none",
            "nDays": n_complete,
            "folds": folds,
            "modelError": None,
            "naiveError": None,
            "skillScore": None,
            "beatsNaive": None,
            "coverage": None,
            "targetCoverage": TARGET_COVERAGE,
            "statement": None,
        }

    errors = np.asarray(result["errors"], dtype=float)
    model_error = float(errors.mean())

    naive_error = skill = None
    beats = None
    if len(result["naive"]) == len(errors) and len(errors):
        naive = np.asarray(result["naive"], dtype=float)
        naive_error = float(naive.mean())
        if naive_error > 1e-9:
            skill = float(1.0 - model_error / naive_error)
            beats = bool(model_error < naive_error)

    # Coverage of the interval this model would actually emit. Computed from the
    # same errors, so a user cannot be shown a coverage figure that describes a
    # different band from the one on their prediction card.
    half = conformal_half_width(episodes)
    coverage = None
    if half is not None:
        coverage = float(np.mean(errors <= half))

    values = [model_error, naive_error, skill, coverage]
    if not all(v is None or np.isfinite(v) for v in values):
        return {
            "available": False,
            "reason": "MyLumi could not grade its forecast on these nights.",
            "confidence": "none",
            "nDays": n_complete,
            "folds": folds,
            "modelError": None,
            "naiveError": None,
            "skillScore": None,
            "beatsNaive": None,
            "coverage": None,
            "targetCoverage": TARGET_COVERAGE,
            "statement": None,
        }

    return {
        "available": True,
        "reason": None,
        "confidence": tier_for_model(n_complete, MIN_FOR_VALIDATION),
        "nDays": n_complete,
        "folds": folds,
        "modelError": round(model_error, 2),
        "naiveError": None if naive_error is None else round(naive_error, 2),
        "skillScore": None if skill is None else round(skill, 3),
        "beatsNaive": beats,
        "coverage": None if coverage is None else round(coverage, 3),
        "targetCoverage": TARGET_COVERAGE,
        "statement": _statement(skill, beats, folds),
    }
