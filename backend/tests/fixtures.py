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


SYMPTOM_KEYS = (
    "headache", "photophobia", "phonophobia", "brainFog", "nausea",
    "dizziness", "fatigue", "moodDisturbance", "concentration",
)

# Two latent factors, planted so the per-symptom models have real structure to
# find. A SOMATIC group carries the sleep effect; a COGNITIVE group drifts on
# its own schedule. Everything else loads mostly on overall severity.
#
# This matters more than it looks. The original fixture set every item to
# burden/9 + noise, which is ISOTROPIC: every symptom is a noisy copy of the
# aggregate. A PCA on that finds one component and nothing else, and every
# per-symptom slope comes out identical - so a per-symptom model would pass its
# tests while proving nothing at all.
SOMATIC = ("headache", "nausea", "dizziness", "photophobia", "phonophobia")
COGNITIVE = ("brainFog", "concentration", "fatigue")

# Per-item recovery rate, in 0-6 scale points per day. Deliberately uneven:
# nausea and headache resolve briskly, brain fog and fatigue barely move. That
# is both clinically realistic and what makes a per-symptom recovery-rate model
# worth building - a uniform decay would have nothing to report.
# Expressed as a DEVIATION from the overall recovery trend that `burdens`
# already carries, not as an absolute rate. The aggregate downtrend pulls every
# item down together; these are what make some items resolve faster than that
# shared slope and others lag behind it. Without the deviation being this large
# the per-symptom rates all land within noise of each other, and a
# recovery-rate model has nothing to distinguish.
RECOVERY_RATES = {
    "headache": -0.055,
    "photophobia": -0.030,
    "phonophobia": -0.025,
    "brainFog": +0.070,
    "nausea": -0.060,
    "dizziness": -0.040,
    "fatigue": +0.075,
    "moodDisturbance": -0.010,
    "concentration": +0.065,
}


def make_rows(
    n: int = 30,
    *,
    seed: int = 7,
    coupling: float = 4.0,
    start: date = date(2026, 1, 1),
    noise: float = 2.0,
    with_next: bool = True,
    symptom_structure: bool = True,
) -> list[FeatureRow]:
    """N episodes where short sleep drives HIGHER next-day symptom burden.

    coupling is burden points per hour of sleep lost. With coupling=4 and 7 hours
    of typical sleep, a 5-hour night should read ~8 points worse than a 9-hour
    one - a strong but not absurd effect, in the range these models must catch.

    `symptom_structure` plants the two-factor per-symptom structure described
    above. Turn it off for `make_isotropic_rows`, which exists to prove the
    models report ONE component on undifferentiated data rather than inventing
    a second one.
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

    # An independent cognitive drift, so the cognitive items move on a schedule
    # of their own rather than tracking the sleep-driven somatic ones. Without
    # this there is only one factor in the data no matter how it is scaled.
    # Large enough to be a genuine second dimension rather than a wobble the
    # overall-severity factor absorbs. Verified against parallel analysis: with
    # a smaller amplitude the cognitive items stay statistically
    # indistinguishable from noise, and the axes model correctly reports only
    # one pattern - which makes for a true but useless test.
    cognitive_drift = np.cumsum(rng.normal(0, 0.8, size=n))
    if n:
        cognitive_drift -= cognitive_drift.mean()

    # Which days FOLLOW a short night. Lagged on purpose, matching the effect
    # the rest of this fixture plants and the claim the product makes: the
    # profile shift shows up on the day after poor sleep, not the night of it.
    short_night = float(np.quantile(sleep_hours, 0.35)) if n else 0.0
    poor_sleep = [sleep_hours[i - 1] < short_night if i > 0 else False for i in range(n)]

    for i in range(n):
        night = start + timedelta(days=i)
        # Spread the burden across the 9 PCSS items so the parts sum to the whole.
        per_item = burdens[i] / 9.0
        symptoms = {}
        for key in SYMPTOM_KEYS:
            value = per_item
            if symptom_structure:
                # After a short night, a LARGER SHARE of the same burden shows
                # up as cognitive symptoms. This mirrors how demoSeed.js plants
                # it (fatigue/brainFog/concentration get heavier weights on
                # poor-sleep nights), and it is what the composition model is
                # built to find: the shift is in the shape of the profile, not
                # just its size.
                if key in COGNITIVE:
                    value += cognitive_drift[i] * 0.5
                    if poor_sleep[i]:
                        value += 1.3
                elif key in SOMATIC:
                    if poor_sleep[i]:
                        value -= 0.5
                value += RECOVERY_RATES[key] * i
            symptoms[f"symptom_{key}"] = float(
                np.clip(round(value + rng.normal(0, 0.4)), 0, 6)
            )
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


def make_isotropic_rows(n: int = 30, **kwargs) -> list[FeatureRow]:
    """Every symptom a noisy copy of burden/9 - the OLD fixture behaviour.

    Kept deliberately. Undifferentiated symptoms are a real dataset shape (a
    user whose symptoms genuinely all move together), and the correct answer on
    them is "one overall severity pattern", not an invented second axis. This
    fixture is what proves the model says so.
    """
    return make_rows(n, symptom_structure=False, **kwargs)


def make_recovery_rows(
    n: int = 26,
    *,
    seed: int = 3,
    true_slope: float = -0.5,
    obs_noise: float = 3.5,
    start_burden: float = 30.0,
    gaps: tuple[int, ...] = (),
    start: date = date(2026, 1, 1),
) -> list[FeatureRow]:
    """A KNOWN latent trend plus observation noise, for the state-space model.

    The point is ground truth: a smoother can only be tested against a level it
    is supposed to recover. `true_slope` is burden points per day of genuine
    change; `obs_noise` is the standard deviation of the self-report noise laid
    over it.

    `gaps` names day indices that were never logged. They are omitted entirely
    rather than sent with null fields, which is what a real missed night looks
    like - and it is what lets a test assert the filter's uncertainty GROWS
    across a gap instead of inventing a value for it.
    """
    rng = np.random.default_rng(seed)
    rows = []
    for i in range(n):
        if i in gaps:
            continue
        latent = start_burden + true_slope * i
        observed = float(np.clip(latent + rng.normal(0, obs_noise), 0, 54))
        night = start + timedelta(days=i)
        per_item = observed / 9.0
        symptoms = {
            f"symptom_{key}": float(np.clip(round(per_item + rng.normal(0, 0.4)), 0, 6))
            for key in SYMPTOM_KEYS
        }
        rows.append(
            FeatureRow(
                nightOf=night.isoformat(),
                daysSinceInjury=i + 3,
                symptomBurden=round(observed, 1),
                sleepDurationMinutes=round(float(rng.normal(7.0, 1.0) * 60), 1),
                sleepQuality=float(rng.integers(2, 6)),
                preSleepStress=float(rng.integers(1, 6)),
                awakenings=float(rng.integers(0, 4)),
                dstAffected=0,
                nextSymptomBurden=None,
                **symptoms,
            )
        )
    # Pair each row with the following one, only when the nights are adjacent -
    # the same rule buildRows applies in the frontend.
    for a, b in zip(rows, rows[1:]):
        if (date.fromisoformat(b.nightOf) - date.fromisoformat(a.nightOf)).days == 1:
            a.nextSymptomBurden = b.symptomBurden
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
