"""Synthetic episodes with a KNOWN planted relationship.

The point of a fixture here is not "some data" - it is data where we know the
right answer, so a test can assert the model recovers it. If the correlation
engine cannot find a relationship we deliberately put in, it will not find a real
one either.

Seeded throughout. A flaky statistical test is worse than no test, because it
trains you to ignore failures.
"""

from datetime import date, timedelta

import numpy as np

from app.schemas import FeatureRow


def make_rows(
    n: int = 30,
    *,
    seed: int = 7,
    coupling: float = 4.0,
    start: date = date(2026, 1, 1),
    noise: float = 2.0,
    with_next: bool = True,
) -> list[FeatureRow]:
    """N episodes where short sleep drives HIGHER next-day symptom burden.

    coupling is burden points per hour of sleep lost. With coupling=4 and 7 hours
    of typical sleep, a 5-hour night should read ~8 points worse than a 9-hour
    one - a strong but not absurd effect, in the range these models must catch.
    """
    rng = np.random.default_rng(seed)
    rows = []

    sleep_hours = rng.normal(7.0, 1.3, size=n).clip(3.5, 10.0)
    # Sleep quality tracks duration but is not identical to it, so the two are
    # correlated without being the same column.
    quality = (sleep_hours - 4.0) * 1.1 + rng.normal(0, 0.7, size=n)
    quality = quality.clip(0, 6).round()
    stress = rng.integers(1, 6, size=n).astype(float)
    awakenings = rng.integers(0, 4, size=n).astype(float)

    # Burden: a recovery downtrend, plus the planted sleep effect, plus noise.
    #
    # The effect is deliberately LAGGED: how you slept on night i drives symptom
    # burden on day i+1. That is the relationship MyLumi actually claims to find
    # ("burden rises on days FOLLOWING short sleep"), so the fixture has to plant
    # it the same way round. Planting a same-night effect instead would make the
    # correlation tests pass against a model that measures the wrong thing.
    burdens = []
    for i in range(n):
        baseline = 26.0 - i * 0.35
        prev_sleep = sleep_hours[i - 1] if i > 0 else sleep_hours[i]
        sleep_effect = (7.0 - prev_sleep) * coupling
        stress_effect = (stress[i - 1] - 3.0) * 1.2 if i > 0 else 0.0
        value = baseline + sleep_effect + stress_effect + rng.normal(0, noise)
        burdens.append(float(np.clip(value, 0, 54)))

    for i in range(n):
        night = start + timedelta(days=i)
        # Spread the burden across the 9 PCSS items so the parts sum to the whole.
        per_item = burdens[i] / 9.0
        symptoms = {
            f"symptom_{key}": float(np.clip(round(per_item + rng.normal(0, 0.4)), 0, 6))
            for key in (
                "headache", "photophobia", "phonophobia", "brainFog", "nausea",
                "dizziness", "fatigue", "moodDisturbance", "concentration",
            )
        }
        next_burden = burdens[i + 1] if (with_next and i + 1 < n) else None

        rows.append(
            FeatureRow(
                nightOf=night.isoformat(),
                daysSinceInjury=i + 3,
                symptomBurden=round(burdens[i], 1),
                mood=float(rng.integers(20, 80)),
                preSleepStress=stress[i],
                sleepAidUsed=0,
                sleepDurationMinutes=round(sleep_hours[i] * 60, 1),
                sleepQuality=quality[i],
                awakenings=awakenings[i],
                dreamRecall=int(rng.integers(0, 2)),
                moodMorning=float(np.clip(round(6 - burdens[i] / 9), 0, 6)),
                energy=float(np.clip(round(6 - burdens[i] / 10), 0, 6)),
                readiness=float(np.clip(round(6 - burdens[i] / 10), 0, 6)),
                dstAffected=0,
                nextSymptomBurden=None if next_burden is None else round(next_burden, 1),
                **symptoms,
            )
        )
    return rows


def make_flat_rows(n: int = 20, start: date = date(2026, 1, 1)) -> list[FeatureRow]:
    """Every night identical. Nothing to correlate, nothing anomalous.

    The degenerate case that makes naive implementations divide by zero or
    report a spurious perfect correlation.
    """
    return [
        FeatureRow(
            nightOf=(start + timedelta(days=i)).isoformat(),
            symptomBurden=18.0,
            sleepDurationMinutes=450.0,
            sleepQuality=4.0,
            preSleepStress=3.0,
            awakenings=1.0,
            nextSymptomBurden=18.0 if i + 1 < n else None,
            dstAffected=0,
        )
        for i in range(n)
    ]


def make_sparse_rows(n: int = 20, start: date = date(2026, 1, 1)) -> list[FeatureRow]:
    """Night halves logged, mornings never. The most common real-world gap."""
    return [
        FeatureRow(
            nightOf=(start + timedelta(days=i)).isoformat(),
            symptomBurden=20.0 + (i % 5),
            preSleepStress=3.0,
            # No sleep duration (needs a wake time), no quality, no next burden.
        )
        for i in range(n)
    ]
