"""Confidence tiers — the thing that keeps the app honest.

Every model routes its "do I have enough data to speak?" decision through here,
so there is one place where that judgement lives and one place to argue with.

Thresholds come from MyLumi_Plan.md 3.3e (models cannot say anything meaningful
before ~7 days) and the "14 days logged - your model is now personalized"
milestone.

The important tier is `none`. It does not mean "predict with low confidence" —
it means emit no number at all. A prediction from four nights of data would look
exactly as authoritative as one from forty, and the user has no way to tell them
apart. Withholding is the only honest option.
"""

from typing import Literal

Confidence = Literal["none", "low", "moderate", "good"]

MIN_FOR_ANY_INSIGHT = 7
MIN_FOR_MODERATE = 14
MIN_FOR_GOOD = 21


def tier_for(n: int) -> Confidence:
    """Complete episodes -> confidence tier."""
    if n < MIN_FOR_ANY_INSIGHT:
        return "none"
    if n < MIN_FOR_MODERATE:
        return "low"
    if n < MIN_FOR_GOOD:
        return "moderate"
    return "good"


def has_enough(n: int) -> bool:
    return tier_for(n) != "none"


def insufficient_reason(n: int) -> str:
    """Plain-language explanation the UI can show verbatim.

    Phrased as a statement about the data, not about the user. "You haven't
    logged enough" reads as a reprimand to someone with a head injury; "we need
    N more nights" is the same fact without the blame.
    """
    missing = MIN_FOR_ANY_INSIGHT - n
    if missing == 1:
        return "One more complete night and MyLumi can start looking for patterns."
    return f"{missing} more complete nights and MyLumi can start looking for patterns."


# Prediction intervals widen at lower tiers. These multiply the residual spread,
# so a model fit on 7 nights advertises its own uncertainty rather than hiding it
# behind a tight-looking band.
INTERVAL_WIDENING = {
    "low": 2.0,
    "moderate": 1.5,
    "good": 1.28,  # ~80% under a normal assumption
}
