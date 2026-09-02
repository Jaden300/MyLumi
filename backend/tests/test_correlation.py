from app.models.correlation import correlate
from app.models.features import to_episodes

from .fixtures import make_flat_rows, make_rows


def test_below_threshold_reports_nothing():
    for n in range(0, 7):
        result = correlate(to_episodes(make_rows(n)))
        assert result["available"] is False
        assert result["findings"] == []


def test_recovers_the_planted_sleep_relationship():
    """If it can't find an effect we deliberately planted, it can't find a real one."""
    result = correlate(to_episodes(make_rows(40, coupling=5.0, noise=1.5)))
    assert result["available"] is True
    features = {f["feature"] for f in result["findings"]}
    assert "sleepDurationHours" in features

    finding = next(f for f in result["findings"] if f["feature"] == "sleepDurationHours")
    # More sleep -> less burden, so the rank correlation must be negative.
    assert finding["rho"] < 0
    assert finding["pValue"] < 0.05
    assert finding["n"] >= 7


def test_findings_never_claim_causation():
    """A correlation on a few dozen self-reports cannot support a causal claim."""
    result = correlate(to_episodes(make_rows(40, coupling=5.0, noise=1.5)))
    banned = ("causes", "caused", "because of", "due to", "makes your", "will make")
    for finding in result["findings"]:
        text = (finding["statement"] + " " + (finding["thresholdStatement"] or "")).lower()
        for phrase in banned:
            assert phrase not in text, f"causal phrasing {phrase!r} in: {text}"


def test_statement_direction_matches_the_data():
    """Guards against the sentence saying the exact opposite of the finding.

    The planted effect is: LESS sleep -> HEAVIER next day. So a sleep-duration
    finding must talk about burden being higher after *less* sleep. An earlier
    version paired the direction word with "better" and produced "higher on days
    following better sleep duration" - true rho, inverted English.
    """
    result = correlate(to_episodes(make_rows(45, coupling=6.0, noise=1.0)))
    for finding in result["findings"]:
        statement = finding["statement"].lower()
        if finding["feature"] in ("sleepDurationHours", "sleepQuality"):
            assert finding["rho"] < 0, "fixture plants more sleep -> less burden"
            assert "following less" in statement or "following lower" in statement, statement
            assert "following more" not in statement and "following higher" not in statement


def test_threshold_sentence_agrees_with_its_finding():
    """The threshold sentence must not contradict the statement above it."""
    result = correlate(to_episodes(make_rows(45, coupling=6.0, noise=1.0)))
    for finding in result["findings"]:
        if not finding["thresholdStatement"]:
            continue
        if finding["feature"] in ("sleepDurationHours", "sleepQuality"):
            # Less sleep is the bad side, so the burden warning is about "under".
            assert "under" in finding["thresholdStatement"].lower()


def test_produces_the_quotable_threshold_sentence():
    """MyLumi_Plan.md 3.3c asks for this shape of sentence specifically."""
    result = correlate(to_episodes(make_rows(45, coupling=6.0, noise=1.0)))
    statements = [f["thresholdStatement"] for f in result["findings"] if f["thresholdStatement"]]
    assert statements, "expected at least one threshold finding"
    assert any("following" in s and "burden" in s for s in statements)


def test_flat_data_produces_no_spurious_correlation():
    """Zero variance must yield nothing, not a divide-by-zero or a perfect rho."""
    result = correlate(to_episodes(make_flat_rows(25)))
    assert result["findings"] == []
    assert result["available"] is False


def test_pure_noise_is_usually_silent():
    """No planted effect -> should mostly report nothing across seeds."""
    noisy = sum(
        1
        for seed in range(12)
        if correlate(to_episodes(make_rows(25, seed=seed, coupling=0.0, noise=6.0)))["available"]
    )
    # Some false positives are inherent at alpha=0.05; a majority would mean the
    # guardrails are not working.
    assert noisy <= 4, f"{noisy}/12 noise datasets produced findings"


def test_no_pattern_is_distinguished_from_no_data():
    """A clean null result is information and must not read as 'keep logging'."""
    result = correlate(to_episodes(make_flat_rows(25)))
    assert "more complete nights" not in (result["reason"] or "")


def test_findings_are_capped_and_ranked():
    result = correlate(to_episodes(make_rows(50, coupling=5.0, noise=1.5)))
    assert len(result["findings"]) <= 3
    rhos = [abs(f["rho"]) for f in result["findings"]]
    assert rhos == sorted(rhos, reverse=True)
