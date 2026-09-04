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

    # Where the person ached, as three aggregates rather than one column per
    # body region. 29 region columns against the 7-30 rows these models actually
    # fit would be separable by chance, and would be almost all null besides,
    # which this project drops rather than imputes. A per-region map is also
    # closer to an identifier than a measurement.
    #
    # painRegionCount is 0 when the user was asked and reported nothing, which
    # is a real answer. painMax and painMean stay None in that case: a maximum
    # over an empty set is undefined, and sending 0 would claim the worst pain
    # measured zero. See painFeatures() in frontend/src/lib/derive.js.
    painRegionCount: FiniteInt = None
    painMax: Finite = None
    painMean: Finite = None

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
    # Lexicon words that produced the score. Sent so that "every score
    # decomposes into the specific words that produced it" is checkable from a
    # response, not only by reading the model source.
    hits: int = 0


class SymptomMention(BaseModel):
    """Symptom words found in one entry. Sparse - nonzero counts only.

    Counts of WORDS, never a judgement about the symptom. What these mean when
    set against the user's own ratings is worked out in the browser, because
    doing it here would require holding text and clinical scores in one request.
    """

    nightOf: str
    mentions: dict[str, int]


class ComplexityFinding(BaseModel):
    metric: Literal["wordLength", "variety"]
    direction: Literal["rising", "falling"]
    tau: float
    statement: str


class ComplexityResponse(Envelope):
    finding: Optional[ComplexityFinding] = None


class NlpResponse(Envelope):
    points: list[SentimentPoint] = Field(default_factory=list)
    trend: Optional[Literal["improving", "declining", "steady"]] = None
    meanSentiment: Optional[float] = None
    mentions: list[SymptomMention] = Field(default_factory=list)
    complexity: Optional[ComplexityResponse] = None


class SymptomShift(BaseModel):
    """How one symptom's SHARE of the total burden changes after short sleep."""

    key: str
    label: str
    shiftPoints: float  # percentage points of the night's total
    direction: Literal["larger", "smaller"]
    pValue: float
    n: int
    statement: str


class SymptomRate(BaseModel):
    """One symptom's trend over time, with the interval that decided it."""

    key: str
    label: str
    weeklyChange: float
    ciLow: float
    ciHigh: float
    status: Literal["easing", "worsening", "unclear"]
    laggard: bool = False
    n: int


class SymptomGrid(BaseModel):
    """The full nights x 9 matrix behind the rates and shifts.

    `values` is one row per symptom, one column per night - the orientation the
    heatmap draws in, so the client does no transposing.
    """

    nights: list[str] = Field(default_factory=list)
    keys: list[str] = Field(default_factory=list)
    labels: list[str] = Field(default_factory=list)
    values: list[list[float]] = Field(default_factory=list)


class SymptomsResponse(Envelope):
    shifts: list[SymptomShift] = Field(default_factory=list)
    rates: list[SymptomRate] = Field(default_factory=list)
    grid: SymptomGrid = Field(default_factory=SymptomGrid)
    summary: Optional[str] = None


class FoldPoint(BaseModel):
    """One out-of-sample check: what it knew, and how far off it was."""

    trainSize: int
    error: float
    naiveError: Optional[float] = None
    nightOf: Optional[str] = None


class ValidationResponse(Envelope):
    """How the forecast scored against its own history. May be bad news."""

    folds: int = 0
    curve: list[FoldPoint] = Field(default_factory=list)
    intervalHalfWidth: Optional[float] = None
    modelError: Optional[float] = None
    naiveError: Optional[float] = None
    skillScore: Optional[float] = None
    beatsNaive: Optional[bool] = None
    coverage: Optional[float] = None
    targetCoverage: float = 0.8
    statement: Optional[str] = None


class StatePoint(BaseModel):
    """One night: what was reported, and the estimated level behind it."""

    nightOf: str
    observed: float
    level: float
    lower: float
    upper: float


class RecoveryStateResponse(Envelope):
    points: list[StatePoint] = Field(default_factory=list)
    slopePerDay: Optional[float] = None
    direction: Optional[Literal["improving", "steady", "worsening"]] = None
    observationNoise: Optional[float] = None
    statement: Optional[str] = None
    maxBurden: int = 54


class InsightsResponse(BaseModel):
    """Batched - one call so a cold free-tier service is woken once per view.

    Six models now share the request. Each is computed defensively in the router
    so one failing model cannot take the other five down with it.
    """

    forecast: ForecastResponse
    correlation: CorrelationResponse
    anomaly: AnomalyResponse
    symptoms: SymptomsResponse
    validation: ValidationResponse
    recoveryState: RecoveryStateResponse
