from app.models.nlp import analyse, score_text
from app.schemas import JournalText


def test_negative_and_positive_text_score_in_the_right_direction():
    bad, _ = score_text("Today was awful, terrible headache and I felt exhausted and nauseous")
    good, _ = score_text("Felt good today, clear headed and rested, a really productive day")
    assert bad < 0 < good


def test_negation_flips_sentiment():
    plain, _ = score_text("I felt good today and was quite productive")
    negated, _ = score_text("I did not feel good today and was not productive")
    assert negated < plain


def test_intensifiers_strengthen_sentiment():
    mild, _ = score_text("the day was bad overall for me")
    strong, _ = score_text("the day was extremely bad overall for me")
    assert strong < mild


def test_too_short_or_empty_returns_none_not_zero():
    """A 0 would plot as a real, meaningfully-neutral day."""
    for text in ("", "   ", "ok", "fine thanks"):
        sentiment, _ = score_text(text)
        assert sentiment is None


def test_text_with_no_lexicon_words_returns_none():
    sentiment, words = score_text("I went to the shop and then walked around the park")
    assert sentiment is None
    assert words > 0


def test_scores_stay_bounded():
    extreme = " ".join(["awful terrible horrible unbearable excruciating"] * 20)
    sentiment, _ = score_text(extreme)
    assert -1.0 <= sentiment <= 1.0


def test_trajectory_detects_improvement():
    texts = [
        JournalText(nightOf="2026-01-01", day="awful terrible day, severe pain and exhausted"),
        JournalText(nightOf="2026-01-02", day="bad day, painful and very tired throughout"),
        JournalText(nightOf="2026-01-03", day="a rough day but somewhat manageable overall"),
        JournalText(nightOf="2026-01-04", day="still sore but a little steadier than before"),
        JournalText(nightOf="2026-01-05", day="better today, felt calmer and more settled"),
        JournalText(nightOf="2026-01-06", day="a clearer day, rested and much more comfortable"),
        JournalText(nightOf="2026-01-07", day="good day, clear and rested and quite productive"),
    ]
    result = analyse(texts)
    assert result["available"] is True
    assert result["trend"] == "improving"
    assert result["nDays"] == 7


def test_refuses_below_the_threshold():
    """Sentiment is gated exactly like the numeric models: under the threshold
    it emits no number, rather than a score labelled `confidence: none`."""
    texts = [
        JournalText(nightOf=f"2026-01-{i:02d}", day="a rough and painful tiring day")
        for i in range(1, 7)
    ]
    result = analyse(texts)

    assert result["available"] is False
    assert result["confidence"] == "none"
    assert result["meanSentiment"] is None
    assert result["points"] == []
    # Counts journal entries, not sleep - the copy must not send the user to bed.
    assert "night" not in result["reason"].lower()


def test_empty_input_is_unavailable_not_a_crash():
    result = analyse([])
    assert result["available"] is False
    assert result["points"] == []
    assert result["meanSentiment"] is None


def test_entries_are_ordered_by_date():
    # Deliberately shuffled, and enough of them to clear the threshold.
    days = ["a good and restful clear day", "an awful painful exhausting day"]
    texts = [
        JournalText(nightOf=f"2026-01-{i:02d}", day=days[i % 2])
        for i in (5, 1, 7, 3, 2, 6, 4)
    ]
    points = analyse(texts)["points"]
    assert [p["nightOf"] for p in points] == [f"2026-01-0{i}" for i in range(1, 8)]
