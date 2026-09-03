"""Per-symptom model.

The fixture plants a specific structure and these tests assert the model finds
it: a cognitive cluster (brain fog, fatigue, concentration) that takes a larger
share of the burden after short sleep and does NOT resolve, against somatic
items (headache, nausea, dizziness) that do.

If the model cannot recover a relationship we deliberately put there, it will
not find a real one either.
"""

import numpy as np

from app.models.features import SYMPTOM_KEYS, to_episodes
from app.models.symptoms import analyse, composition_shift, recovery_rates

from .fixtures import (
    make_flat_rows,
    make_isotropic_rows,
    make_rows,
    make_sparse_rows,
)

COGNITIVE = {"brainFog", "fatigue", "concentration"}


def test_below_the_floor_says_nothing_at_all():
    """Same guarantee as every other model: silence, not a weak answer."""
    for n in range(0, 10):
        result = analyse(to_episodes(make_rows(n)))
        assert result["available"] is False
        assert result["shifts"] == []
        assert result["summary"] is None
        assert result["confidence"] == "none"
        assert result["reason"]


def test_finds_the_planted_cognitive_cluster():
    """After short sleep, the cognitive items take a larger share of burden."""
    found = set()
    for seed in range(6):
        result = analyse(to_episodes(make_rows(34, seed=seed)))
        for shift in result["shifts"]:
            if shift["direction"] == "larger":
                found.add(shift["key"])
    assert found & COGNITIVE, f"expected a cognitive item, got {found}"


def test_composition_shift_points_the_right_way():
    """A cognitive item must never be reported as a SMALLER share after short sleep."""
    for seed in range(6):
        for shift in composition_shift(to_episodes(make_rows(34, seed=seed))):
            if shift["key"] in COGNITIVE:
                assert shift["direction"] == "larger", shift
                assert shift["shiftPoints"] > 0


def test_separates_resolving_symptoms_from_stuck_ones():
    """The planted structure: somatic items ease, cognitive items do not."""
    rates = {r["key"]: r for r in recovery_rates(to_episodes(make_rows(34, seed=0)))}
    assert rates["headache"]["status"] == "easing"
    assert rates["nausea"]["status"] == "easing"
    # Cognitive items are planted flat against the overall downtrend, so the
    # model must NOT claim they are improving.
    for key in COGNITIVE:
        assert rates[key]["status"] != "easing", (key, rates[key])


def test_every_rate_reports_an_interval_containing_its_slope():
    for rate in recovery_rates(to_episodes(make_rows(30))):
        assert rate["ciLow"] <= rate["weeklyChange"] <= rate["ciHigh"]
        assert rate["status"] in ("easing", "worsening", "unclear")


def test_a_decided_direction_never_has_an_interval_straddling_zero():
    """The refusal mechanism.

    "Straddling" rather than "excluding": these are integer 0-6 ratings, so
    Theil-Sen's interval is built from a discrete set of pairwise slopes and its
    bound frequently lands exactly ON zero. Requiring strict exclusion threw
    away findings that were significant at p < 0.01 - the honest test is that
    the interval does not point both ways at once.
    """
    for seed in range(4):
        for rate in recovery_rates(to_episodes(make_rows(30, seed=seed))):
            if rate["status"] in ("easing", "worsening"):
                assert not (rate["ciLow"] < 0 < rate["ciHigh"]), rate
            if rate["status"] == "easing":
                assert rate["weeklyChange"] < 0, rate
            elif rate["status"] == "worsening":
                assert rate["weeklyChange"] > 0, rate


def test_a_strong_trend_is_not_discarded_on_an_interval_bound_of_zero():
    """Regression: the card was nearly empty on the demo dataset.

    All nine symptoms survived Holm at p < 0.01 with clearly negative slopes,
    and eight were reported "not clear yet" - because Theil-Sen's upper bound
    landed exactly on 0.0 on integer 0-6 data and the check required strict
    exclusion of zero. Evidence that strong must not be thrown away by an
    artefact of the rating scale.
    """
    rates = recovery_rates(to_episodes(make_rows(30, seed=1)))
    decided = [r for r in rates if r["status"] != "unclear"]
    assert len(decided) >= 2, [(r["label"], r["weeklyChange"], r["status"]) for r in rates]


def test_false_positive_rate_stays_low_on_trendless_symptoms():
    """The other side of the test above: loosening the bound must not open the
    door to calling noise a trend."""
    import numpy as np
    from datetime import date, timedelta

    from app.schemas import FeatureRow

    calls = 0
    runs = 10
    for seed in range(runs):
        rng = np.random.default_rng(seed)
        rows = []
        for i in range(30):
            items = {f"symptom_{k}": float(rng.integers(0, 7)) for k in SYMPTOM_KEYS}
            rows.append(
                FeatureRow(
                    nightOf=(date(2026, 1, 1) + timedelta(days=i)).isoformat(),
                    symptomBurden=float(sum(items.values())),
                    sleepDurationMinutes=float(rng.normal(420, 60)),
                    sleepQuality=float(rng.integers(0, 7)),
                    daysSinceInjury=i + 3,
                    dstAffected=0,
                    **items,
                )
            )
        calls += sum(
            1 for r in recovery_rates(to_episodes(rows)) if r["status"] != "unclear"
        )

    # 9 symptoms x 10 runs of pure noise. A handful is the cost of testing at
    # all; a large fraction would mean the correction had stopped working.
    assert calls <= 0.1 * runs * len(SYMPTOM_KEYS), calls


