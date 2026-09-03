"""Sentiment analysis on journal text.

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
"""

import re
from typing import Optional

import numpy as np

from .confidence import MIN_FOR_ANY_INSIGHT, has_enough, tier_for

# Weighted -3..+3, oriented to concussion recovery journalling. Deliberately
# small and readable - the whole point is that a human can audit it.
LEXICON = {
    # negative
    "awful": -3, "terrible": -3, "unbearable": -3, "horrible": -3, "worst": -3,
    "excruciating": -3, "miserable": -3, "hopeless": -3, "despair": -3,
    "bad": -2, "pain": -2, "painful": -2, "headache": -2, "nausea": -2,
    "nauseous": -2, "dizzy": -2, "exhausted": -2, "drained": -2, "foggy": -2,
    "confused": -2, "irritable": -2, "anxious": -2, "frustrated": -2,
    "overwhelmed": -2, "struggling": -2, "sick": -2, "worse": -2, "crashed": -2,
    "tired": -1, "sore": -1, "ache": -1, "aching": -1, "slow": -1, "off": -1,
    "rough": -1, "hard": -1, "difficult": -1, "sensitive": -1, "stressed": -1,
    "low": -1, "sad": -1, "unsteady": -1, "groggy": -1, "restless": -1,
    # positive
    "amazing": 3, "wonderful": 3, "fantastic": 3, "excellent": 3, "great": 3,
    "good": 2, "better": 2, "clear": 2, "rested": 2, "refreshed": 2,
    "calm": 2, "happy": 2, "productive": 2, "strong": 2, "energised": 2,
    "energized": 2, "improving": 2, "progress": 2, "hopeful": 2, "relaxed": 2,
    "ok": 1, "okay": 1, "fine": 1, "steady": 1, "manageable": 1, "easier": 1,
    "normal": 1, "settled": 1, "gentle": 1, "quiet": 1,
}

NEGATIONS = {"not", "no", "never", "cant", "cannot", "didnt", "wasnt", "isnt", "wont", "dont", "hardly", "barely"}
INTENSIFIERS = {"very": 1.5, "really": 1.5, "extremely": 2.0, "so": 1.3, "quite": 1.2, "incredibly": 2.0, "totally": 1.5}
DIMINISHERS = {"slightly": 0.5, "bit": 0.6, "little": 0.6, "somewhat": 0.7, "mildly": 0.5, "kind": 0.7}

TOKEN_RE = re.compile(r"[a-z']+")

MIN_WORDS = 3
MIN_POINTS_FOR_TREND = 5


def score_text(text: str) -> tuple[Optional[float], int]:
    """Score one entry to roughly -1..+1. Returns (sentiment, word_count).

    None when there are too few words to say anything - an empty or three-word
    entry gets no sentiment rather than a neutral 0, because 0 would plot as a
    real, meaningfully-neutral day.
    """
    if not text:
        return None, 0
    tokens = TOKEN_RE.findall(text.lower().replace("'", ""))
    if len(tokens) < MIN_WORDS:
        return None, len(tokens)

    total = 0.0
    hits = 0
    for i, token in enumerate(tokens):
        weight = LEXICON.get(token)
        if weight is None:
            continue
        multiplier = 1.0
        # Look back two tokens for negation / intensity.
        for back in (1, 2):
            if i - back < 0:
                break
            prev = tokens[i - back]
            if prev in NEGATIONS:
                multiplier *= -0.8  # negation flips but weakens
                break
            if prev in INTENSIFIERS:
                multiplier *= INTENSIFIERS[prev]
            elif prev in DIMINISHERS:
                multiplier *= DIMINISHERS[prev]
        total += weight * multiplier
        hits += 1

    if hits == 0:
        return None, len(tokens)

    # Normalise by matched words so a long entry is not automatically extreme,
    # then squash into -1..+1.
    return float(np.tanh(total / (hits * 2.0))), len(tokens)


def analyse(texts) -> dict:
    """Sentiment trajectory across entries."""
    points = []
    for item in sorted(texts, key=lambda t: t.nightOf):
        combined = " ".join(part for part in (item.day, item.factors, item.wakeFeeling) if part).strip()
        sentiment, words = score_text(combined)
        if sentiment is None:
            continue
        points.append({"nightOf": item.nightOf, "sentiment": round(sentiment, 3), "words": words})

    n = len(points)
    if n == 0:
        return {
            "available": False,
            "reason": "No journal entries with enough text to analyse yet.",
            "confidence": "none",
            "nDays": 0,
            "points": [],
            "trend": None,
            "meanSentiment": None,
        }

    # Same refusal the numeric models make, for the same reason. This was the one
    # model that never checked, so a single entry produced a plotted sentiment
    # score reported as `available: true` alongside `confidence: "none"` - an
    # envelope that contradicts itself, since `none` is defined as "no number at
    # all". A lexicon score off one entry is noise wearing a number's clothes.
    if not has_enough(n):
        missing = MIN_FOR_ANY_INSIGHT - n
        entries = "entry" if missing == 1 else "entries"
        return {
            "available": False,
            # Counts JOURNAL ENTRIES, not complete nights - reusing the numeric
            # copy here would tell a user to log sleep to unlock a text feature.
            "reason": f"{missing} more journal {entries} and MyLumi can look at how your writing is trending.",
            "confidence": "none",
            "nDays": n,
            "points": [],
            "trend": None,
            "meanSentiment": None,
        }

    values = np.asarray([p["sentiment"] for p in points], dtype=float)
    mean_sentiment = round(float(values.mean()), 3)

    trend = None
    if n >= MIN_POINTS_FOR_TREND:
        # Slope over entry index. Not calendar-spaced, which is a real
        # simplification, but journal entries are irregular and over-modelling a
        # secondary signal would be false precision.
        slope = float(np.polyfit(np.arange(n), values, 1)[0])
        if slope > 0.02:
            trend = "improving"
        elif slope < -0.02:
            trend = "declining"
        else:
            trend = "steady"

    return {
        "available": True,
        "reason": None,
        "confidence": tier_for(n),
        "nDays": n,
        "points": points,
        "trend": trend,
        "meanSentiment": mean_sentiment,
    }
