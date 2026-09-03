from app.models.features import to_episodes
from app.models.forecast import MAX_BURDEN, forecast

from .fixtures import make_flat_rows, make_rows, make_sparse_rows


def test_below_threshold_returns_no_number_at_all():
    """The core clinical-safety guarantee: silence, not a low-confidence guess."""
    for n in range(0, 7):
        result = forecast(to_episodes(make_rows(n)))
        assert result["available"] is False
        assert result["predictedBurden"] is None
        assert result["interval"] is None
        assert result["confidence"] == "none"
        assert result["reason"]


def test_produces_a_prediction_once_there_is_enough_data():
    result = forecast(to_episodes(make_rows(30)))
    assert result["available"] is True
    assert 0 <= result["predictedBurden"] <= MAX_BURDEN
    assert result["confidence"] == "good"


def test_prediction_always_lies_inside_its_interval():
    for n in (10, 16, 30, 45):
        result = forecast(to_episodes(make_rows(n)))
        if not result["available"]:
            continue
        low, high = result["interval"]
        assert low <= result["predictedBurden"] <= high
        assert 0 <= low <= high <= MAX_BURDEN


def test_lower_confidence_gives_a_wider_interval():
    """Uncertainty must be visible, not hidden behind a tight-looking band."""
    low_tier = forecast(to_episodes(make_rows(9, seed=3)))
    high_tier = forecast(to_episodes(make_rows(40, seed=3)))
    assert low_tier["confidence"] == "low"
    assert high_tier["confidence"] == "good"
    width = lambda r: r["interval"][1] - r["interval"][0]
    assert width(low_tier) > width(high_tier)


def test_every_prediction_is_explained():
    """MyLumi_Plan.md 10.2 - if we can't explain it, it doesn't ship."""
    result = forecast(to_episodes(make_rows(30)))
    assert result["drivers"]
    for driver in result["drivers"]:
        assert driver["direction"] in ("increases", "decreases")
        assert driver["label"] and driver["label"] != driver["feature"]
        assert driver["weight"] > 0


def test_planted_sleep_effect_is_recovered_as_a_driver():
    """With a strong planted coupling, sleep should surface among the drivers."""
    result = forecast(to_episodes(make_rows(45, coupling=6.0, noise=1.0)))
    features = {d["feature"] for d in result["drivers"]}
    assert "sleepDurationHours" in features or "sleepQuality" in features


def test_flat_data_does_not_crash_or_produce_infinities():
    result = forecast(to_episodes(make_flat_rows(25)))
    if result["available"]:
        assert 0 <= result["predictedBurden"] <= MAX_BURDEN
        low, high = result["interval"]
        assert low == low and high == high  # not NaN


def test_sparse_rows_report_insufficient_rather_than_guessing():
    result = forecast(to_episodes(make_sparse_rows(25)))
    assert result["available"] is False
    assert result["predictedBurden"] is None


def test_single_row_and_empty_input_are_safe():
    for rows in ([], make_rows(1)):
        result = forecast(to_episodes(rows))
        assert result["available"] is False
        assert result["predictedBurden"] is None


def test_interval_never_collapses_to_a_point():
    """A perfectly flat history gives zero residuals. An unfloored interval
    became [x, x] - a +/-0 band, which claims a certainty no personal model fit
    on a few weeks of self-reports has earned."""
    result = forecast(to_episodes(make_flat_rows(20)))

    assert result["available"] is True
    low, high = result["interval"]
    assert high > low


def test_reports_the_pairs_it_actually_fitted():
    """nDays drove the confidence badge AND the interval multiplier, so reading
    it off the episode count handed the narrowest band to the least data."""
    rows = make_rows(25)
    for row in rows[10:]:
        row.nextSymptomBurden = None  # only 10 usable training pairs remain

    result = forecast(to_episodes(rows))

    assert result["available"] is True
    assert result["nDays"] <= 10
    assert result["confidence"] != "good"  # not the 21+ tier on 10 pairs
