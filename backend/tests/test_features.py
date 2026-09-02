"""The missing-value contract.

CLAUDE.md: "Never invent data. An unanswered field stays null — a fabricated 0
enters the clinical record." These tests are that rule, enforced at the point
where data becomes a matrix.
"""

import numpy as np

from app.models.features import (
    Episode,
    build_matrix,
    burden_series,
    complete_count,
    paired_series,
    to_episodes,
)
from app.schemas import FeatureRow

from .fixtures import make_rows, make_sparse_rows


def test_none_never_becomes_zero():
    rows = [FeatureRow(nightOf="2026-01-01")]
    ep = to_episodes(rows)[0]
    for key, value in ep.values.items():
        assert value is None, f"{key} was coerced to {value!r} instead of staying None"


def test_episodes_are_sorted_by_date():
    rows = [
        FeatureRow(nightOf="2026-01-03"),
        FeatureRow(nightOf="2026-01-01"),
        FeatureRow(nightOf="2026-01-02"),
    ]
    assert [e.nightOf for e in to_episodes(rows)] == ["2026-01-01", "2026-01-02", "2026-01-03"]


def test_rows_missing_a_feature_are_dropped_not_imputed():
    eps = to_episodes(make_sparse_rows(20))
    x, y, nights = build_matrix(eps, ["sleepDurationHours"])
    # Every row lacks sleep duration, so the honest answer is zero usable rows.
    assert len(y) == 0
    assert nights == []


def test_complete_count_requires_burden_and_a_sleep_signal():
    assert complete_count(to_episodes(make_sparse_rows(20))) == 0
    assert complete_count(to_episodes(make_rows(15))) == 15


def test_dst_nights_excluded_from_training():
    rows = make_rows(20)
    rows[5].dstAffected = 1
    eps = to_episodes(rows)
    _, y_with, nights = build_matrix(eps, ["sleepDurationHours"], drop_dst=True)
    assert rows[5].nightOf not in nights
    _, y_without, _ = build_matrix(eps, ["sleepDurationHours"], drop_dst=False)
    assert len(y_without) == len(y_with) + 1


def test_paired_series_pairs_today_against_tomorrow():
    rows = make_rows(10)
    eps = to_episodes(rows)
    x, y = paired_series(eps, "sleepDurationHours")
    assert len(x) == len(y)
    # First pair: night 0's sleep against night 1's burden.
    assert x[0] == rows[0].sleepDurationMinutes / 60.0
    assert y[0] == rows[0].nextSymptomBurden


def test_burden_series_skips_gaps_without_filling_them():
    rows = make_rows(10)
    rows[3].symptomBurden = None
    nights, values = burden_series(to_episodes(rows))
    assert len(values) == 9
    assert rows[3].nightOf not in nights


def test_empty_input_returns_empty_matrix_not_a_crash():
    x, y, nights = build_matrix([], ["sleepDurationHours"])
    assert x.shape == (0, 1) and len(y) == 0 and nights == []
