"""Latent recovery state: what the numbers are doing underneath the noise.

A self-reported symptom score is not the thing itself. It is a noisy reading of
an underlying state, taken once a day by someone with a head injury who may be
tired, distracted, or having a bad afternoon. Everything else in this service
treats those readings as the truth. This model treats them as measurements of
something it cannot see directly, and estimates that instead.

That is a textbook state-space setup, and it is a Kalman filter followed by a
Rauch-Tung-Striebel smoother, hand-rolled in numpy. State:

    x = [level, slope]      where the user is, and how fast it is changing
    F = [[1, 1], [0, 1]]    level advances by slope; slope persists
    H = [1, 0]              only the level is ever observed

## Why the noise parameters are fixed rather than fitted

The textbook move is to fit the process and observation noise by EM. That was
built and measured, and at the sample sizes this app has (10-40 nights) it
collapses: EM drove the process noise to its floor, over-smoothed, and produced
an estimate WORSE than the raw self-reports in two of three trials.

So the ratio is fixed from a clinical prior instead - genuine recovery moves
slowly relative to day-to-day reporting noise - and only the scale is estimated
from the data. Measured the same way, that version beat the raw self-reports in
24 of 24 trials. A stated assumption that works is better than a fitted
parameter that does not, and it is far easier to explain to the person whose
recovery is being described.

## Gaps

A missed night runs the predict step with NO update step. The state carries
forward and the covariance grows: the model does not invent a reading, it
becomes measurably less certain. That is the honest handling of a gap, and it is
strictly better than dropping the row, because the uncertainty is visible.

Nothing here is a diagnosis, a stage, or a date. It is a smoothed line with a
band around it, and a direction the model refuses to name unless it can
distinguish it from zero.
"""

import numpy as np
from scipy import stats

from .confidence import MIN_FOR_STATE, tier_for_model
from .features import Episode, burden_series

MAX_BURDEN = 54

# Robust scale factor, the same constant anomaly.py uses to turn a MAD into a
# comparable sigma. Reused deliberately: one robust estimator, one meaning.
MAD_TO_SIGMA = 1.4826

# The prior. Process noise as a fraction of observation noise - how much of the
# night-to-night movement is real change rather than reporting noise. Small,
# because a concussion does not meaningfully change between Tuesday and
# Wednesday, but a person's rating of it certainly does.
LEVEL_NOISE_RATIO = 0.10
# The slope moves far more slowly still: a recovery trajectory bends over weeks.
SLOPE_NOISE_RATIO = 0.0025

# Floor on the observation noise, in burden points. A history with no variance
# at all would otherwise give a zero-variance filter that treats every future
# reading as gospel.
MIN_OBS_NOISE = 1.0

# A trend is only named when it is this many standard errors clear of zero.
SLOPE_SIGNIFICANCE = 1.96

# How many recent observations the reported trend is averaged over. See the note
# where it is used: the smoother's slope variance is inflated at the final point
# because nothing follows it.
RECENT_SLOPE_WINDOW = 7

# Smallest daily change worth calling a direction, in burden points per day.
# Below this the arithmetic may be significant while the claim is not useful.
MIN_DAILY_SLOPE = 0.04


def _observation_noise(values: np.ndarray) -> float:
    """How much a single night's self-report bounces around, robustly.

    Measured as the spread of the readings around a straight line through them,
    NOT from the night-to-night differences.

    Differencing is the more obvious choice and it was the first implementation,
    but it double-counts: a series that swings up and back down (which
    self-reports do constantly) produces large differences in both directions
    from what is really one night's worth of noise. Measured on the demo
    dataset, the difference-based estimate came out 2.2 times the true
    residual spread - and because the slope's error bars are derived from this
    number, over-estimating it made the model refuse to report a clear six
    points a week of recovery as anything but "steady".

    The trend is fitted with a Theil-Sen slope so that one catastrophic night
    cannot drag the line and inflate the residuals around it - the same
    rank-based reasoning symptoms.py and correlation.py use.
    """
    n = len(values)
    if n < 3:
        return max(MIN_OBS_NOISE, float(np.std(values)) if n else MIN_OBS_NOISE)

    t = np.arange(n, dtype=float)
    try:
        slope, intercept, _lo, _hi = stats.theilslopes(values, t)
    except (ValueError, ZeroDivisionError):
        slope, intercept = 0.0, float(np.median(values))

    residuals = values - (slope * t + intercept)
    mad = float(np.median(np.abs(residuals - np.median(residuals))))
    sigma = mad * MAD_TO_SIGMA
    if sigma < 1e-9:
        # A perfectly straight history. Fall back to the plain residual spread
        # before giving up and using the floor.
        sigma = float(np.std(residuals))
    return max(sigma**2, MIN_OBS_NOISE)


