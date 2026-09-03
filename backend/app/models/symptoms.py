"""Per-symptom structure across the 9 PCSS items.

Until now every model in this service collapsed the nine items into a single
`symptomBurden` number. The items themselves crossed the wire on every request
and nothing read them - nine per-symptom clinical scores transmitted and
discarded. This file is what makes collecting them worth the user's time.

Two models, both built on the same matrix:

1. COMPOSITION SHIFT - after a short night, does a larger SHARE of the same
   burden show up as particular symptoms? Composition rather than raw scores is
   the whole point: raw scores on a bad day are all high, so comparing them only
   rediscovers "bad days are bad". Comparing shares asks a different and much
   more useful question - not "how bad", but "bad in what way".

2. RECOVERY RATES - which symptoms are actually resolving, and which are not
   moving? Theil-Sen rather than least squares, matching the rank-based
   philosophy in correlation.py: these are ordinal 0-6 self-reports, and one
   catastrophic day must not swing the slope.

Both run 9 simultaneous tests, which is a bigger multiple-comparison surface
than correlation.py's four. Holm-Bonferroni is not optional here. A patient
told "your brain fog is not improving" on the strength of noise is a real harm.

Deliberately NOT here: a PCA over the items. It was built and measured, and on
symptom data one component (overall severity) explains ~80% of the variance
while the second is not distinguishable from noise by parallel analysis at the
sample sizes this app has. Reporting a second axis anyway would be inventing a
pattern. The composition model answers the same question honestly.
"""

import numpy as np
from scipy import stats

from .confidence import MIN_FOR_RATES, tier_for_model
from .features import (
    SYMPTOM_KEYS,
    SYMPTOM_LABELS,
    Episode,
    symptom_matrix,
)

ALPHA = 0.05

# Fewest nights on each side of the short-sleep split. Mirrors MIN_PER_SIDE in
# correlation.py - a share difference computed from two nights is not a finding.
MIN_PER_SIDE = 4

# The quantile of the user's own sleep that counts as a short night. Their own
# distribution, never an absolute hours figure: "short" for someone who
# habitually sleeps 9 hours is not short for someone who sleeps 6.
SHORT_SLEEP_QUANTILE = 0.35

# Smallest share difference worth a sentence, in percentage points. Below this
# the finding is real but too small to act on, and saying it anyway trains
# people to ignore the card.
MIN_SHARE_SHIFT_PP = 2.0

# Slope smaller than this (0-6 points per week) is not worth reporting even when
# it is statistically distinguishable from zero.
MIN_WEEKLY_SLOPE = 0.05

MAX_FINDINGS = 4


def _holm(tested: list[tuple]) -> list[tuple]:
    """Holm-Bonferroni step-down. Items are (..., p) with p last.

    Same shape as the loop in correlation.py, deliberately: this project applies
    one multiple-comparison discipline, not a different one per file.
    """
    ordered = sorted(tested, key=lambda t: t[-1])
    m = len(ordered)
    surviving = []
    for i, item in enumerate(ordered):
        if item[-1] <= ALPHA / (m - i):
            surviving.append(item)
        else:
            break  # everything after a failure is rejected too
    return surviving


def _shares(matrix: np.ndarray) -> np.ndarray:
    """Each night's symptom profile as a fraction of that night's total.

    A night totalling zero (every item rated 0) has no composition to speak of;
    its row is left as zeros and excluded by the caller rather than becoming a
    divide-by-zero.
    """
    totals = matrix.sum(axis=1, keepdims=True)
    safe = np.where(totals < 1e-9, 1.0, totals)
    return matrix / safe


