"""Latent recovery state.

Two things these tests exist to prove, beyond "it runs":

1. The smoother recovers a slope we planted, so the line it draws is an estimate
   of something real rather than a prettier version of the input.
2. Uncertainty GROWS across a gap. That is the doctrine test - a missed night
   must make the model less sure, never make it invent a reading.
"""

import numpy as np

from app.models.features import to_episodes
from app.models.state import MIN_FOR_STATE, recovery_state

from .fixtures import make_flat_rows, make_recovery_rows, make_rows, make_sparse_rows


def test_below_the_floor_says_nothing():
    for n in range(0, MIN_FOR_STATE):
        result = recovery_state(to_episodes(make_recovery_rows(n)))
        assert result["available"] is False
        assert result["points"] == []
        assert result["slopePerDay"] is None
        assert result["direction"] is None
        assert result["reason"]


def test_recovers_a_planted_slope():
    """The estimate must track the truth, not just look smooth."""
    for true_slope in (-0.8, -0.4, 0.0, 0.5):
        result = recovery_state(
            to_episodes(
                make_recovery_rows(30, true_slope=true_slope, obs_noise=3.0, seed=5)
            )
        )
        assert result["available"] is True
        assert abs(result["slopePerDay"] - true_slope) < 0.2, (
            true_slope,
            result["slopePerDay"],
        )


def test_the_smoothed_line_is_less_jumpy_than_the_raw_reports():
    """The one-line proof that the filter is filtering."""
    result = recovery_state(
        to_episodes(make_recovery_rows(30, true_slope=-0.5, obs_noise=4.0))
    )
    observed = np.array([p["observed"] for p in result["points"]])
    level = np.array([p["level"] for p in result["points"]])
    assert np.std(np.diff(level)) < np.std(np.diff(observed))


def test_uncertainty_widens_across_a_gap():
    """The doctrine test.

    Nights 12, 13 and 14 were never logged. The model must not invent readings
    for them; it must come back visibly less certain on the far side of the gap
    than it was on the near side.
    """
    result = recovery_state(
        to_episodes(
            make_recovery_rows(30, true_slope=-0.4, obs_noise=3.0, gaps=(12, 13, 14))
        )
    )
    assert result["available"] is True

    nights = [p["nightOf"] for p in result["points"]]
    widths = {p["nightOf"]: p["upper"] - p["lower"] for p in result["points"]}

    # No point is emitted for a night that was never logged.
    assert "2026-01-13" not in nights
    assert "2026-01-14" not in nights
    assert "2026-01-15" not in nights

    # The first observation after the gap is less certain than the one before it.
    before = widths["2026-01-12"]
    after = widths["2026-01-16"]
    assert after > before, (before, after)


def test_a_gap_never_produces_a_fabricated_reading():
    """Every point carries a real observation - there are no filled-in nights."""
    result = recovery_state(
        to_episodes(make_recovery_rows(30, gaps=(5, 6, 7, 18)))
    )
    assert len(result["points"]) == 26
    for point in result["points"]:
        assert point["observed"] is not None


def test_refuses_to_name_a_direction_it_cannot_distinguish_from_flat():
    """A flat series, however noisy, must never be called improving."""
    for seed in range(6):
        result = recovery_state(
            to_episodes(
                make_recovery_rows(30, true_slope=0.0, obs_noise=6.0, seed=seed)
            )
        )
        assert result["direction"] == "steady", result["slopePerDay"]


def test_names_a_strong_trend_when_there_is_one():
    named = 0
    for seed in range(6):
        result = recovery_state(
            to_episodes(
                make_recovery_rows(30, true_slope=-0.8, obs_noise=3.0, seed=seed)
            )
        )
        if result["direction"] == "improving":
            named += 1
    assert named >= 4, f"only named a strong downward trend {named}/6 times"


