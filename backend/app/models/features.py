"""Feature rows -> numpy matrices.

The whole file exists to handle one problem correctly: missing values. The
frontend guarantees an unanswered field is null rather than 0, and that guarantee
is worth nothing if this layer quietly imputes a zero and feeds it to a model as
though the user had answered.

Rule here: a row missing the value a model needs is DROPPED from that model's
fit, and the model reports the n it actually used. Fewer honest rows beat more
invented ones.
"""

from dataclasses import dataclass
from typing import Optional

import numpy as np

MAX_SYMPTOM_BURDEN = 54

# The 9 PCSS items, in check-in order. Mirrors SYMPTOM_KEYS in the frontend's
# constants.js. These arrive on every FeatureRow as symptom_<key> and, until
# now, were parsed and thrown away - no model read them. Everything in
# symptoms.py is built on them.
SYMPTOM_KEYS = [
    "headache",
    "photophobia",
    "phonophobia",
    "brainFog",
    "nausea",
    "dizziness",
    "fatigue",
    "moodDisturbance",
    "concentration",
]

# The key each symptom takes inside Episode.values, kept distinct from the bare
# symptom name so a symptom can never collide with a sleep feature.
SYMPTOM_VALUE_KEYS = [f"symptom_{key}" for key in SYMPTOM_KEYS]

# Plain language for each item, matching the labels the frontend already shows.
SYMPTOM_LABELS = {
    "headache": "headache",
    "photophobia": "light sensitivity",
    "phonophobia": "noise sensitivity",
    "brainFog": "brain fog",
    "nausea": "nausea",
    "dizziness": "dizziness",
    "fatigue": "fatigue",
    "moodDisturbance": "irritability or low mood",
    "concentration": "trouble concentrating",
}

# Feature key -> the label a human sees. Keeping the mapping here means a driver
# or a finding can be phrased in plain language without the model files each
# inventing their own wording.
FEATURE_LABELS = {
    "sleepDurationHours": "sleep duration",
    "sleepQuality": "sleep quality",
    "awakenings": "night-time awakenings",
    "preSleepStress": "pre-sleep stress",
    "sleepAidUsed": "sleep aid use",
    "dreamRecall": "dream recall",
    "mood": "evening mood",
    "moodMorning": "morning mood",
    "energy": "morning energy",
    "readiness": "readiness for the day",
    "symptomBurden": "today's symptom burden",
    "daysSinceInjury": "days since injury",
    "painRegionCount": "number of aching areas",
    "painMax": "worst pain rating",
    "painMean": "average pain rating",
}

# Features whose scale is "higher is better" for sleep. Used only for phrasing,
# never for maths.
HIGHER_IS_BETTER = {"sleepQuality", "energy", "readiness", "moodMorning", "mood"}


@dataclass
class Episode:
    """One sleep episode, normalised into the values the models actually use."""

    nightOf: str
    values: dict[str, Optional[float]]
    nextBurden: Optional[float]
    dstAffected: bool

    def get(self, key: str) -> Optional[float]:
        return self.values.get(key)


def _f(value) -> Optional[float]:
    """Coerce to float, preserving None. Never turns a missing value into 0."""
    if value is None:
        return None
    try:
        out = float(value)
    except (TypeError, ValueError):
        return None
    return None if np.isnan(out) else out


def to_episodes(rows) -> list[Episode]:
    """Pydantic rows -> Episodes, sorted by date.

    Sorting here rather than trusting the caller means the lag logic below is
    always looking at a real neighbour.
    """
    episodes = []
    for row in rows:
        duration = _f(row.sleepDurationMinutes)
        values = {
            "sleepDurationHours": None if duration is None else duration / 60.0,
            "sleepQuality": _f(row.sleepQuality),
            "awakenings": _f(row.awakenings),
            "preSleepStress": _f(row.preSleepStress),
            "sleepAidUsed": _f(row.sleepAidUsed),
            "dreamRecall": _f(row.dreamRecall),
            "mood": _f(row.mood),
            "moodMorning": _f(row.moodMorning),
            "energy": _f(row.energy),
            "readiness": _f(row.readiness),
            "symptomBurden": _f(row.symptomBurden),
            "daysSinceInjury": _f(row.daysSinceInjury),
            "painRegionCount": _f(row.painRegionCount),
            "painMax": _f(row.painMax),
            "painMean": _f(row.painMean),
        }
        # The 9 PCSS items. Copied through the same _f() as everything else, so
        # an unanswered item stays None rather than becoming a confident 0.
        for key in SYMPTOM_KEYS:
            values[f"symptom_{key}"] = _f(getattr(row, f"symptom_{key}", None))
        episodes.append(
            Episode(
                nightOf=row.nightOf,
                values=values,
                nextBurden=_f(row.nextSymptomBurden),
                dstAffected=bool(row.dstAffected),
            )
        )
    episodes.sort(key=lambda e: e.nightOf)
    return episodes


