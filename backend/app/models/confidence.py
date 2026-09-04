"""Confidence tiers - the thing that keeps the app honest.

Every model routes its "do I have enough data to speak?" decision through here,
so there is one place where that judgement lives and one place to argue with.

Thresholds come from MyLumi_Plan.md 3.3e (models cannot say anything meaningful
before ~7 days) and the "14 days logged - your model is now personalized"
milestone.

The important tier is `none`. It does not mean "predict with low confidence" -
it means emit no number at all. A prediction from four nights of data would look
exactly as authoritative as one from forty, and the user has no way to tell them
apart. Withholding is the only honest option.
"""

from typing import Literal

Confidence = Literal["none", "low", "moderate", "good"]

MIN_FOR_ANY_INSIGHT = 7
MIN_FOR_MODERATE = 14
MIN_FOR_GOOD = 21

# Per-model floors. Some models need more data than the 7-night gate before they
# can say anything honest, and asking for more is allowed - the 7 is a minimum
# for the app, not a licence for every model to speak at it.
#
#   STATE  - a slope estimate from 7 points has a standard error wide enough
#            that it would always report "steady". A card that can never say
#            anything is worse than no card.
#   RATES  - 9 simultaneous trend tests need more data than one.
#   AXES   - PCA on 9 variables with fewer observations than variables is
#            degenerate; below this the second component is noise.
#   FOLDS  - enough training rows for a first fit plus enough folds to average.
#   COMPLEX- two metrics over 10-25-token entries, each residualised on entry
#            length before its trend is taken. This is the highest floor in the
#            app because it gates the weakest measurement in it: a direction in
#            how someone writes, from texts short enough that one unusual
#            sentence moves the number. Eighteen is where a rank correlation on
#            residuals stops being dominated by the residualisation itself.
MIN_FOR_STATE = 10
MIN_FOR_RATES = 10
MIN_FOR_AXES = 14
MIN_FOR_VALIDATION = 12
MIN_FOR_COMPLEXITY = 18


def tier_for(n: int) -> Confidence:
    """Complete episodes -> confidence tier."""
    if n < MIN_FOR_ANY_INSIGHT:
        return "none"
    if n < MIN_FOR_MODERATE:
        return "low"
    if n < MIN_FOR_GOOD:
        return "moderate"
    return "good"


def tier_for_model(n: int, floor: int) -> Confidence:
    """Confidence tier for a model whose floor is higher than the app's 7.

    The boundaries scale with the floor. Without this a model needing 14 nights
    would report "good" at 21 - the top tier on only 7 usable observations more
    than its own minimum, and on data with far more dimensions than the forecast
    is working in. Scaling keeps "good" meaning the same thing everywhere: about
    three times the data the model needs to speak at all.
    """
    if floor <= MIN_FOR_ANY_INSIGHT:
        return tier_for(n)
    if n < floor:
        return "none"
    scale = floor / MIN_FOR_ANY_INSIGHT
    if n < MIN_FOR_MODERATE * scale:
        return "low"
    if n < MIN_FOR_GOOD * scale:
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
    if missing <= 0:
        # Called at or above the threshold. There is no shortfall to describe, so
        # do not invent one - an earlier version cheerfully said "0 more complete
        # nights", and "-1 more" once a caller moved.
        return "MyLumi has enough nights to start looking for patterns."
    if missing == 1:
        return "One more complete night and MyLumi can start looking for patterns."
    return f"{missing} more complete nights and MyLumi can start looking for patterns."


# Prediction intervals widen at lower tiers. These multiply the residual spread,
# so a model fit on 7 nights advertises its own uncertainty rather than hiding it
# behind a tight-looking band.
INTERVAL_WIDENING = {
    # `none` should never reach a multiplier - a model at this tier emits no
    # number to put an interval around. It is present so that a lookup can
    # never be the thing that 500s a request: an unwidened band on a model that
    # should not be speaking is a bug, but a KeyError in front of a patient is a
    # worse one. Widest value, so the failure mode is visible uncertainty.
    "none": 2.5,
    "low": 2.0,
    "moderate": 1.5,
    "good": 1.28,  # ~80% under a normal assumption
}


def widening_for(tier: Confidence) -> float:
    """Interval multiplier for a tier. Total, so no caller can KeyError."""
    return INTERVAL_WIDENING.get(tier, INTERVAL_WIDENING["none"])