def test_observation_noise_is_not_inflated_by_the_trend():
    """Regression, and the reason the model once refused to name a clear trend.

    Observation noise was estimated from night-to-night differences, which
    double-counts a series that swings up and back down - which self-reports do
    constantly. On the demo dataset that came out 2.2x the true residual spread.
    Because the slope's error bars derive from this number, over-estimating it
    made the model report a clear six points a week of recovery as "steady": a
    false negative on the most visible screen in the app.

    The estimate must track the noise actually planted, and must not grow just
    because the series has a trend running through it.
    """
    for true_slope in (0.0, -0.4, -0.8):
        for planted_noise in (2.0, 4.0):
            result = recovery_state(
                to_episodes(
                    make_recovery_rows(
                        30, true_slope=true_slope, obs_noise=planted_noise, seed=4
                    )
                )
            )
            estimated = result["observationNoise"]
            assert estimated < planted_noise * 2.0, (
                true_slope,
                planted_noise,
                estimated,
            )


def test_a_steep_recovery_is_named_rather_than_called_steady():
    """A burden falling by well over five points a week is not ambiguous."""
    named = sum(
        1
        for seed in range(8)
        if recovery_state(
            to_episodes(
                make_recovery_rows(30, true_slope=-0.9, obs_noise=3.0, seed=seed)
            )
        )["direction"]
        == "improving"
    )
    assert named >= 6, f"named a steep recovery only {named}/8 times"


def test_a_named_direction_always_agrees_with_its_slope():
    for seed in range(8):
        for slope in (-0.8, -0.3, 0.0, 0.6):
            result = recovery_state(
                to_episodes(
                    make_recovery_rows(28, true_slope=slope, obs_noise=3.0, seed=seed)
                )
            )
            if result["direction"] == "improving":
                assert result["slopePerDay"] < 0
            elif result["direction"] == "worsening":
                assert result["slopePerDay"] > 0


def test_every_band_contains_its_own_level():
    result = recovery_state(to_episodes(make_recovery_rows(30)))
    for point in result["points"]:
        assert point["lower"] <= point["level"] <= point["upper"]
        assert 0 <= point["lower"] <= point["upper"] <= result["maxBurden"]


def test_flat_history_is_steady_and_never_divides_by_zero():
    """Every night identical: no trend, no crash, and a band with real width."""
    result = recovery_state(to_episodes(make_flat_rows(25)))
    assert result["available"] is True
    assert result["direction"] == "steady"
    for point in result["points"]:
        assert point["upper"] > point["lower"]
        assert np.isfinite(point["level"])


def test_sparse_history_is_handled_honestly():
    result = recovery_state(to_episodes(make_sparse_rows(25)))
    # Sparse rows carry a burden but no morning half, so the series exists.
    if result["available"]:
        assert all(np.isfinite(p["level"]) for p in result["points"])
    else:
        assert result["reason"]


def test_every_emitted_value_is_finite():
    for rows in (make_recovery_rows(30), make_rows(30), make_flat_rows(20)):
        result = recovery_state(to_episodes(rows))
        if not result["available"]:
            continue
        assert np.isfinite(result["slopePerDay"])
        assert np.isfinite(result["observationNoise"])
        for point in result["points"]:
            assert all(
                np.isfinite(point[k]) for k in ("observed", "level", "lower", "upper")
            )


def test_statement_never_stages_recovery_or_names_a_date():
    banned = (
        "phase",
        "stage",
        "syndrome",
        "diagnos",
        "recovered by",
        "you will",
        "weeks left",
        "expect to",
    )
    for slope in (-0.8, 0.0, 0.5):
        result = recovery_state(
            to_episodes(make_recovery_rows(30, true_slope=slope))
        )
        lowered = result["statement"].lower()
        for word in banned:
            assert word not in lowered, f"{word!r} in {result['statement']!r}"


def test_statement_never_claims_causation():
    for slope in (-0.8, 0.0):
        result = recovery_state(
            to_episodes(make_recovery_rows(30, true_slope=slope))
        )
        lowered = result["statement"].lower()
        for word in ("causes", "due to", "because", "makes your"):
            assert word not in lowered