def complete_count(episodes: list[Episode]) -> int:
    """Episodes usable as a training row: a burden and at least one sleep signal.

    This is the n that drives the confidence tier, so it deliberately counts what
    the models can actually learn from rather than how many records exist.
    """
    n = 0
    for ep in episodes:
        if ep.get("symptomBurden") is None:
            continue
        if ep.get("sleepDurationHours") is None and ep.get("sleepQuality") is None:
            continue
        n += 1
    return n


def build_matrix(
    episodes: list[Episode],
    feature_keys: list[str],
    target: str = "nextBurden",
    drop_dst: bool = True,
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Rows with every requested feature AND the target present.

    Returns (X, y, nights_used). Rows are dropped, never imputed - see module
    docstring. DST nights are excluded by default because their sleep duration is
    an hour out by construction (see dstShiftMinutes in the frontend); training on
    a known-wrong number teaches the model a false relationship.
    """
    xs, ys, nights = [], [], []
    for ep in episodes:
        if drop_dst and ep.dstAffected:
            continue
        y = ep.nextBurden if target == "nextBurden" else ep.get(target)
        if y is None:
            continue
        row = [ep.get(k) for k in feature_keys]
        if any(v is None for v in row):
            continue
        xs.append(row)
        ys.append(y)
        nights.append(ep.nightOf)

    if not xs:
        return np.empty((0, len(feature_keys))), np.empty((0,)), []
    return np.asarray(xs, dtype=float), np.asarray(ys, dtype=float), nights


def paired_series(
    episodes: list[Episode], feature: str, drop_dst: bool = True
) -> tuple[np.ndarray, np.ndarray]:
    """(feature today, symptom burden tomorrow) pairs, for correlation.

    Pairing against the FOLLOWING night's burden is what makes the output
    "burden rises on days following short sleep" rather than a same-day
    association, which would be far weaker evidence and much easier to
    misread as causation.
    """
    xs, ys = [], []
    for ep in episodes:
        if drop_dst and ep.dstAffected:
            continue
        x = ep.get(feature)
        y = ep.nextBurden
        if x is None or y is None:
            continue
        xs.append(x)
        ys.append(y)
    return np.asarray(xs, dtype=float), np.asarray(ys, dtype=float)


def symptom_matrix(
    episodes: list[Episode], drop_dst: bool = False
) -> tuple[list[str], np.ndarray]:
    """(nights, n x 9 matrix) for episodes carrying ALL 9 PCSS items.

    All-or-nothing by design, matching `computeSymptomBurden` in the frontend:
    a night missing even one item is dropped rather than contributing a partial
    profile. A partial vector would distort a PCA loading and understate one
    symptom's share of the night's total, which is the same fabricated-zero
    failure this project refuses everywhere else.

    DST is NOT dropped here by default: these models look at symptom
    composition, which a wrong sleep duration does not corrupt.
    """
    nights, rows = [], []
    for ep in episodes:
        if drop_dst and ep.dstAffected:
            continue
        row = [ep.get(k) for k in SYMPTOM_VALUE_KEYS]
        if any(v is None for v in row):
            continue
        nights.append(ep.nightOf)
        rows.append(row)

    if not rows:
        return [], np.empty((0, len(SYMPTOM_KEYS)))
    return nights, np.asarray(rows, dtype=float)


def burden_series(episodes: list[Episode]) -> tuple[list[str], np.ndarray]:
    """Symptom burden over time, for anomaly detection. Gaps are simply absent."""
    nights, values = [], []
    for ep in episodes:
        b = ep.get("symptomBurden")
        if b is None:
            continue
        nights.append(ep.nightOf)
        values.append(b)
    return nights, np.asarray(values, dtype=float)