def composition_shift(episodes: list[Episode]) -> list[dict]:
    """Which symptoms take a larger share of the burden after a short night.

    Pairs each day's symptom profile with the PREVIOUS night's sleep, so the
    claim is "on days following short sleep" - the same lagged framing the
    correlation engine uses, and the only one the data supports.
    """
    nights, matrix = symptom_matrix(episodes)
    if len(nights) < MIN_PER_SIDE * 2:
        return []

    position = {ep.nightOf: i for i, ep in enumerate(episodes)}
    prior_sleep = []
    for night in nights:
        i = position[night]
        prior = episodes[i - 1].get("sleepDurationHours") if i > 0 else None
        prior_sleep.append(prior)

    usable = [i for i, v in enumerate(prior_sleep) if v is not None]
    if len(usable) < MIN_PER_SIDE * 2:
        return []

    values = np.asarray([prior_sleep[i] for i in usable], dtype=float)
    shares = _shares(matrix[usable])

    # Drop nights with no symptoms at all - they have no profile to compare.
    nonzero = matrix[usable].sum(axis=1) > 1e-9
    if nonzero.sum() < MIN_PER_SIDE * 2:
        return []
    values, shares = values[nonzero], shares[nonzero]

    if float(np.std(values)) < 1e-9:
        return []  # every night the same length: no split to make

    cut = float(np.quantile(values, SHORT_SLEEP_QUANTILE))
    short = values < cut
    if short.sum() < MIN_PER_SIDE or (~short).sum() < MIN_PER_SIDE:
        return []

    tested = []
    for index, key in enumerate(SYMPTOM_KEYS):
        after_short = shares[short, index]
        after_rest = shares[~short, index]
        # No rank variance at all means there is nothing to test, and
        # mannwhitneyu would raise rather than return a usable p.
        if np.std(after_short) < 1e-12 and np.std(after_rest) < 1e-12:
            continue
        try:
            _, p = stats.mannwhitneyu(after_short, after_rest, alternative="two-sided")
        except ValueError:
            continue
        if not np.isfinite(p):
            continue
        shift_pp = float((after_short.mean() - after_rest.mean()) * 100)
        tested.append((key, shift_pp, float(p)))

    findings = []
    for key, shift_pp, p in _holm(tested):
        if abs(shift_pp) < MIN_SHARE_SHIFT_PP:
            continue
        label = SYMPTOM_LABELS.get(key, key)
        direction = "larger" if shift_pp > 0 else "smaller"
        findings.append(
            {
                "key": key,
                "label": label,
                "shiftPoints": round(shift_pp, 1),
                "direction": direction,
                "pValue": round(p, 4),
                "n": int(len(values)),
                "statement": (
                    f"On days following your shorter nights, {label} makes up a "
                    f"{direction} share of your total symptom burden."
                ),
            }
        )

    findings.sort(key=lambda f: -abs(f["shiftPoints"]))
    return findings[:MAX_FINDINGS]


