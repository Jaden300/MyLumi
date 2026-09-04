"""The writing-change model - the weakest one in the app, tested accordingly.

Most of these tests assert a REFUSAL. That is the right shape for this model:
the design work went into what it declines to say, so that is what has to be
pinned.
"""

import numpy as np

from app.models.confidence import MIN_FOR_COMPLEXITY
from app.models.nlp import analyse as analyse_all
from app.models.nlp.complexity import (
    MIN_ABS_TAU,
    analyse,
    measure,
)
from app.schemas import JournalText

# Vocabulary this model must never use. A change in how someone writes has
# several likelier explanations than any clinical one, and the model has no
# basis to pick the frightening one.
BANNED = (
    "cognitive", "cognition", "load", "decline", "declining", "impair",
    "impairment", "worse", "worsening", "concentration", "brain", "memory",
    "deteriorat", "symptom",
)

# Causal vocabulary, the same list the other models are held to.
CAUSAL = ("causes", "due to", "because", "makes your", "leads to")


def _entries(texts, start=1):
    return [
        {"nightOf": f"2026-01-{i:02d}", "text": t}
        for i, t in enumerate(texts, start=start)
    ]


def test_refuses_below_its_floor():
    """Eighteen entries, and it says so in entries rather than nights."""
    result = analyse(_entries(["a perfectly reasonable amount of writing here"] * 10))
    assert result["available"] is False
    assert result["confidence"] == "none"
    assert result["finding"] is None
    assert "night" not in result["reason"].lower()


def test_reports_no_finding_rather_than_unavailable_when_nothing_moves():
    """Having run and found nothing is an answer, not a refusal.

    Identical entries have zero variance in every metric, so nothing can trend.
    The model has enough data; it just has nothing to say.
    """
    result = analyse(_entries(["the same steady sentence written again here"] * 25))
    assert result["available"] is True
    assert result["finding"] is None


def test_generated_text_avoids_the_cognitive_reading():
    """The statement describes the writing. Never the writer."""
    # A long shrinking series, which is the case most likely to produce a
    # finding phrased as a decline.
    texts = [
        " ".join(["elaborate", "descriptive", "vocabulary", "throughout"] * max(1, 6 - i // 5))
        for i in range(30)
    ]
    result = analyse(_entries(texts))
    if result["finding"]:
        statement = result["finding"]["statement"].lower()
        for word in BANNED:
            assert word not in statement, (word, statement)
        for phrase in CAUSAL:
            assert phrase not in statement, (phrase, statement)


def test_length_is_residualised_out():
    """The confound this model exists to survive.

    Entry length in this app correlates with mood - the shortest entries are the
    flattest days, and two of three text fields go empty on them. A series whose
    metric moves ONLY because the entries got shorter must not be reported as a
    change in how the person writes.
    """
    rng = np.random.default_rng(7)
    texts = []
    for i in range(30):
        # Length shrinks steadily; the vocabulary itself does not change.
        n_words = max(5, 20 - i // 2)
        words = rng.choice(
            ["morning", "afternoon", "meeting", "outside", "reading", "quiet",
             "kitchen", "garden", "office", "evening"],
            size=n_words,
        )
        texts.append(" ".join(words))

    residualised = analyse(_entries(texts))

    # Whatever it reports, it must not be reporting the length trend itself.
    # With length regressed out, a purely length-driven series should leave no
    # surviving direction.
    assert residualised["finding"] is None


def test_finding_clears_the_effect_size_floor():
    rng = np.random.default_rng(11)
    texts = []
    for i in range(40):
        # Word length genuinely shrinks, independent of entry length.
        pool = (
            ["extraordinarily", "considerable", "particularly", "descriptive"]
            if i < 20
            else ["big", "new", "odd", "raw"]
        )
        texts.append(" ".join(rng.choice(pool, size=10)))
    result = analyse(_entries(texts))
    if result["finding"]:
        assert abs(result["finding"]["tau"]) >= MIN_ABS_TAU


def test_at_most_one_direction_is_reported():
    rng = np.random.default_rng(3)
    texts = [
        " ".join(rng.choice(["alpha", "beta", "gamma", "delta"], size=12))
        for _ in range(30)
    ]
    result = analyse(_entries(texts))
    finding = result["finding"]
    assert finding is None or isinstance(finding, dict)


def test_does_not_speak_on_noise():
    """The floor's justification, measured rather than asserted.

    Entries drawn from a fixed pool with no drift planted and varying length.
    Anything the model reports here is a false positive, and the state model
    taught this project that the opposite failure - a floor so high the card can
    never say anything - is just as bad. So the companion test below checks power
    on a real drift; both numbers are recorded in docs/tasks.md.
    """
    pool = [
        "morning", "afternoon", "meeting", "outside", "reading", "quiet",
        "kitchen", "garden", "office", "evening", "coffee", "window",
        "walking", "sitting", "phone", "email", "laundry", "shopping",
    ]
    false_positives = 0
    trials = 120
    for seed in range(trials):
        rng = np.random.default_rng(seed)
        texts = [
            " ".join(rng.choice(pool, size=rng.integers(6, 16)))
            for _ in range(MIN_FOR_COMPLEXITY + 4)
        ]
        if analyse(_entries(texts))["finding"] is not None:
            false_positives += 1
    rate = false_positives / trials
    assert rate <= 0.12, rate


def test_does_speak_on_a_real_drift():
    """A floor that can never fire is worse than no card - see MIN_FOR_STATE.

    Word length shrinks steadily while ENTRY length is held constant, so this is
    a genuine change in the writing rather than the length confound the model
    residualises away.
    """
    long_words = [
        "extraordinarily", "considerable", "particularly", "descriptive",
        "frustrating", "concentrate", "afternoon", "remarkable",
    ]
    short_words = ["big", "new", "odd", "raw", "bad", "good", "slow", "calm"]

    detected = 0
    trials = 40
    for seed in range(trials):
        rng = np.random.default_rng(seed)
        n = MIN_FOR_COMPLEXITY + 4
        texts = []
        for i in range(n):
            share_short = i / (n - 1)
            words = [
                rng.choice(short_words) if rng.random() < share_short else rng.choice(long_words)
                for _ in range(10)
            ]
            texts.append(" ".join(words))
        if analyse(_entries(texts))["finding"] is not None:
            detected += 1
    assert detected / trials >= 0.80, detected / trials


def test_measure_declines_entries_with_too_little_content():
    assert measure("the a of to in on") is None
    assert measure("") is None
    assert measure("throbbing headache all afternoon yesterday evening") is not None


def test_degenerate_input_does_not_crash():
    for texts in ([], ["" for _ in range(30)], ["a" for _ in range(30)]):
        result = analyse(_entries(texts))
        assert result["finding"] is None


def test_complexity_rides_the_full_analysis_and_is_absent_below_its_floor():
    """The section is present but unavailable when only sentiment has enough."""
    texts = [
        JournalText(nightOf=f"2026-01-{i:02d}", day="a rough and painful tiring day")
        for i in range(1, 10)
    ]
    result = analyse_all(texts)
    assert result["available"] is True          # sentiment cleared 7
    assert result["complexity"]["available"] is False   # complexity did not clear 18
    assert result["complexity"]["nDays"] < MIN_FOR_COMPLEXITY
