"""Scoring one entry, and the trend across entries.

The scoring rule is unchanged from the single-file version: weight each lexicon
hit, adjust it by any negation or intensifier in the two tokens before it,
average over the hits rather than over all words, and squash to -1..+1.
"""

from typing import Optional

import numpy as np

from .lexicon import DIMINISHERS, INTENSIFIERS, NEGATIONS
from .tokens import MODIFIER_WINDOW, lookup, tokenise

# Below this an entry gets no score at all. Three tokens cannot carry a tone.
MIN_WORDS = 3

# Below this an entry is scored but kept OUT of the mean and the trend. An entry
# of four to seven words typically contains exactly one lexicon hit, which makes
# the "score" that single word's valence wearing a day's clothes. It still plots
# as a point, because the user did write it, but it must not move a summary
# figure that reads as a description of weeks.
#
# This is the one surviving use of the linguistic-complexity work: length as a
# gate on whether a score is trustworthy enough to aggregate, never as a claim
# about the person. See the package docstring.
MIN_WORDS_FOR_AGGREGATE = 8

MIN_POINTS_FOR_TREND = 5

# Slope in sentiment units per entry. Below this the direction is not worth a
# sentence and the trend reports "steady".
MIN_TREND_SLOPE = 0.02


def score_text(text: str) -> tuple[Optional[float], int, int]:
    """Score one entry to roughly -1..+1. Returns (sentiment, word_count, hits).

    None when there are too few words to say anything - an empty or three-word
    entry gets no sentiment rather than a neutral 0, because 0 would plot as a
    real, meaningfully-neutral day.

    `hits` is the number of lexicon words that produced the score. It is
    returned, and sent, so the claim that every score decomposes into specific
    words is checkable from the response rather than only from this source file.
    """
    if not text:
        return None, 0, 0
    tokens = tokenise(text)
    if len(tokens) < MIN_WORDS:
        return None, len(tokens), 0

    total = 0.0
    hits = 0
    for i, token in enumerate(tokens):
        weight = lookup(token)
        if weight is None:
            continue
        multiplier = 1.0
        # Look back two tokens for negation / intensity.
        for back in range(1, MODIFIER_WINDOW + 1):
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
        return None, len(tokens), 0

    # Normalise by matched words so a long entry is not automatically extreme,
    # then squash into -1..+1.
    return float(np.tanh(total / (hits * 2.0))), len(tokens), hits


def trend_for(values: np.ndarray) -> Optional[str]:
    """Direction of a sentiment series, or None below the point floor.

    Slope over entry index. Not calendar-spaced, which is a real simplification,
    but journal entries are irregular and over-modelling a secondary signal would
    be false precision.
    """
    n = len(values)
    if n < MIN_POINTS_FOR_TREND:
        return None
    if float(np.std(values)) < 1e-9:
        return "steady"
    slope = float(np.polyfit(np.arange(n), values, 1)[0])
    if not np.isfinite(slope):
        return None
    if slope > MIN_TREND_SLOPE:
        return "improving"
    if slope < -MIN_TREND_SLOPE:
        return "declining"
    return "steady"
