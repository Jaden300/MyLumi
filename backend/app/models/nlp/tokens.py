"""Tokenising and lexicon lookup. One implementation, used by every text model.

The sentiment scorer and the symptom-term extractor both need to answer "is this
token that word?" and "was it negated?". Those answers must never differ between
the two: a text where sentiment sees `headaches` and the extractor does not would
produce a card claiming a disagreement that is an artefact of two tokenisers.

## Why suffix rules rather than a stemmer

Porter/Snowball is the textbook move and was rejected. It is ~170 lines of
dependency for this vocabulary, and - the deciding reason - its output is not
human-readable: `recovery` stems to `recoveri`, `dizziness` to `dizzi`. The
audit table in lexicon.py would have to be written in stems, which destroys the
one property the lexicon approach is chosen for.

The rules here are the opposite trade: a dozen legible lines that handle the
inflections this vocabulary actually takes, and that cannot invent a match
because a stripped form only counts if it is itself in the lexicon.
"""

import re

from .lexicon import (
    DIMINISHERS,
    LEXICON,
    MIN_STEM_LENGTH,
    NEGATIONS,
    SUFFIX_RULES,
)

# Apostrophes are stripped BEFORE matching, so "didn't" tokenises to "didnt".
# Every entry in NEGATIONS is spelled to match that.
TOKEN_RE = re.compile(r"[a-z]+")

# How far back to look for a negation or intensity modifier. Two tokens covers
# "not very good" and "no real headache" without reaching into a previous
# clause, which is where a longer window starts producing false flips.
MODIFIER_WINDOW = 2


# Both apostrophe characters a keyboard produces. U+2019 is the curly one iOS and
# macOS insert by default, written as an escape here because the repo's style
# check forbids the literal character in source (see docs/workflow.md).
#
# Not cosmetic: without it, "didn't" typed on a phone tokenises to "didn" + "t",
# matches no negation, and "didn't feel good" scores as positive.
APOSTROPHES = ("'", "\u2019")


def tokenise(text: str) -> list[str]:
    """Text -> lowercase word tokens, apostrophes removed."""
    if not text:
        return []
    lowered = text.lower()
    for mark in APOSTROPHES:
        lowered = lowered.replace(mark, "")
    return TOKEN_RE.findall(lowered)


def stem_candidates(token: str) -> list[str]:
    """The forms a token could reduce to, in rule order. Never includes itself.

    Returned rather than resolved here so both the lexicon lookup and the
    symptom vocabulary can apply the same normalisation to their own tables.
    """
    out = []
    for suffix, replacement in SUFFIX_RULES:
        if not token.endswith(suffix) or len(token) <= len(suffix):
            continue
        stem = token[: -len(suffix)] + replacement
        if len(stem) < MIN_STEM_LENGTH or stem == token:
            continue
        out.append(stem)
        # Undoubling, for the -ing/-ed forms that double a final consonant:
        # throbbing -> throbb -> throb, stopped -> stopp -> stop.
        if len(stem) >= MIN_STEM_LENGTH + 1 and stem[-1] == stem[-2]:
            out.append(stem[:-1])
    return out


def lookup(token: str) -> "float | None":
    """Sentiment weight for a token, trying suffix-stripped forms on a miss.

    Exact match wins. A stripped form counts only if it is itself a lexicon key,
    so this can never manufacture a hit out of a word the list has not seen.
    """
    weight = LEXICON.get(token)
    if weight is not None:
        return float(weight)
    for stem in stem_candidates(token):
        weight = LEXICON.get(stem)
        if weight is not None:
            return float(weight)
    return None


def matches_vocabulary(token: str, vocabulary: frozenset) -> bool:
    """True if a token is in a term set, directly or after suffix stripping.

    The same normalisation `lookup` applies to the sentiment lexicon, exposed for
    the symptom vocabulary so the two can never disagree about what a word is.
    """
    if token in vocabulary:
        return True
    return any(stem in vocabulary for stem in stem_candidates(token))


def preceded_by_diminisher(tokens: list[str], index: int) -> bool:
    """Whether the token at `index` is hedged - "a bit tired", "a mild ache".

    Sentiment already scales by these (DIMINISHERS carries a multiplier); the
    symptom extractor has only a count, so it uses this to decide whether a
    mention happened at all.

    Stops at a negation rather than looking past it, so "not a bit better" is
    handled by the negation rule and does not also read as hedged.
    """
    for back in range(1, MODIFIER_WINDOW + 1):
        i = index - back
        if i < 0:
            return False
        if tokens[i] in NEGATIONS:
            return False
        if tokens[i] in DIMINISHERS:
            return True
    return False


def preceded_by_negation(tokens: list[str], index: int) -> bool:
    """Whether a negation sits within the modifier window before `index`.

    Used two different ways on purpose. Sentiment FLIPS on a negation and weakens
    ("not good" is mildly bad, not strongly bad); a symptom mention is SUPPRESSED
    entirely ("no headache today" is not a report of a headache). Both need the
    same question answered the same way, which is why it lives here.
    """
    for back in range(1, MODIFIER_WINDOW + 1):
        i = index - back
        if i < 0:
            return False
        if tokens[i] in NEGATIONS:
            return True
    return False
