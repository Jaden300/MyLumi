"""Tier boundaries. These numbers are a clinical-honesty policy, not a detail -
if a boundary moves, someone gets a prediction we said they shouldn't."""

import pytest

from app.models.confidence import has_enough, insufficient_reason, tier_for


@pytest.mark.parametrize(
    "n,expected",
    [
        (0, "none"), (6, "none"),      # boundary: 6 is still silent
        (7, "low"), (13, "low"),       # boundary: 7 is the first insight
        (14, "moderate"), (20, "moderate"),
        (21, "good"), (100, "good"),
    ],
)
def test_tier_boundaries(n, expected):
    assert tier_for(n) == expected


def test_has_enough_matches_tier():
    assert not has_enough(6)
    assert has_enough(7)


def test_insufficient_reason_counts_down_and_is_not_blaming():
    assert insufficient_reason(6).startswith("One more")
    assert "5 more" in insufficient_reason(2)
    # Phrased as a fact about the data, never as a reprimand.
    for n in range(0, 7):
        assert "you haven't" not in insufficient_reason(n).lower()


def test_insufficient_reason_never_counts_past_zero():
    """A public helper with no bounds check once produced "0 more complete
    nights" at the threshold and "-1 more" above it."""
    for n in (7, 8, 20, 100):
        text = insufficient_reason(n)
        assert "0 more" not in text
        assert "-" not in text
