"""The wire contract.

Mirrors `toFeatureRow` in frontend/src/lib/derive.js exactly. That function is the
documented chokepoint for what leaves the device; this file is the same contract
on the receiving side. If one changes, the other must.

Every field except `nightOf` is optional and defaults to None. A missing answer
stays missing all the way through the models — the frontend rule that "an
unanswered field stays null, a fabricated 0 enters the clinical record" does not
stop being true because the data crossed a network boundary.
"""

from typing import Literal, Optional

from pydantic import BaseModel, Field

Confidence = Literal["none", "low", "moderate", "good"]


class FeatureRow(BaseModel):
    """One sleep episode, de-identified.

    Deliberately absent: any identifier, and all free text. Journal text has its
    own endpoint with its own consent step — see NlpRequest.
    """

    nightOf: str
    daysSinceInjury: Optional[int] = None
    symptomBurden: Optional[float] = None
    mood: Optional[float] = None
    preSleepStress: Optional[float] = None
    sleepAidUsed: Optional[int] = None
    sleepDurationMinutes: Optional[float] = None
    sleepQuality: Optional[float] = None
    awakenings: Optional[float] = None
    dreamRecall: Optional[int] = None
    moodMorning: Optional[float] = None
    energy: Optional[float] = None
    readiness: Optional[float] = None
    dstAffected: Optional[int] = None
    nextSymptomBurden: Optional[float] = None

    # The 9 PCSS items, sent as symptom_<key> to match the frontend row shape.
    symptom_headache: Optional[float] = None
    symptom_photophobia: Optional[float] = None
    symptom_phonophobia: Optional[float] = None
    symptom_brainFog: Optional[float] = None
    symptom_nausea: Optional[float] = None
    symptom_dizziness: Optional[float] = None
    symptom_fatigue: Optional[float] = None
    symptom_moodDisturbance: Optional[float] = None
    symptom_concentration: Optional[float] = None


class InsightRequest(BaseModel):
    rows: list[FeatureRow] = Field(default_factory=list)
    daysSinceInjury: Optional[int] = None


class JournalText(BaseModel):
    nightOf: str
    day: str = ""
    factors: str = ""
    wakeFeeling: str = ""


class NlpRequest(BaseModel):
    """Free text, sent only after an explicit consent step in the UI.

    Separate from InsightRequest on purpose: text must never ride along as an
    incidental side effect of a numeric call.
    """

    texts: list[JournalText] = Field(default_factory=list)


# --- responses --------------------------------------------------------------
# Every response carries the same envelope. "We don't have enough data" is
# `available: false` with a reason, NOT an error status — most users spend their
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
    """Batched — one call so a cold free-tier service is woken once, not four times."""

    forecast: ForecastResponse
    correlation: CorrelationResponse
    anomaly: AnomalyResponse
