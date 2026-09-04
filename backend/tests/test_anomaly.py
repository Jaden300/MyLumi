import json

import numpy as np

from app.models.anomaly import detect
from app.models.features import to_episodes

from .fixtures import make_flat_rows, make_rows


def test_below_threshold_reports_nothing():
    for n in range(0, 7):
        result = detect(to_episodes(make_rows(n)))
        assert result["available"] is False
        assert result["anomalies"] == []


def test_flags_a_planted_spike():
    rows = make_rows(20, noise=0.5)
    rows[-3].symptomBurden = 52.0  # far outside this user's own pattern
    result = detect(to_episodes(rows))
    assert result["available"] is True
    assert any(a["nightOf"] == rows[-3].nightOf for a in result["anomalies"])


def test_robust_to_a_single_extreme_day():
    """The reason for median/MAD: one catastrophic day must not mask the next.

    With mean/SD, a 54 inflates the spread enough that a later 45 looks normal.
    """
    rows = make_rows(20, noise=0.5)
    rows[5].symptomBurden = 54.0
    rows[-2].symptomBurden = 45.0
    result = detect(to_episodes(rows))
    flagged = {a["nightOf"] for a in result["anomalies"]}
    assert rows[-2].nightOf in flagged


def test_flat_data_flags_nothing_and_does_not_crash():
    result = detect(to_episodes(make_flat_rows(20)))
    assert result["available"] is True  # "nothing unusual" is a real answer
    assert result["anomalies"] == []


def test_wording_is_gentle_and_non_diagnostic():
    rows = make_rows(20, noise=0.5)
    rows[-3].symptomBurden = 52.0
    result = detect(to_episodes(rows))
    banned = ("setback", "relapse", "diagnos", "alarm", "urgent", "danger", "warning")
    for anomaly in result["anomalies"]:
        note = anomaly["note"].lower()
        for word in banned:
            assert word not in note, f"alarming/diagnostic word {word!r} in: {note}"


def test_only_recent_anomalies_are_surfaced():
    """A spike 40 days ago is not actionable and should not resurface."""
    rows = make_rows(40, noise=0.5)
    rows[2].symptomBurden = 54.0
    result = detect(to_episodes(rows))
    assert all(a["nightOf"] != rows[2].nightOf for a in result["anomalies"])


def test_capped_at_three():
    rows = make_rows(20, noise=0.5)
    for i in (-2, -3, -4, -5, -6):
        rows[i].symptomBurden = 52.0
    assert len(detect(to_episodes(rows))["anomalies"]) <= 3


def test_extreme_values_never_produce_a_non_finite_score():
    """Every other model's tests assert np.isfinite on their outputs; this one
    did not, and that is precisely the gap a NaN escaped through.

    At 1e308 the subtraction `value - median` overflows to inf, and inf/inf is
    NaN. The old code let that reach the response, where FastAPI's encoder
    raised `Out of range float values are not JSON compliant` - a 500 produced
    while serialising a result the model thought it had returned successfully.
    """
    rows = make_rows(20, noise=0.5)
    for row in rows:
        row.symptomBurden = 1e308
    result = detect(to_episodes(rows))
    assert result["available"] is True
    for anomaly in result["anomalies"]:
        assert np.isfinite(anomaly["score"]), anomaly
        assert np.isfinite(anomaly["burden"]), anomaly


def test_mixed_extreme_signs_stay_finite():
    """Alternating +/-1e308 is the shape that actually overflowed: a huge
    spread, so `scale` itself is large but finite, and the guard on `scale`
    alone does not catch it."""
    rows = make_rows(20, noise=0.5)
    for i, row in enumerate(rows):
        row.symptomBurden = 1e308 if i % 2 else -1e308
    result = detect(to_episodes(rows))
    for anomaly in result["anomalies"]:
        assert np.isfinite(anomaly["score"]), anomaly


def test_json_serialisable():
    """The end the bug actually surfaced at. `json.dumps` rejects NaN and inf
    with the default `allow_nan=False` that Starlette uses, so this is the same
    check the response encoder performs."""
    rows = make_rows(20, noise=0.5)
    for row in rows:
        row.symptomBurden = 1e308
    json.dumps(detect(to_episodes(rows)), allow_nan=False)
