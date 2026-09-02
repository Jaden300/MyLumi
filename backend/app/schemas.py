"""The wire contract.

Mirrors `toFeatureRow` in frontend/src/lib/derive.js exactly. That function is the
documented chokepoint for what leaves the device; this file is the same contract
on the receiving side. If one changes, the other must.

Every field except `nightOf` is optional and defaults to None. A missing answer
stays missing all the way through the models - the frontend rule that "an
unanswered field stays null, a fabricated 0 enters the clinical record" does not
stop being true because the data crossed a network boundary.
"""

import math
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, BeforeValidator, Field

Confidence = Literal["none", "low", "moderate", "good"]

# Bounds. Generous enough never to reject a real answer, tight enough that a
# malformed or hostile payload cannot reach numpy.
MAX_ROWS = 1000
MAX_TEXTS = 1000
MAX_TEXT_CHARS = 5000


def _reject_non_finite(v: object) -> object:
    """Turn NaN and +/-Infinity into a missing value.

    Python's JSON parser accepts all three as bare literals, so they arrive here
    as real floats. Downstream they currently degrade to "no result", which is
    the right outcome but only by accident: one numpy call ordered differently
    and a NaN becomes a number shown to a user. Dropping them at the boundary
    makes that guarantee structural, and it matches the project rule that a
    value we cannot trust stays null rather than becoming a fabricated number.
    """
    if isinstance(v, float) and not math.isfinite(v):
        return None
    return v


Finite = Annotated[Optional[float], BeforeValidator(_reject_non_finite)]
FiniteInt = Annotated[Optional[int], BeforeValidator(_reject_non_finite)]


class FeatureRow(BaseModel):
    """One sleep episode, de-identified.

    Deliberately absent: any identifier, and all free text. Journal text has its
    own endpoint with its own consent step - see NlpRequest.
    """

    nightOf: str
    daysSinceInjury: FiniteInt = None
    symptomBurden: Finite = None
    mood: Finite = None
    preSleepStress: Finite = None
    sleepAidUsed: FiniteInt = None
    sleepDurationMinutes: Finite = None
    sleepQuality: Finite = None
    awakenings: Finite = None
    dreamRecall: FiniteInt = None
    moodMorning: Finite = None
    energy: Finite = None
    readiness: Finite = None
    dstAffected: FiniteInt = None
    nextSymptomBurden: Finite = None

    # The 9 PCSS items, sent as symptom_<key> to match the frontend row shape.
    symptom_headache: Finite = None
    symptom_photophobia: Finite = None
    symptom_phonophobia: Finite = None
    symptom_brainFog: Finite = None
    symptom_nausea: Finite = None
    symptom_dizziness: Finite = None
    symptom_fatigue: Finite = None
    symptom_moodDisturbance: Finite = None
    symptom_concentration: Finite = None


class InsightRequest(BaseModel):
    rows: list[FeatureRow] = Field(default_factory=list, max_length=MAX_ROWS)
    daysSinceInjury: FiniteInt = None


class JournalText(BaseModel):
    nightOf: str
    day: str = Field("", max_length=MAX_TEXT_CHARS)
    factors: str = Field("", max_length=MAX_TEXT_CHARS)
    wakeFeeling: str = Field("", max_length=MAX_TEXT_CHARS)


class NlpRequest(BaseModel):
    """Free text, sent only after an explicit consent step in the UI.

    Separate from InsightRequest on purpose: text must never ride along as an
    incidental side effect of a numeric call.
    """

    texts: list[JournalText] = Field(default_factory=list, max_length=MAX_TEXTS)


# --- responses --------------------------------------------------------------
# Every response carries the same envelope. "We don't have enough data" is
# `available: false` with a reason, NOT an error status - most users spend their
# first week in that state, so it is the normal path, not an exception.


class Envelope(BaseModel):
    available: bool
    reason: Optional[str] = None
    confidence: Confidence = "none"
    nDays: int = 0


class Driver(BaseModel):
    """One feature's contribution to a prediction, in plain language."""

    feature: str
    label: str
    direction: Literal["increases", "decreases"]
    weight: float


class ForecastResponse(Envelope):
    predictedBurden: Optional[float] = None
    interval: Optional[list[float]] = None
    drivers: list[Driver] = Field(default_factory=list)
    maxBurden: int = 54


class Finding(BaseModel):
    """One correlation, phrased as association and never as causation."""

    feature: str
    label: str
    rho: float
    pValue: float
    n: int
    direction: Literal["higher", "lower"]
    statement: str
    threshold: Optional[float] = None
    thresholdStatement: Optional[str] = None


class CorrelationResponse(Envelope):
    findings: list[Finding] = Field(default_factory=list)


class AnomalyPoint(BaseModel):
    nightOf: str
    burden: float
    score: float
    direction: Literal["worse", "better"]
    note: str


class AnomalyResponse(Envelope):
    anomalies: list[AnomalyPoint] = Field(default_factory=list)


class SentimentPoint(BaseModel):
    nightOf: str
    sentiment: float
    words: int


class NlpResponse(Envelope):
    points: list[SentimentPoint] = Field(default_factory=list)
    trend: Optional[Literal["improving", "declining", "steady"]] = None
    meanSentiment: Optional[float] = None


class InsightsResponse(BaseModel):
    """Batched - one call so a cold free-tier service is woken once, not four times."""

    forecast: ForecastResponse
    correlation: CorrelationResponse
    anomaly: AnomalyResponse