def recovery_rates(episodes: list[Episode]) -> list[dict]:
    """Per-symptom trend over time, with an honest refusal built in.

    Theil-Sen (median of pairwise slopes) rather than least squares: rank-based,
    robust to one catastrophic day, and `theilslopes` returns a confidence
    interval, which is what lets a symptom whose trend cannot be distinguished
    from flat be reported as exactly that rather than given a direction.

    Trend is measured against `daysSinceInjury` where available and against the
    ordinal night index otherwise, so a user who never entered an injury date
    still gets rates.
    """
    nights, matrix = symptom_matrix(episodes)
    if len(nights) < MIN_FOR_RATES:
        return []

    position = {ep.nightOf: i for i, ep in enumerate(episodes)}
    days = []
    for night in nights:
        value = episodes[position[night]].get("daysSinceInjury")
        days.append(value)
    if any(v is None for v in days):
        # Fall back to elapsed days from the first logged night. Never mix the
        # two - a half-populated injury date would make the axis meaningless.
        days = list(range(len(nights)))
    x = np.asarray(days, dtype=float)

    if float(np.std(x)) < 1e-9:
        return []

    tested = []
    for index, key in enumerate(SYMPTOM_KEYS):
        y = matrix[:, index]
        if float(np.std(y)) < 1e-12:
            # Rated identically every night. Genuinely flat, and kendalltau
            # would return nan on it.
            continue
        tau, p = stats.kendalltau(x, y)
        if not np.isfinite(p):
            continue
        tested.append((key, index, float(p)))

    surviving = {key for key, _index, _p in _holm(tested)}

    rates = []
    for index, key in enumerate(SYMPTOM_KEYS):
        y = matrix[:, index]
        if float(np.std(y)) < 1e-12:
            slope = lo = hi = 0.0
        else:
            try:
                slope, _intercept, lo, hi = stats.theilslopes(y, x, alpha=0.95)
            except (ValueError, ZeroDivisionError):
                continue
        if not all(np.isfinite(v) for v in (slope, lo, hi)):
            continue

        weekly = float(slope) * 7.0
        # A direction needs two things: the symptom survived correction for
        # testing all nine at once, and its interval does not straddle zero.
        #
        # "Does not straddle" rather than "strictly excludes". These are integer
        # 0-6 ratings, so Theil-Sen's interval is built from a discrete set of
        # pairwise slopes and its bound very often lands exactly ON zero - the
        # demo dataset had all nine symptoms at p < 0.01 with clearly negative
        # slopes, and eight of them reported as "not clear yet" purely because a
        # bound was 0.0 rather than -0.01. That is an artefact of the
        # measurement scale, not evidence of uncertainty, and discarding a
        # Holm-surviving result on it throws away the strongest finding the card
        # has. A bound that straddles zero (one end positive, the other
        # negative) still refuses, which is the case that genuinely means "we
        # cannot tell which way".
        straddles_zero = lo < 0 < hi
        decided = (
            key in surviving
            and not straddles_zero
            and abs(weekly) >= MIN_WEEKLY_SLOPE
        )
        if not decided:
            status = "unclear"
        else:
            status = "easing" if weekly < 0 else "worsening"

        rates.append(
            {
                "key": key,
                "label": SYMPTOM_LABELS.get(key, key),
                "weeklyChange": round(weekly, 2),
                "ciLow": round(float(lo) * 7.0, 2),
                "ciHigh": round(float(hi) * 7.0, 2),
                "status": status,
                # Set by _mark_laggards once every rate is known - it is a
                # judgement about this symptom relative to the others, so it
                # cannot be decided while looking at one in isolation.
                "laggard": False,
                "n": int(len(nights)),
            }
        )

    return rates


def symptom_grid(episodes: list[Episode], limit: int = 30) -> dict:
    """The full nights x 9 matrix, for the heatmap.

    The rates and shifts above are summaries OF this. Sending the matrix itself
    lets the UI draw the thing the summaries describe, so a reader can see the
    cognitive band staying dark while the somatic one fades rather than being
    asked to take two sentences on trust. 198 numbers is a picture; nine bars is
    a conclusion.

    Trimmed to the most recent `limit` nights: beyond about a month the cells
    are too narrow to read, and this is the one payload here that grows with
    history.
    """
    nights, matrix = symptom_matrix(episodes)
    if not nights:
        return {"nights": [], "keys": [], "labels": [], "values": []}

    nights = nights[-limit:]
    matrix = matrix[-limit:]
    return {
        "nights": nights,
        "keys": list(SYMPTOM_KEYS),
        "labels": [SYMPTOM_LABELS.get(k, k) for k in SYMPTOM_KEYS],
        # Row per symptom, column per night - the orientation the chart draws in,
        # so the client does no transposing.
        "values": [[float(v) for v in matrix[:, i]] for i in range(len(SYMPTOM_KEYS))],
    }


def _mark_laggards(rates: list[dict]) -> None:
    """Flag symptoms resolving noticeably more slowly than the rest.

    When someone is recovering overall, nearly every symptom trends down and a
    list of nine "easing" rows says almost nothing. The useful question is which
    ones are NOT keeping pace - that is what a patient would raise with a
    clinician, and it is the difference between a card that lists data and one
    that tells them something.

    Relative to the user's own median rate, never to a population norm. Marked
    in place as `laggard`, and only among symptoms whose own trend is decided,
    so this can never promote a noisy estimate into a claim.
    """
    decided = [r for r in rates if r["status"] in ("easing", "worsening")]
    if len(decided) < 4:
        return
    median_rate = float(np.median([r["weeklyChange"] for r in decided]))
    if median_rate >= 0:
        return  # not an overall-improving picture; "lagging" would be meaningless
    for rate in rates:
        if rate["status"] != "easing":
            continue
        # Less than half the typical pace of improvement.
        rate["laggard"] = rate["weeklyChange"] > median_rate * 0.5


