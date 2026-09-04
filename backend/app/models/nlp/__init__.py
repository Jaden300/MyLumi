"""Journal text models. Sentiment, writing change, and symptom mentions.

A lexicon scorer, not a transformer. Three reasons, in order of weight:

1. It runs in milliseconds with no model download, so the free-tier service stays
   small and cold-starts fast - the single biggest demo risk in this project.
2. It is fully inspectable. Every score decomposes into the specific words that
   produced it, which is what the Responsible AI story requires. A fine-tuned
   classifier's output is not explainable to a patient reading a recovery card.
3. Journal entries here are short first-person mood reports, which is close to
   the best case for lexicon methods.

The honest limitation, stated plainly in docs/responsible-ai.md: this cannot read
sarcasm or context, and it is a SECONDARY signal presented alongside the numeric
data, never a substitute for it (MyLumi_Plan.md 3.3b).

Text arrives here only via an explicit consent step in the UI, is used for this
one request, and is never written to disk or logged.

## Why this is a package

One file holding a 300-word audit table, a scorer, a trend model, a complexity
model and a symptom vocabulary would be the longest and least readable module in
a codebase whose whole argument is that a person can check its reasoning. Split
so each file answers one question:

    lexicon.py        what the model believes about words   (data only)
    tokens.py         what counts as a word, and as a match
    sentiment.py      how one entry scores, and the trend
    complexity.py     how the writing itself is changing
    symptom_terms.py  which symptoms an entry mentions

## The three models and what each refuses

SENTIMENT refuses to score an entry under three words, refuses to aggregate one
under eight, and refuses any output at all below seven scorable entries.

COMPLEXITY is the weakest model in the app. It refuses to speak below eighteen
entries, residualises on entry length before testing anything, and refuses the
cognitive reading entirely - see its docstring, which records the four standard
readability measures that were costed and rejected as uncomputable on 10-25 token
entries.

SYMPTOM MENTIONS refuses to compare. It returns word counts; the comparison
against what the user actually rated happens in the browser, because doing it
here would mean holding text and clinical scores in one request.
"""

from ..confidence import MIN_FOR_ANY_INSIGHT, has_enough, tier_for
from . import complexity as complexity_model
from . import symptom_terms
from .lexicon import DIMINISHERS, INTENSIFIERS, LEXICON, NEGATIONS
from .sentiment import (
    MIN_POINTS_FOR_TREND,
    MIN_WORDS,
    MIN_WORDS_FOR_AGGREGATE,
    score_text,
    trend_for,
)
from .tokens import TOKEN_RE, lookup, tokenise

import numpy as np

__all__ = [
    "analyse",
    "score_text",
    "lookup",
    "tokenise",
    "LEXICON",
    "NEGATIONS",
    "INTENSIFIERS",
    "DIMINISHERS",
    "TOKEN_RE",
    "MIN_WORDS",
    "MIN_POINTS_FOR_TREND",
    "MIN_WORDS_FOR_AGGREGATE",
]


def _empty(reason: str, n: int) -> dict:
    """The unavailable envelope, with every key spelled out.

    Never a partial dict. A response missing a key it usually has is how a client
    ends up rendering `undefined` where a refusal should be.
    """
    return {
        "available": False,
        "reason": reason,
        "confidence": "none",
        "nDays": n,
        "points": [],
        "trend": None,
        "meanSentiment": None,
        "mentions": [],
        "complexity": None,
    }


def analyse(texts) -> dict:
    """Sentiment trajectory, writing change, and symptom mentions."""
    # One combined string per entry, date-ordered. The three fields are scored
    # together because they describe one day; scoring them separately would give
    # a day with a filled-in `factors` field three times the weight of one
    # without.
    entries = []
    for item in sorted(texts, key=lambda t: t.nightOf):
        combined = " ".join(
            part for part in (item.day, item.factors, item.wakeFeeling) if part
        ).strip()
        if combined:
            entries.append({"nightOf": item.nightOf, "text": combined})

    points = []
    for entry in entries:
        sentiment, words, hits = score_text(entry["text"])
        if sentiment is None:
            continue
        points.append({
            "nightOf": entry["nightOf"],
            "sentiment": round(sentiment, 3),
            "words": words,
            "hits": hits,
        })

    n = len(points)
    if n == 0:
        return _empty("No journal entries with enough text to analyse yet.", 0)

    # Same refusal the numeric models make, for the same reason. This was the one
    # model that never checked, so a single entry produced a plotted sentiment
    # score reported as `available: true` alongside `confidence: "none"` - an
    # envelope that contradicts itself, since `none` is defined as "no number at
    # all". A lexicon score off one entry is noise wearing a number's clothes.
    if not has_enough(n):
        missing = MIN_FOR_ANY_INSIGHT - n
        entry_word = "entry" if missing == 1 else "entries"
        # Counts JOURNAL ENTRIES, not complete nights - reusing the numeric copy
        # here would tell a user to log sleep to unlock a text feature.
        return _empty(
            f"{missing} more journal {entry_word} and MyLumi can look at how "
            "your writing is trending.",
            n,
        )

    # Entries too short to aggregate still plot as points - the user wrote them -
    # but are kept out of the mean and the trend, where one lexicon hit would
    # otherwise carry the weight of a described day.
    aggregate = [p for p in points if p["words"] >= MIN_WORDS_FOR_AGGREGATE]
    if len(aggregate) < MIN_POINTS_FOR_TREND:
        # Not enough substantial entries to summarise, but enough to plot. Fall
        # back to every point rather than refusing: the alternative is a card
        # that shows a line and declines to describe it.
        aggregate = points

    values = np.asarray([p["sentiment"] for p in aggregate], dtype=float)
    mean_sentiment = round(float(values.mean()), 3)

    # The two secondary models are isolated: each degrades to a state the client
    # already renders (an empty mention list, an absent complexity section)
    # rather than taking down a sentiment result that worked. See the docstring
    # on routers/nlp.py for why the asymmetry is deliberate. Neither except
    # logs - a traceback here would carry the journal text that produced it.
    try:
        mentions = symptom_terms.mentions(entries)
    except Exception:  # noqa: BLE001
        mentions = []

    try:
        complexity = complexity_model.analyse(entries)
    except Exception:  # noqa: BLE001
        complexity = None

    return {
        "available": True,
        "reason": None,
        "confidence": tier_for(n),
        "nDays": n,
        "points": points,
        "trend": trend_for(values),
        "meanSentiment": mean_sentiment,
        "mentions": mentions,
        "complexity": complexity,
    }
