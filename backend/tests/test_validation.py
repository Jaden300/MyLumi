"""The model that grades the other models.

The most important test in this file is the one asserting the model is allowed
to LOSE. A validation layer that can only report good news is decoration, and
would be worse than having none - it would launder a bad forecast into an
endorsement.
"""

import numpy as np

from app.models.features import to_episodes
from app.models.forecast import forecast
from app.models.validation import (
    MAX_FOLDS,
    MIN_FOLDS,
    TARGET_COVERAGE,
    conformal_half_width,
    validate,
    walk_forward,
)

from .fixtures import make_flat_rows, make_rows, make_sparse_rows


def test_too_little_history_reports_nothing():
    for n in range(0, 11):
        result = validate(to_episodes(make_rows(n)))
        if result["available"]:
            continue
        assert result["modelError"] is None
        assert result["skillScore"] is None
        assert result["statement"] is None
        assert result["reason"]


def test_beats_the_naive_baseline_on_strongly_coupled_data():
    """The planted sleep effect is learnable, so the model should win."""
    result = validate(to_episodes(make_rows(45, coupling=6.0, noise=1.0)))
    assert result["available"] is True
    assert result["beatsNaive"] is True
    assert result["skillScore"] > 0
    assert result["modelError"] < result["naiveError"]


def test_reports_a_loss_honestly_on_unlearnable_data():
    """A pure random walk has nothing to learn. Some seeds MUST come back
    negative, and the statement must say so rather than hiding it."""
    from datetime import date, timedelta

    from app.schemas import FeatureRow

    def random_walk(n=30, seed=0):
        rng = np.random.default_rng(seed)
        burdens = np.clip(25 + np.cumsum(rng.normal(0, 4, n)), 0, 54)
        rows = []
        for i in range(n):
            rows.append(
                FeatureRow(
                    nightOf=(date(2026, 1, 1) + timedelta(days=i)).isoformat(),
                    symptomBurden=round(float(burdens[i]), 1),
                    sleepDurationMinutes=float(rng.normal(420, 60)),
                    sleepQuality=float(rng.integers(0, 7)),
                    preSleepStress=float(rng.integers(1, 6)),
                    awakenings=float(rng.integers(0, 4)),
                    dstAffected=0,
                    nextSymptomBurden=(
                        round(float(burdens[i + 1]), 1) if i + 1 < n else None
                    ),
                )
            )
        return rows

    losses = 0
    for seed in range(8):
        result = validate(to_episodes(random_walk(30, seed)))
        if result["beatsNaive"] is False:
            losses += 1
            assert result["skillScore"] <= 0
            assert "no better" in result["statement"]
    assert losses >= 1, "validation never reported a loss on unlearnable data"


def test_every_fold_is_scored_out_of_sample():
    """A fold trained on data including its own target would be meaningless.

    Checked behaviourally: shuffling the targets destroys the relationship, so
    an honest walk-forward must get materially worse. An in-sample scorer would
    barely notice.
    """
    rows = make_rows(40, coupling=6.0, noise=1.0)
    honest = validate(to_episodes(rows))

    shuffled = list(rows)
    values = [r.nextSymptomBurden for r in shuffled]
    rng = np.random.default_rng(0)
    permuted = rng.permutation([v for v in values if v is not None]).tolist()
    for row in shuffled:
        if row.nextSymptomBurden is not None:
            row.nextSymptomBurden = permuted.pop()
    scrambled = validate(to_episodes(shuffled))

    assert scrambled["modelError"] > honest["modelError"]


def test_fold_count_is_capped_for_a_long_history():
    result = walk_forward(to_episodes(make_rows(300)))
    assert result["folds"] <= MAX_FOLDS


def test_conformal_interval_is_better_calibrated_than_the_old_multiplier():
    """The bug this model exists to fix.

    The tier multipliers were measured at roughly 51% real coverage on a band
    documented as ~80%. The conformal width must land closer to target on
    genuinely held-out nights.
    """
    from app.models.features import build_matrix
    from app.models.forecast import FORECAST_FEATURES

    conformal_hits, legacy_hits = [], []
    for seed in range(40):
        episodes = to_episodes(make_rows(30, seed=seed))
        _x, y, _nights = build_matrix(episodes, FORECAST_FEATURES)
        if len(y) < 12:
            continue
        truth = float(y[-1])
        trimmed = episodes[:-1]  # hide the final pair

        half = conformal_half_width(trimmed)
        new = forecast(trimmed, interval_half_width=half)
        old = forecast(trimmed)
        if not new["available"] or not old["available"]:
            continue
        conformal_hits.append(new["interval"][0] <= truth <= new["interval"][1])
        legacy_hits.append(old["interval"][0] <= truth <= old["interval"][1])

    assert len(conformal_hits) >= 20
    assert np.mean(conformal_hits) > np.mean(legacy_hits)
    # Near the target it aims for. Loose bounds on purpose - a tight assertion
    # here is exactly the flaky statistical test the fixtures docstring warns
    # against.
    assert 0.65 <= np.mean(conformal_hits) <= 0.98


def test_reported_coverage_describes_the_band_actually_shown():
    """Coverage and the interval must come from the same errors, or the honesty
    card would describe a different band from the prediction card."""
    episodes = to_episodes(make_rows(40))
    result = validate(episodes)
    half = conformal_half_width(episodes)
    assert half is not None
    errors = np.asarray(walk_forward(episodes)["errors"])
    # Tolerance covers the rounding the response applies, nothing more.
    assert np.isclose(result["coverage"], float(np.mean(errors <= half)), atol=5e-4)


def test_coverage_lands_near_its_target():
    result = validate(to_episodes(make_rows(45)))
    assert result["coverage"] is not None
    assert abs(result["coverage"] - TARGET_COVERAGE) < 0.25


def test_flat_history_never_crashes_or_fabricates():
    result = validate(to_episodes(make_flat_rows(30)))
    if result["available"]:
        assert np.isfinite(result["modelError"])
        assert result["modelError"] >= 0


def test_sparse_history_reports_unavailable():
    result = validate(to_episodes(make_sparse_rows(25)))
    assert result["available"] is False
    assert result["folds"] < MIN_FOLDS


def test_every_emitted_value_is_finite():
    for n in (14, 25, 40):
        result = validate(to_episodes(make_rows(n)))
        if not result["available"]:
            continue
        for key in ("modelError", "naiveError", "skillScore", "coverage"):
            if result[key] is not None:
                assert np.isfinite(result[key]), key


def test_statement_never_claims_causation_or_a_diagnosis():
    banned = ("causes", "due to", "because", "syndrome", "diagnos", "recovered by")
    for n in (14, 30, 45):
        result = validate(to_episodes(make_rows(n)))
        if not result["statement"]:
            continue
        lowered = result["statement"].lower()
        for word in banned:
            assert word not in lowered, f"{word!r} in {result['statement']!r}"
