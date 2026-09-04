"""Anomaly detection over symptom burden.

Median/MAD rather than mean/SD, for a specific reason: concussion recovery data
contains genuine bad days, and a mean-based threshold lets one very bad day
inflate the spread enough to hide the next one. The robust estimator keeps
flagging what it should.

Framing matters as much as the maths here. An unusual day is surfaced as "worth
noting", never as an alarm and never as a setback diagnosis. A statistical
outlier in nine self-reported numbers is not a clinical event, and MyLumi must
not imply it is. Genuine red-flag escalation is a separate, rule-based, local
feature (Phase 4) that never depends on this service being reachable.
"""

import numpy as np

from .confidence import has_enough, insufficient_reason, tier_for
from .features import Episode, burden_series, complete_count

# 1.4826 makes MAD a consistent estimator of sigma for normal data, so the score
# below is interpretable on the same scale as a z-score.
MAD_TO_SIGMA = 1.4826

THRESHOLD = 2.5  # conservative - we would rather miss one than cry wolf
MIN_POINTS = 7
RECENT_WINDOW = 14  # only surface anomalies the user can still remember


def detect(episodes: list[Episode]) -> dict:
    n_complete = complete_count(episodes)
    tier = tier_for(n_complete)

    if not has_enough(n_complete):
        return {
            "available": False,
            "reason": insufficient_reason(n_complete),
            "confidence": "none",
            "nDays": n_complete,
            "anomalies": [],
        }

    nights, values = burden_series(episodes)
    if len(values) < MIN_POINTS:
        return {
            "available": False,
            "reason": "Not enough logged nights yet to know what is unusual for you.",
            "confidence": tier,
            "nDays": n_complete,
            "anomalies": [],
        }

    median = float(np.median(values))
    mad = float(np.median(np.abs(values - median)))
    scale = mad * MAD_TO_SIGMA

    if not np.isfinite(scale) or scale < 1e-9:
        # Every night identical (or a spread too extreme to be a real number).
        # Nothing is unusual, and saying "no anomalies" is the correct answer
        # rather than a failure.
        return {
            "available": True,
            "reason": None,
            "confidence": tier,
            "nDays": n_complete,
            "anomalies": [],
        }

    anomalies = []
    for night, value in zip(nights[-RECENT_WINDOW:], values[-RECENT_WINDOW:]):
        score = (value - median) / scale
        # A value large enough to overflow the subtraction gives inf, and
        # inf/inf gives NaN - which serialises to nothing JSON can express, so
        # it used to leave this function fine and crash the response encoder
        # instead. Skipping it is also the honest answer: a score we cannot
        # compute is not evidence that the night was unusual.
        if not np.isfinite(score):
            continue
        if abs(score) < THRESHOLD:
            continue
        worse = score > 0
        anomalies.append(
            {
                "nightOf": night,
                "burden": round(float(value), 1),
                "score": round(float(abs(score)), 1),
                "direction": "worse" if worse else "better",
                "note": (
                    "This day stands out as heavier than your usual pattern. "
                    "Worth noting, especially if it repeats."
                    if worse
                    else "This day stands out as lighter than your usual pattern."
                ),
            }
        )

    anomalies.sort(key=lambda a: -a["score"])

    return {
        "available": True,
        "reason": None,
        "confidence": tier,
        "nDays": n_complete,
        "anomalies": anomalies[:3],
    }