def test_undifferentiated_symptoms_produce_no_composition_finding():
    """Symptoms that all move together must not be given a distinction.

    The isotropic fixture still carries the overall recovery downtrend, so
    per-symptom RATES may legitimately fire - every symptom really is easing.
    What must not appear is a composition shift, because there is no difference
    in the SHAPE of the profile to find.
    """
    for seed in range(5):
        result = analyse(to_episodes(make_isotropic_rows(34, seed=seed)))
        assert result["shifts"] == [], result["shifts"]


def test_no_data_and_no_pattern_are_different_answers():
    """A user with plenty of nights and no pattern must not be told to log more.

    Constructed with genuinely trendless symptoms - no recovery trend at all -
    so the model has nothing whatever to report and has to say which kind of
    nothing it is.
    """
    import numpy as np
    from datetime import date, timedelta

    from app.schemas import FeatureRow

    rng = np.random.default_rng(0)
    rows = []
    for i in range(30):
        items = {f"symptom_{k}": float(rng.integers(0, 7)) for k in SYMPTOM_KEYS}
        rows.append(
            FeatureRow(
                nightOf=(date(2026, 1, 1) + timedelta(days=i)).isoformat(),
                symptomBurden=float(sum(items.values())),
                sleepDurationMinutes=float(rng.normal(420, 60)),
                sleepQuality=float(rng.integers(0, 7)),
                daysSinceInjury=i + 3,
                dstAffected=0,
                **items,
            )
        )

    result = analyse(to_episodes(rows))
    assert result["available"] is False
    assert "more nights" not in result["reason"]
    assert "moving together" in result["reason"]


def test_flat_and_sparse_data_never_crash_or_fabricate():
    for rows in (make_flat_rows(25), make_sparse_rows(25)):
        result = analyse(to_episodes(rows))
        assert result["available"] is False
        assert result["shifts"] == []
        assert result["summary"] is None


def test_pure_noise_is_usually_silent():
    """No planted per-symptom structure should mostly produce no shift."""
    noisy = sum(
        1
        for seed in range(12)
        if composition_shift(
            to_episodes(make_isotropic_rows(28, seed=seed, coupling=0.0, noise=6.0))
        )
    )
    # Some false positives are inherent at alpha=0.05 even after Holm; a
    # majority would mean the correction is not doing its job.
    assert noisy <= 4, f"{noisy}/12 noise datasets produced a shift finding"


def test_every_value_is_finite_and_json_safe():
    """A bare NaN is not valid JSON and 500s the whole batched call."""
    for rows in (make_rows(30), make_rows(11), make_isotropic_rows(30)):
        result = analyse(to_episodes(rows))
        for shift in result["shifts"]:
            assert np.isfinite(shift["shiftPoints"])
            assert np.isfinite(shift["pValue"])
        for rate in result["rates"]:
            assert all(
                np.isfinite(rate[k]) for k in ("weeklyChange", "ciLow", "ciHigh")
            )


def test_rates_cover_every_symptom_or_none():
    """Partial coverage would render a chart with silently missing bars."""
    rates = recovery_rates(to_episodes(make_rows(30)))
    assert {r["key"] for r in rates} == set(SYMPTOM_KEYS)


def test_statements_never_claim_causation():
    """Association only, matching the rule the correlation engine follows."""
    banned = ("causes", "caused", "due to", "because", "makes your", "leads to")
    for seed in range(5):
        result = analyse(to_episodes(make_rows(34, seed=seed)))
        texts = [s["statement"] for s in result["shifts"]]
        if result["summary"]:
            texts.append(result["summary"])
        for text in texts:
            lowered = text.lower()
            for word in banned:
                assert word not in lowered, f"{word!r} in {text!r}"


def test_statements_never_name_a_diagnosis():
    for seed in range(5):
        result = analyse(to_episodes(make_rows(34, seed=seed)))
        texts = [s["statement"] for s in result["shifts"]]
        if result["summary"]:
            texts.append(result["summary"])
        for text in texts:
            lowered = text.lower()
            for word in ("syndrome", "diagnos", "post-concussion", "recovered by"):
                assert word not in lowered, f"{word!r} in {text!r}"


def test_confidence_scales_with_the_models_own_floor():
    """A 10-night-floor model must not report 'good' at the 21 the forecast uses."""
    modest = analyse(to_episodes(make_rows(16)))
    assert modest["confidence"] in ("low", "moderate")
    plenty = analyse(to_episodes(make_rows(40)))
    assert plenty["confidence"] == "good"