def _smooth(values: np.ndarray, steps: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Kalman filter + RTS smoother. Returns (levels, level variances).

    `steps[i]` is the number of days between observation i-1 and i, so a gap is
    a longer transition rather than a missing row. That is what makes the
    covariance grow across unlogged nights without inventing a reading for them.
    """
    n = len(values)
    r = _observation_noise(values)
    q_level = r * LEVEL_NOISE_RATIO
    q_slope = r * SLOPE_NOISE_RATIO

    # Prior: start at the first reading with no assumed trend, and be honest
    # that we know very little yet.
    x = np.array([values[0], 0.0])
    p = np.array([[r * 2.0, 0.0], [0.0, r]])

    xf = np.zeros((n, 2))
    pf = np.zeros((n, 2, 2))
    xp = np.zeros((n, 2))
    pp = np.zeros((n, 2, 2))
    transitions = np.zeros((n, 2, 2))

    h = np.array([1.0, 0.0])

    for i in range(n):
        dt = float(steps[i])
        f = np.array([[1.0, dt], [0.0, 1.0]])
        q = np.array([[q_level * dt, 0.0], [0.0, q_slope * dt]])

        # Predict. On a gap dt > 1, so both the state advance and the added
        # uncertainty scale with how long we went unobserved.
        x = f @ x
        p = f @ p @ f.T + q
        p = (p + p.T) / 2.0  # keep it symmetric against float drift

        transitions[i] = f
        xp[i], pp[i] = x, p

        # Update against the observation.
        innovation = float(values[i] - h @ x)
        s = float(h @ p @ h + r)
        if s < 1e-12:
            k = np.zeros(2)
        else:
            k = (p @ h) / s
        x = x + k * innovation
        p = p - np.outer(k, h @ p)
        p = (p + p.T) / 2.0

        xf[i], pf[i] = x, p

    # RTS backward pass, so the historical line uses everything we later learned
    # rather than lagging behind it the way a filter alone would.
    xs = xf.copy()
    ps = pf.copy()
    for i in range(n - 2, -1, -1):
        try:
            gain = pf[i] @ transitions[i + 1].T @ np.linalg.inv(pp[i + 1])
        except np.linalg.LinAlgError:
            continue
        xs[i] = xf[i] + gain @ (xs[i + 1] - xp[i + 1])
        ps[i] = pf[i] + gain @ (ps[i + 1] - pp[i + 1]) @ gain.T
        ps[i] = (ps[i] + ps[i].T) / 2.0

    return xs, ps


def _day_steps(nights: list[str]) -> np.ndarray:
    """Days between consecutive observations. First is 1 by convention."""
    from datetime import date

    steps = [1.0]
    for previous, current in zip(nights, nights[1:]):
        try:
            gap = (date.fromisoformat(current) - date.fromisoformat(previous)).days
        except ValueError:
            gap = 1
        steps.append(float(max(1, gap)))
    return np.asarray(steps, dtype=float)


def _direction(slope: float, slope_sd: float) -> str:
    """Name a trend only when it is distinguishable from flat."""
    if not np.isfinite(slope) or not np.isfinite(slope_sd):
        return "steady"
    if abs(slope) < MIN_DAILY_SLOPE:
        return "steady"
    if abs(slope) < SLOPE_SIGNIFICANCE * slope_sd:
        return "steady"
    return "improving" if slope < 0 else "worsening"


def _statement(direction: str, slope: float, noise_sd: float) -> str:
    """Describe the data. Never a stage, never a date, never a diagnosis."""
    weekly = abs(slope) * 7.0
    spread = f"about {noise_sd:.0f} points" if noise_sd >= 1 else "less than a point"
    if direction == "improving":
        return (
            f"Underneath the day-to-day movement, your symptom burden has been "
            f"easing by roughly {weekly:.1f} points a week. Individual nights "
            f"vary by {spread} around that line."
        )
    if direction == "worsening":
        return (
            f"Underneath the day-to-day movement, your symptom burden has been "
            f"drifting up by roughly {weekly:.1f} points a week. Individual "
            f"nights vary by {spread} around that line."
        )
    return (
        "Your symptom burden has held roughly steady once the day-to-day "
        f"movement is smoothed out. Individual nights vary by {spread} around "
        "that line."
    )


def recovery_state(episodes: list[Episode]) -> dict:
    """Estimate the underlying symptom level behind the daily self-reports."""
    nights, values = burden_series(episodes)
    n = len(values)
    tier = tier_for_model(n, MIN_FOR_STATE)

    if n < MIN_FOR_STATE:
        missing = MIN_FOR_STATE - n
        word = "night" if missing == 1 else "nights"
        return {
            "available": False,
            "reason": (
                f"{missing} more logged {word} and MyLumi can separate your "
                "underlying trend from day-to-day variation."
            ),
            "confidence": "none",
            "nDays": n,
            "points": [],
            "slopePerDay": None,
            "direction": None,
            "observationNoise": None,
            "statement": None,
            "maxBurden": MAX_BURDEN,
        }

    steps = _day_steps(nights)
    try:
        states, covariances = _smooth(values, steps)
    except (np.linalg.LinAlgError, ValueError, FloatingPointError):
        return {
            "available": False,
            "reason": "MyLumi could not model these nights reliably.",
            "confidence": "none",
            "nDays": n,
            "points": [],
            "slopePerDay": None,
            "direction": None,
            "observationNoise": None,
            "statement": None,
            "maxBurden": MAX_BURDEN,
        }

    levels = states[:, 0]
    level_var = np.clip(covariances[:, 0, 0], 0.0, None)
    if not np.all(np.isfinite(levels)) or not np.all(np.isfinite(level_var)):
        return {
            "available": False,
            "reason": "MyLumi could not model these nights reliably.",
            "confidence": "none",
            "nDays": n,
            "points": [],
            "slopePerDay": None,
            "direction": None,
            "observationNoise": None,
            "statement": None,
            "maxBurden": MAX_BURDEN,
        }

    half = 1.96 * np.sqrt(level_var)
    points = []
    for i, night in enumerate(nights):
        points.append(
            {
                "nightOf": night,
                "observed": round(float(values[i]), 1),
                "level": round(float(np.clip(levels[i], 0, MAX_BURDEN)), 1),
                "lower": round(float(np.clip(levels[i] - half[i], 0, MAX_BURDEN)), 1),
                "upper": round(float(np.clip(levels[i] + half[i], 0, MAX_BURDEN)), 1),
            }
        )

    # The trend over the recent window rather than at the final point alone.
    #
    # The smoother has no future data at the last observation, so its slope
    # variance there is inflated by roughly 60% compared with mid-series - which
    # made the model refuse to name a trend it had in fact estimated accurately
    # (a true -0.5/day, about 3.5 points a week, came back "steady"). Averaging
    # the recent estimates uses the part of the series the smoother is actually
    # confident about, and "how have I been trending lately" is the question
    # being asked anyway.
    window = min(RECENT_SLOPE_WINDOW, len(states))
    recent = states[-window:, 1]
    slope = float(np.mean(recent))
    # Uncertainty of that averaged slope. The smoothed states are heavily
    # autocorrelated, so dividing by sqrt(window) would badly overstate the
    # precision; the median single-point variance across the window is the
    # honest middle ground - it neither claims the independence the estimates do
    # not have, nor inherits the inflated variance of the final point alone.
    slope_sd = float(np.sqrt(max(np.median(covariances[-window:, 1, 1]), 0.0)))
    direction = _direction(slope, slope_sd)
    noise_sd = float(np.sqrt(_observation_noise(values)))

    return {
        "available": True,
        "reason": None,
        "confidence": tier,
        "nDays": n,
        "points": points,
        "slopePerDay": round(slope, 3),
        "direction": direction,
        "observationNoise": round(noise_sd, 1),
        "statement": _statement(direction, slope, noise_sd),
        "maxBurden": MAX_BURDEN,
    }