def _join(labels: list[str]) -> str:
    """'a', 'a and b', or 'a, b and c'. Never an Oxford comma - see workflow.md."""
    if len(labels) == 1:
        return labels[0]
    if len(labels) == 2:
        return f"{labels[0]} and {labels[1]}"
    return f"{', '.join(labels[:-1])} and {labels[-1]}"


def _summary(shifts: list[dict], rates: list[dict]) -> str | None:
    """One sentence for the top of the card. Descriptive, never a conclusion.

    The most useful thing this model knows is rarely "things are improving" -
    it is WHICH things are and are not. A patient already knows how they feel
    overall; what they cannot see from nine sliders is that three of them have
    not moved in a month. That is also the sentence worth taking to a clinician.
    """
    easing = [r["label"] for r in rates if r["status"] == "easing"]
    laggards = [r["label"] for r in rates if r.get("laggard")]
    # Flat symptoms are only worth naming when the picture around them is
    # genuinely improving - otherwise "these have not shifted" describes
    # everything and says nothing.
    flat = [r["label"] for r in rates if r["status"] == "unclear"]

    if easing and laggards:
        return (
            f"Most of your symptoms have been easing, but your {_join(laggards[:2])} "
            "ratings have come down more slowly than the rest."
        )
    # Both sides need to be a real group. If only one symptom is easing, or
    # every single one is flat, the contrast is not the story.
    if len(easing) >= 2 and len(flat) >= 2:
        return (
            f"Your {_join(easing[:2])} ratings have been coming down, while your "
            f"{_join(flat[:3])} have stayed about the same."
        )
    if len(easing) >= 2:
        return f"Your {_join(easing[:2])} ratings have been coming down."
    if len(easing) == 1:
        return f"Your {easing[0]} ratings have been coming down."
    if shifts:
        return shifts[0]["statement"]
    return None


def analyse(episodes: list[Episode]) -> dict:
    """Per-symptom profile: composition shifts and recovery rates."""
    nights, _matrix = symptom_matrix(episodes)
    n = len(nights)
    tier = tier_for_model(n, MIN_FOR_RATES)

    if n < MIN_FOR_RATES:
        missing = MIN_FOR_RATES - n
        nights_word = "night" if missing == 1 else "nights"
        return {
            "available": False,
            # This model counts nights with ALL NINE items rated, a stricter
            # bar than the burden-and-a-sleep-signal count the other models
            # use. It therefore needs its own copy: `insufficient_reason` would
            # say "complete nights", which reads as "log more" to someone who
            # has logged plenty but skips the symptom section.
            "reason": (
                f"{missing} more {nights_word} with every symptom rated and "
                "MyLumi can look at each one separately."
            ),
            "confidence": "none",
            "nDays": n,
            "shifts": [],
            "rates": [],
            "grid": {"nights": [], "keys": [], "labels": [], "values": []},
            "summary": None,
        }

    shifts = composition_shift(episodes)
    rates = recovery_rates(episodes)
    _mark_laggards(rates)
    grid = symptom_grid(episodes)

    if not shifts and not any(r["status"] != "unclear" for r in rates):
        return {
            "available": False,
            # A clean null is information, and distinct from having no data.
            "reason": (
                "No single symptom stands out yet - yours have been moving "
                "together rather than separately."
            ),
            "confidence": tier,
            "nDays": n,
            "shifts": [],
            "rates": rates,
            "grid": grid,
            "summary": None,
        }

    return {
        "available": True,
        "reason": None,
        "confidence": tier,
        "nDays": n,
        "shifts": shifts,
        "rates": rates,
        "grid": grid,
        "summary": _summary(shifts, rates),
    }
