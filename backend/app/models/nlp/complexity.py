"""How a person's writing is changing over time.

This is the weakest model in the app, and it is built and framed accordingly.
Read the refusals before the method - they are most of the design.

## What it measures

Two quantities per entry, both computable without a sentence segmenter and
without a window:

1. MEAN WORD LENGTH in characters over content tokens.
2. REPEAT RATE - the share of content tokens that are repeats within the entry.

Then the TREND of each across entries, and at most one sentence about the one
that moves. Never a level, never a score, never a comparison to anyone else.

## Deliberately NOT here

Every standard readability and lexical-diversity measure was costed against this
app's actual text and rejected. Entry lengths, measured from the app's own
corpus (lib/demoSeed.js), run 4-13 tokens per field and 10-25 tokens combined.

- RAW TYPE-TOKEN RATIO. Monotonically decreasing in text length, severely so
  below 100 tokens - that is every entry here. Two entries of 12 and 24 tokens
  are not comparable, so a trend in TTR over entries of varying length is mostly
  a trend in length.
- MATTR / MSTTR, the standard corrections for exactly that bias. MATTR's window
  is 50 tokens and MSTTR's segments are 100. EVERY ENTRY IN THIS APP IS SHORTER
  THAN ONE WINDOW. The correction is not computable on this data, which is the
  cleanest possible reason to drop the measure rather than approximate it.
- MEAN SENTENCE LENGTH and every syllable-based readability formula
  (Flesch-Kincaid, SMOG, Coleman-Liau). All are defined over sentences, and
  there is no segmenter here; worse, `analyse` concatenates three separate
  fields with a space, so field boundaries silently become or fail to become
  sentence boundaries. These formulas are validated on documents of hundreds of
  words. Applied to a 15-word fragment, Flesch-Kincaid is not an approximation
  of the intended measurement - it is a different measurement wearing its name.

Repeat rate is kept instead of TTR because it is bounded, defined on any length,
and reported only through its direction. It is still length-sensitive, which is
precisely why no level is ever shown.

## The confound this model exists to survive

Entry length in this app is CORRELATED WITH MOOD. In the app's own corpus the
"okay day" entries are the shortest, and two of the three text fields
(`factors`, `wakeFeeling`) are left empty on exactly the kind of day the metric
would otherwise appear to detect. A naive complexity trend would rediscover the
sentiment score and re-present it as a finding about cognition.

So both metrics are RESIDUALISED ON ENTRY LENGTH before their trend is taken:
fit the metric against token count with Theil-Sen, then test the residuals
against entry index with Kendall's tau. What survives is the part of the change
that is not explained by the entries getting shorter or longer.

## What this model must never say

It describes THE WRITING, never the writer. It does not mention cognition,
cognitive load, concentration, brain fog, decline, or impairment, and a test
asserts that vocabulary never appears in generated text. A change in how someone
writes has several likelier explanations than any clinical one - being in a
hurry, typing on a phone, having less to say on a good day, or skipping a field
- and the card names them rather than leaving the reader to supply the
frightening interpretation on their own.
"""

import numpy as np
from scipy import stats

from ..confidence import MIN_FOR_COMPLEXITY, tier_for_model
from .tokens import tokenise

ALPHA = 0.05

# Tokens carrying no lexical content. Kept short and closed rather than importing
# a stopword corpus: these are the words whose repetition says nothing about how
# someone is writing, and a longer list starts removing content in short text.
STOPWORDS = frozenset({
    "a", "an", "and", "the", "of", "to", "in", "on", "at", "for", "with",
    "it", "its", "is", "was", "were", "be", "been", "am", "are", "i", "im",
    "me", "my", "myself", "we", "our", "you", "your", "he", "she", "they",
    "them", "this", "that", "these", "those", "then", "than", "so", "but",
    "or", "if", "as", "up", "out", "off", "by", "from", "had", "has", "have",
    "did", "do", "does", "not", "no", "all", "very", "just", "about", "got",
    "get", "went", "day", "today", "bit", "much", "some", "any", "there",
})

# Fewest content tokens an entry needs before its metrics mean anything. Below
# four content words, "mean word length" is one or two words and "repeat rate"
# is almost always exactly zero.
MIN_CONTENT_TOKENS = 4

# |tau| below this is not a direction worth a sentence even where it clears the
# significance test. Kendall's tau of 0.3 is a visible, consistent drift; below
# that the reader would not see it in their own entries if they went looking,
# which is the standard this model has to meet.
MIN_ABS_TAU = 0.30

METRIC_LABELS = {
    "wordLength": "using shorter words",
    "variety": "repeating words more",
}


def _holm(tested: list[tuple]) -> list[tuple]:
    """Holm-Bonferroni step-down. Items are (..., p) with p last.

    Same shape as the loop in symptoms.py and correlation.py, deliberately: this
    project applies one multiple-comparison discipline, not a different one per
    file. Two tests is a small surface, but "only two" is how a project ends up
    with three different rules.
    """
    ordered = sorted(tested, key=lambda t: t[-1])
    m = len(ordered)
    surviving = []
    for i, item in enumerate(ordered):
        if item[-1] <= ALPHA / (m - i):
            surviving.append(item)
        else:
            break  # everything after a failure is rejected too
    return surviving


