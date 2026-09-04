"""Sentiment scoring and the trajectory across entries.

Assertions here are RELATIVE and directional - `bad < 0 < good`, `negated <
plain` - never a pinned float. That is deliberate and load-bearing: the lexicon
is expected to grow, and every expansion legitimately shifts absolute scores. A
test pinning `score_text(...) == -0.42` would fail on every honest improvement
and teach the next person to loosen the assertion rather than check the change.

The one thing that must NOT drift is sign, and `test_signs_are_stable` pins that
over a hand-labelled corpus.
"""

from app.models.nlp import analyse, score_text
from app.models.nlp.lexicon import LEXICON, NEGATIONS
from app.models.nlp.tokens import lookup, preceded_by_negation, tokenise
from app.schemas import JournalText

from .fixtures import JOURNAL_CORPUS, SIGNED_ENTRIES


def test_negative_and_positive_text_score_in_the_right_direction():
    bad, _, _ = score_text("Today was awful, terrible headache and I felt exhausted and nauseous")
    good, _, _ = score_text("Felt good today, clear headed and rested, a really productive day")
    assert bad < 0 < good


def test_negation_flips_sentiment():
    plain, _, _ = score_text("I felt good today and was quite productive")
    negated, _, _ = score_text("I did not feel good today and was not productive")
    assert negated < plain


def test_intensifiers_strengthen_sentiment():
    mild, _, _ = score_text("the day was bad overall for me")
    strong, _, _ = score_text("the day was extremely bad overall for me")
    assert strong < mild


def test_too_short_or_empty_returns_none_not_zero():
    """A 0 would plot as a real, meaningfully-neutral day."""
    for text in ("", "   ", "ok", "fine thanks"):
        sentiment, _, _ = score_text(text)
        assert sentiment is None


def test_text_with_no_lexicon_words_returns_none():
    sentiment, words, hits = score_text("I went to the shop and then walked around the park")
    assert sentiment is None
    assert words > 0
    assert hits == 0


def test_scores_stay_bounded():
    extreme = " ".join(["awful terrible horrible unbearable excruciating"] * 20)
    sentiment, _, _ = score_text(extreme)
    assert -1.0 <= sentiment <= 1.0


def test_hits_are_reported_so_a_score_can_be_decomposed():
    """The auditability claim has to be checkable from the response."""
    _, _, hits = score_text("an awful and terrible and painful day")
    assert hits >= 3


# --- the lexicon itself ------------------------------------------------------


def test_lexicon_keys_are_matchable():
    """A key TOKEN_RE cannot match is dead code that looks live.

    Tokenising lowercases and strips apostrophes, then matches [a-z]+. So a key
    containing a digit, hyphen, space or apostrophe can never fire, and would sit
    in the audit table implying a behaviour the model does not have.
    """
    for key in LEXICON:
        assert key.isalpha() and key.islower(), key
    for word in NEGATIONS:
        assert word.isalpha() and word.islower(), word


def test_lexicon_weights_are_in_range_and_nonzero():
    for key, weight in LEXICON.items():
        assert weight != 0, key
        assert -3 <= weight <= 3, key


def test_walked_stays_out_of_the_lexicon():
    """Pins the exclusion that test_text_with_no_lexicon_words_returns_none needs.

    `walk` has no defensible standalone sign - "walked to the shop" against
    "managed a short walk" - so it is excluded on its own merits too. Named here
    so the reason survives someone adding it in a future expansion.
    """
    for word in ("walk", "walked", "walking"):
        assert lookup(word) is None


# --- suffix normalisation ----------------------------------------------------


def test_suffix_rules_reach_base_forms():
    """Every pair here is an inflection NOT present in the table as a key.

    Deliberately no self-comparisons: a row asserting lookup("x") == lookup("x")
    passes whether or not the machinery works, and two such rows were in the
    first version of this test.
    """
    for inflected, base in (
        ("headaches", "headache"),
        ("aching", "ache"),
        ("throbbed", "throb"),
        ("throbs", "throb"),
        ("tiredness", "tired"),
        ("slower", "slow"),
        ("pounded", "pound"),
        ("draining", "drain"),
    ):
        assert inflected not in LEXICON, f"{inflected} is a key, so it tests nothing"
        assert lookup(inflected) is not None, inflected
        assert lookup(inflected) == lookup(base), inflected


def test_suffix_rules_cannot_manufacture_a_match():
    """A stripped form counts only if it is itself in the lexicon.

    Without the minimum stem length these become `s`, `t` and `r` - and any
    single letter that happened to be a key would score an unrelated word.
    """
    for word in ("sing", "ties", "ring", "bring", "thing"):
        assert lookup(word) is None, word


