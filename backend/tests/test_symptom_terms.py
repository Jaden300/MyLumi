"""Symptom-term extraction.

This model returns word counts and nothing else. Everything it must NOT do -
compare against ratings, judge, conclude - is enforced by the fact that the
ratings are not in this request at all.
"""

from app.models.nlp import analyse
from app.models.nlp.symptom_terms import (
    SYMPTOM_TERMS,
    clinical_keys,
    extract,
    mentions,
    vocabulary_keys,
)
from app.schemas import JournalText


def test_vocabulary_covers_exactly_the_clinical_items():
    """A tenth symptom cannot be added on one side only.

    The vocabulary is keyed by SYMPTOM_KEYS imported from features.py rather
    than redeclared, so this asserts the import did its job and that nobody
    added a key here that no check-in produces.
    """
    assert vocabulary_keys() == clinical_keys()


def test_extracts_the_obvious_mentions():
    counts = extract("Bad headache all afternoon and felt dizzy standing up")
    assert counts["headache"] >= 1
    assert counts["dizziness"] >= 1


def test_output_is_sparse():
    """Nine zeros a night is 360 numbers across six weeks saying nothing."""
    counts = extract("A quiet day, nothing much to report at all")
    assert all(v > 0 for v in counts.values())


def test_negation_suppresses_a_mention():
    """"No headache today" is a report of no headache.

    Counting it would invert the finding for exactly the most careful
    journallers - the people who write down what did NOT happen.
    """
    assert "headache" not in extract("No headache today, which was a relief")
    assert "nausea" not in extract("I did not feel nauseous at any point")
    assert "headache" in extract("A headache today, unfortunately")


def test_ambiguous_words_are_excluded():
    """Pins the exclusions listed in the module docstring.

    Each of these was in a draft. Without the test, a future expansion adding
    `light` back would silently reclassify half the corpus.
    """
    # "light" as brightness vs. a light meal - and light-headed, which tokenises
    # to `light` + `headed` and would file dizziness under photophobia.
    assert "photophobia" not in extract("Had a light lunch and felt fine after")
    assert "photophobia" not in extract("It was dark by the time I got home")
    # bare "low" and "energy" cannot tell fatigue from mood
    assert extract("Low on energy but in good spirits") == {} or (
        "fatigue" not in extract("Low on energy but in good spirits")
    )
    # "sick of it" is not nausea
    assert "nausea" not in extract("Honestly sick of this whole thing")


def test_hedged_mentions_are_not_counted():
    """"A bit tired" is not the claim "exhausted" makes.

    Found by running the extractor against the app's real demo seed rather than
    against fixtures. "A bit tired but okay overall" is one of the demo's
    MILD-day strings, so counting its hedge as a full mention put fatigue
    mentions on the lowest-rated nights and produced a confident finding that
    read "you wrote about fatigue on nights you rated it lower" - entirely an
    artefact of weighting a hedge like a report.

    This model has only a count to express itself with, so where the sentiment
    scorer scales a weight, the honest equivalent here is not to count.
    """
    assert "fatigue" not in extract("A bit tired but okay overall")
    assert "headache" not in extract("A slight headache in the evening only")
    assert "nausea" not in extract("Felt mildly queasy for a moment")
    # The unhedged forms still count.
    assert "fatigue" in extract("Tired and irritable for most of the day")
    assert "headache" in extract("A headache in the evening that would not shift")


def test_a_negated_hedge_is_still_just_negated():
    """The two rules must not double-count each other."""
    assert extract("Not a bit better, honestly awful") == {} or (
        "fatigue" not in extract("Not a bit better, honestly awful")
    )


def test_inflections_are_matched():
    """Shares the tokeniser with sentiment, so the two cannot disagree."""
    assert "headache" in extract("Headaches every afternoon this week")
    assert "concentration" in extract("Kept forgetting things all day long")


def test_mentions_are_returned_for_entries_with_no_sentiment_score():
    """The two lists are parallel, not aligned.

    An entry can mention a symptom while producing no sentiment score, so
    `mentions` must not be derived from `points`.
    """
    entries = [{"nightOf": "2026-01-01", "text": "screens all day at the desk"}]
    result = mentions(entries)
    assert result and result[0]["mentions"].get("photophobia", 0) >= 1


def test_entries_with_no_symptom_words_are_omitted():
    entries = [{"nightOf": "2026-01-01", "text": "a perfectly ordinary quiet day"}]
    assert mentions(entries) == []


def test_mentions_ride_the_full_analysis():
    texts = [
        JournalText(
            nightOf=f"2026-01-{i:02d}",
            day="Bad headache again today and quite dizzy this afternoon",
        )
        for i in range(1, 9)
    ]
    result = analyse(texts)
    assert result["available"] is True
    assert len(result["mentions"]) == 8
    assert result["mentions"][0]["mentions"]["headache"] >= 1


def test_vocabulary_terms_are_matchable():
    """Same rule as the lexicon: a term TOKEN_RE cannot match is dead code."""
    for key, terms in SYMPTOM_TERMS.items():
        for term in terms:
            assert term.isalpha() and term.islower(), (key, term)
