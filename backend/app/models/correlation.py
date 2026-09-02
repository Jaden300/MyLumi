"""Personal sleep-symptom correlation.

The headline feature (MyLumi_Plan.md 3.3c). Target output, quoted from the plan:

    "Your symptom burden rises sharply on days following under 6.5 hours of sleep."

Spearman rather than Pearson: the inputs are ordinal 0-6 self-reports, not
interval measurements, and rank correlation is robust to the one catastrophic
night that would otherwise drag a Pearson coefficient around.

The hard part of this file is not the statistics, it is the restraint. With 9
symptoms and a dozen sleep metrics there are enough pairs that something will
look significant by chance. Everything below is built to avoid promoting noise
into a confident sentence a patient might act on.
"""

from typing import Optional

import numpy as np
from scipy import stats

from .confidence import has_enough, insufficient_reason, tier_for
from .features import FEATURE_LABELS, Episode, complete_count, paired_series

# Sleep and evening features plausibly upstream of tomorrow's symptoms. Kept
# deliberately short: fewer tests, fewer false positives, and every one of these
# is something the user could actually act on.
CANDIDATES = [
    "sleepDurationHours",
    "sleepQuality",
    "awakenings",
    "preSleepStress",
]

MIN_PAIRS = 7
ALPHA = 0.05
MIN_ABS_RHO = 0.4  # below this, an association is too weak to be worth a sentence
MIN_PER_SIDE = 3  # a threshold split needs real data on both sides
MAX_FINDINGS = 3


def _threshold_split(x: np.ndarray, y: np.ndarray) -> Optional[dict]:
    """Find a cut point where burden differs most sharply either side.

    This is what turns a coefficient into the quotable sentence. It is also the
    easiest place in the whole app to manufacture a compelling lie, so:
      - both sides need MIN_PER_SIDE observations,
      - the gap is checked with Mann-Whitney (non-parametric, tiny samples),
      - and candidate cut points come from the user's own quartiles, not from a
        scan of every value, which would be free to overfit to one bad night.
    """
    if len(x) < MIN_PER_SIDE * 2:
        return None

    best = None
    for q in (0.25, 0.375, 0.5, 0.625, 0.75):
        cut = float(np.quantile(x, q))
        below = y[x < cut]
        above = y[x >= cut]
        if len(below) < MIN_PER_SIDE or len(above) < MIN_PER_SIDE:
            continue
        gap = float(np.median(below) - np.median(above))
        if abs(gap) < 3.0:  # < 3 points of 54 is not "sharply"
            continue
        try:
            _, p = stats.mannwhitneyu(below, above, alternative="two-sided")
        except ValueError:
            continue
        if p > ALPHA:
            continue
        if best is None or abs(gap) > abs(best["gap"]):
            best = {
                "cut": cut,
                "gap": gap,
                "p": float(p),
                "belowMedian": float(np.median(below)),
                "aboveMedian": float(np.median(above)),
            }
    return best


def _phrase(feature: str, rho: float) -> str:
    """Association, never causation.

    "on days following" is load-bearing. "caused by" or "because of" would be an
    unsupported clinical claim from a correlation on a few dozen self-reports.
    """
    label = FEATURE_LABELS.get(feature, feature)
    strength = "strongly" if abs(rho) >= 0.6 else "moderately"
    # rho is the association between the feature and the FOLLOWING day's burden.
    # rho > 0: more of this feature goes with a heavier next day.
    # Say it in terms of more/less of the raw measure rather than "better" or
    # "worse" — for sleep duration "better" is ambiguous (longer? more regular?),
    # and pairing a direction word with a quality word is how this sentence came
    # out exactly backwards the first time.
    more = "more" if feature != "sleepQuality" else "higher"
    less = "less" if feature != "sleepQuality" else "lower"
    if rho > 0:
        return f"Your symptom burden tends to be {strength} higher on days following {more} {label}."
    return f"Your symptom burden tends to be {strength} higher on days following {less} {label}."


def _threshold_phrase(feature: str, split: dict) -> str:
    label = FEATURE_LABELS.get(feature, feature)
    cut = split["cut"]
    worse_below = split["gap"] > 0
    if feature == "sleepDurationHours":
        value = f"{cut:.1f} hours"
    elif feature == "awakenings":
        value = f"{cut:.0f} awakenings"
    else:
        value = f"{cut:.1f}"
    side = "under" if worse_below else "over"
    points = abs(split["gap"])
    return (
        f"On days following {side} {value} of {label}, your symptom burden runs "
        f"about {points:.0f} points higher."
    )


def correlate(episodes: list[Episode]) -> dict:
    n_complete = complete_count(episodes)
    tier = tier_for(n_complete)

    if not has_enough(n_complete):
        return {
            "available": False,
            "reason": insufficient_reason(n_complete),
            "confidence": "none",
            "nDays": n_complete,
            "findings": [],
        }

    # Test every candidate first, then correct for multiple comparisons before
    # deciding what to report. Testing 4 features at p<0.05 independently means
    # roughly a 1-in-5 chance of at least one false positive per user, and
    # measured on pure-noise data it was far worse than that — around half of
    # noise datasets produced a "finding". A patient being told their stress
    # predicts their symptoms, on the strength of noise, is exactly the failure
    # this project cannot afford.
    tested = []
    for feature in CANDIDATES:
        x, y = paired_series(episodes, feature)
        if len(x) < MIN_PAIRS:
            continue
        # All-identical answers have no rank variance; spearmanr returns nan and
        # a "correlation" here would be pure artefact.
        if np.std(x) < 1e-9 or np.std(y) < 1e-9:
            continue

        rho, p = stats.spearmanr(x, y)
        if not np.isfinite(rho) or not np.isfinite(p):
            continue
        tested.append((feature, float(rho), float(p), x, y))

    # Holm-Bonferroni: sort by p, require p_i <= alpha / (m - i). Uniformly more
    # powerful than plain Bonferroni, so genuine strong effects still survive
    # while isolated noise does not.
    tested.sort(key=lambda t: t[2])
    m = len(tested)
    surviving = []
    for i, item in enumerate(tested):
        if item[2] <= ALPHA / (m - i):
            surviving.append(item)
        else:
            break  # Holm stops at the first failure — everything after is rejected too

    findings = []
    for feature, rho, p, x, y in surviving:
        if abs(rho) < MIN_ABS_RHO:
            continue

        finding = {
            "feature": feature,
            "label": FEATURE_LABELS.get(feature, feature),
            "rho": round(float(rho), 2),
            "pValue": round(float(p), 4),
            "n": int(len(x)),
            "direction": "higher" if rho > 0 else "lower",
            "statement": _phrase(feature, float(rho)),
            "threshold": None,
            "thresholdStatement": None,
        }

        split = _threshold_split(x, y)
        if split is not None:
            finding["threshold"] = round(split["cut"], 2)
            finding["thresholdStatement"] = _threshold_phrase(feature, split)

        findings.append(finding)

    findings.sort(key=lambda f: -abs(f["rho"]))
    findings = findings[:MAX_FINDINGS]

    if not findings:
        return {
            "available": False,
            # Genuinely different from "not enough data", and worth saying: a
            # clean null result is information, and pretending otherwise would
            # push us toward reporting noise to fill the card.
            "reason": "No clear sleep-symptom pattern has emerged in your data yet.",
            "confidence": tier,
            "nDays": n_complete,
            "findings": [],
        }

    return {
        "available": True,
        "reason": None,
        "confidence": tier,
        "nDays": n_complete,
        "findings": findings,
    }