def _content_tokens(text: str) -> list[str]:
    return [t for t in tokenise(text) if t not in STOPWORDS]


def measure(text: str) -> "dict | None":
    """One entry -> its raw metrics, or None if there is too little to measure."""
    content = _content_tokens(text)
    if len(content) < MIN_CONTENT_TOKENS:
        return None
    distinct = len(set(content))
    return {
        "words": len(tokenise(text)),
        "wordLength": float(np.mean([len(t) for t in content])),
        # Share of content tokens that are repeats. 0 when every word differs.
        "variety": 1.0 - (distinct / len(content)),
    }


def _residualise(values: np.ndarray, lengths: np.ndarray) -> np.ndarray:
    """Remove the part of `values` explained by entry length.

    Theil-Sen rather than least squares, matching the rank-based philosophy in
    symptoms.py: these are short texts and one unusually long entry must not set
    the slope that everything else is corrected against.

    When length does not vary there is nothing to remove and the raw series is
    returned - guarded explicitly rather than letting a degenerate fit produce
    a nan that silently propagates into the tau.
    """
    if len(values) < 3 or float(np.std(lengths)) < 1e-9:
        return values
    try:
        slope, intercept, _, _ = stats.theilslopes(values, lengths)
    except (ValueError, ZeroDivisionError):
        return values
    if not np.isfinite(slope) or not np.isfinite(intercept):
        return values
    return values - (slope * lengths + intercept)


def analyse(entries: list[dict]) -> dict:
    """Direction of change in how the user writes.

    `entries` is [{nightOf, text}], already date-ordered by the caller.
    """
    measured = []
    for entry in entries:
        m = measure(entry["text"])
        if m is None:
            continue
        measured.append(m)

    n = len(measured)

    if n < MIN_FOR_COMPLEXITY:
        missing = MIN_FOR_COMPLEXITY - n
        entry_word = "entry" if missing == 1 else "entries"
        return {
            "available": False,
            # Counts journal entries with enough content to measure, which is
            # stricter than either "nights logged" or "entries written". Saying
            # "nights" here would send someone to log sleep to unlock a feature
            # that only reads text.
            "reason": (
                f"{missing} more journal {entry_word} with a little more writing "
                "and MyLumi can look at how your entries are changing."
            ),
            "confidence": "none",
            "nDays": n,
            "finding": None,
        }

    index = np.arange(n, dtype=float)
    lengths = np.asarray([m["words"] for m in measured], dtype=float)

    tested = []
    for metric in ("wordLength", "variety"):
        raw = np.asarray([m[metric] for m in measured], dtype=float)
        if float(np.std(raw)) < 1e-9:
            continue
        residuals = _residualise(raw, lengths)
        if float(np.std(residuals)) < 1e-9:
            continue
        try:
            tau, p = stats.kendalltau(index, residuals)
        except (ValueError, ZeroDivisionError):
            continue
        if not np.isfinite(tau) or not np.isfinite(p):
            continue
        tested.append((metric, float(tau), float(p)))

    surviving = [t for t in _holm(tested) if abs(t[1]) >= MIN_ABS_TAU]

    if not surviving:
        return {
            "available": True,
            "reason": None,
            "confidence": tier_for_model(n, MIN_FOR_COMPLEXITY),
            "nDays": n,
            # No direction that clears both floors. Reported as a finding of
            # nothing rather than as unavailability: the model ran, had enough
            # data, and found no drift. That is an answer.
            "finding": None,
        }

    # At most one. Two simultaneous sentences about how someone writes, from a
    # measurement this weak, would read as a body of evidence rather than as the
    # single weak signal it is.
    metric, tau, _ = max(surviving, key=lambda t: abs(t[1]))
    direction = "rising" if tau > 0 else "falling"

    return {
        "available": True,
        "reason": None,
        "confidence": tier_for_model(n, MIN_FOR_COMPLEXITY),
        "nDays": n,
        "finding": {
            "metric": metric,
            "direction": direction,
            "tau": round(tau, 3),
            "statement": _statement(metric, direction, n),
        },
    }


def _statement(metric: str, direction: str, n: int) -> str:
    """Plain English about the writing. Never about the writer.

    Deliberately hedged in its verb ("have been", not "are") and explicitly
    scoped to the entries. The alternative explanations are named in the card
    rather than here, because they belong next to the sentence a person reads
    and this string is also what a screen reader announces on its own.
    """
    change = {
        ("wordLength", "falling"): "using shorter words",
        ("wordLength", "rising"): "using longer words",
        ("variety", "rising"): "repeating words more",
        ("variety", "falling"): "repeating words less",
    }[(metric, direction)]
    return (
        f"Across your last {n} journal entries, your writing has been {change}. "
        "This describes the entries themselves, not you."
    )