def test_stripping_never_flips_a_sign():
    """-less reverses sense, which is why it is not a rule.

    `sleepless` must not inherit anything from `sleep`, and it is listed with its
    own negative weight instead.
    """
    assert lookup("sleepless") < 0


def test_negations_are_spelled_apostrophe_free():
    """Tokenising strips apostrophes, so "didn't" arrives as "didnt"."""
    tokens = tokenise("I didn't feel good and couldn't concentrate")
    assert "didnt" in tokens
    assert "couldnt" in tokens
    assert preceded_by_negation(tokens, tokens.index("good"))


def test_curly_apostrophes_are_stripped_too():
    """The apostrophe a phone actually inserts.

    iOS and macOS substitute U+2019 by default, and most journal entries in this
    app will be typed on a phone. Handling only the straight quote left
    "didn't feel good" tokenising as "didn" + "t" + ... - no negation matched,
    and the entry scored POSITIVE on the word `good`.
    """
    straight = "I didn't feel good today at all"
    curly = straight.replace("'", "\u2019")

    assert tokenise(curly) == tokenise(straight)
    assert score_text(curly)[0] == score_text(straight)[0]
    assert score_text(curly)[0] < 0


# --- coverage, measured not asserted -----------------------------------------


def _corpus_metrics():
    scored = 0
    hit_rates = []
    for text in JOURNAL_CORPUS:
        sentiment, words, hits = score_text(text)
        if sentiment is not None:
            scored += 1
        if words:
            hit_rates.append(hits / words)
    return scored / len(JOURNAL_CORPUS), sum(hit_rates) / len(hit_rates)


def test_lexicon_covers_the_corpus():
    """Coverage is measured against held-out text, not only the demo seed.

    Half of JOURNAL_CORPUS is written with vocabulary the seed never uses, so
    this cannot be satisfied by a lexicon that merely memorised the demo.
    """
    scored_fraction, hit_rate = _corpus_metrics()
    assert scored_fraction >= 0.90, scored_fraction
    # Recorded in docs/tasks.md rather than treated as a target to optimise. The
    # floor is where the expanded lexicon sits with headroom, so an accidental
    # deletion of a whole group fails this.
    assert hit_rate >= 0.15, hit_rate


def test_signs_are_stable():
    """The regression net for lexicon growth. Signs only, never magnitudes."""
    for text, expected_sign in SIGNED_ENTRIES:
        sentiment, _, _ = score_text(text)
        assert sentiment is not None, text
        assert (sentiment > 0) == (expected_sign > 0), (text, sentiment)


# --- the envelope ------------------------------------------------------------


EXPECTED_KEYS = {
    "available", "reason", "confidence", "nDays",
    "points", "trend", "meanSentiment", "mentions", "complexity",
}


def test_every_refusal_path_returns_the_full_envelope():
    """No partial dicts. A missing key is how a client renders `undefined`."""
    paths = [
        analyse([]),
        analyse([JournalText(nightOf="2026-01-01", day="ok")]),
        analyse([
            JournalText(nightOf=f"2026-01-{i:02d}", day="a rough and painful tiring day")
            for i in range(1, 7)
        ]),
    ]
    for result in paths:
        assert set(result) == EXPECTED_KEYS, set(result) ^ EXPECTED_KEYS


def test_available_response_also_returns_the_full_envelope():
    texts = [
        JournalText(nightOf=f"2026-01-{i:02d}", day="a rough and painful tiring day")
        for i in range(1, 9)
    ]
    assert set(analyse(texts)) == EXPECTED_KEYS


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


def test_short_entries_plot_but_do_not_move_the_mean():
    """An entry of one lexicon hit is a word's valence, not a day's tone.

    It still appears as a point - the user wrote it - but must not drag a
    summary figure that reads as a description of weeks.
    """
    long_negative = "an awful and painful and exhausting and miserable rough day"
    texts = [
        JournalText(nightOf=f"2026-01-{i:02d}", day=long_negative) for i in range(1, 9)
    ]
    baseline = analyse(texts)["meanSentiment"]

    # Add short, strongly-positive entries: over MIN_WORDS so they score and
    # plot, under MIN_WORDS_FOR_AGGREGATE so the mean should be unmoved.
    texts += [
        JournalText(nightOf=f"2026-01-{i:02d}", day="felt absolutely wonderful")
        for i in range(9, 13)
    ]
    result = analyse(texts)

    assert len(result["points"]) == 12
    assert result["meanSentiment"] == baseline
