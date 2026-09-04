"""Which of the nine PCSS symptoms a journal entry mentions.

This model EXTRACTS and does not COMPARE. It returns per-night mention counts and
nothing else. The interesting question - do the words someone writes line up with
the numbers they rate? - is answered in the browser, in
`frontend/src/lib/agreement.js`, because answering it here would mean receiving
journal text and symptom ratings in the same request.

That constraint is the point rather than an obstacle. It is the app's central
privacy claim (CLAUDE.md: "Journal text only ever goes to /v1/nlp") and this is
the one feature that joins the two channels, so it joins them where both already
are: on the user's own device. The server sees text and returns word counts; it
never learns what the user rated.

## The vocabulary

Keyed by SYMPTOM_KEYS imported from features.py rather than redeclared, so a
tenth symptom cannot be added on one side only - a test asserts the key sets are
equal.

Matching goes through the same `matches_vocabulary` normalisation the sentiment
scorer uses, so `headaches`, `aching` and `throbbed` all reach their base form
and the two models can never disagree about what a word is.

Negation SUPPRESSES a mention: "no headache today" is a report of no headache,
and counting it would invert the finding for the most careful journallers.

So does a DIMINISHER. "A bit tired" and "a mild ache" are hedges, and this model
has only a count to express itself with - it cannot record a mention as
three-quarters of one, the way the sentiment scorer scales a weight. Counting a
hedge as a full report was measured to produce a wrong finding on the app's own
demo data; see the comment in `extract`.

## Words deliberately excluded

Auditability here means the exclusions are as visible as the inclusions. Each of
these was in a draft and removed, with a test pinning the removal:

- `light` and `dark`. "A light lunch", "went to bed when it was dark", and -
  worst - `light-headed`, which tokenises to `light` + `headed` and would score
  a dizziness report as photophobia. Kept: `bright`, `glare`, `sunlight`,
  `squinting`, `screens`.
- `low` and `energy`, bare. "Low energy" is fatigue and "low mood" is mood; the
  bare token cannot tell which, and guessing would put mentions under the wrong
  symptom rather than under none.
- `sick`, bare, for nausea. "Sick of this" and "off sick" are both common and
  neither is nausea. Kept: `nausea`, `nauseous`, `queasy`, `vomited`.
- `pressure` for headache. Barometric pressure, work pressure.
"""

from ..features import SYMPTOM_KEYS
from .tokens import (
    matches_vocabulary,
    preceded_by_diminisher,
    preceded_by_negation,
    tokenise,
)

# Everyday words for each PCSS item. Single tokens only - the matcher is a
# per-token loop, and adding phrases would mean a second pass with a different
# set of failure modes for a marginal gain.
SYMPTOM_TERMS = {
    "headache": frozenset({
        "headache", "migraine", "throbbing", "pounding", "temples", "skull",
        "head",
    }),
    "photophobia": frozenset({
        # NOT `light` or `dark` - see the docstring.
        "bright", "brightness", "glare", "sunlight", "squinting", "screens",
        "photophobia", "sunglasses",
    }),
    "phonophobia": frozenset({
        "noise", "noisy", "loud", "loudness", "sound", "sounds", "phonophobia",
    }),
    "brainFog": frozenset({
        "fog", "foggy", "fuzzy", "hazy", "cloudy", "muddled", "spacey",
        "sluggish", "woolly", "vague",
    }),
    "nausea": frozenset({
        # NOT bare `sick` - see the docstring.
        "nausea", "nauseous", "queasy", "queasiness", "vomited", "vomiting",
        "retching", "stomach",
    }),
    "dizziness": frozenset({
        "dizzy", "dizziness", "lightheaded", "spinning", "unsteady", "wobbly",
        "balance", "vertigo", "swaying", "giddy",
    }),
    "fatigue": frozenset({
        # NOT bare `energy` - see the docstring.
        "tired", "tiredness", "exhausted", "exhaustion", "drained", "fatigue",
        "fatigued", "knackered", "wiped", "sleepy", "shattered", "worn",
    }),
    "moodDisturbance": frozenset({
        "irritable", "irritability", "snappy", "angry", "sad", "tearful",
        "frustrated", "moody", "grumpy", "weepy", "impatient", "annoyed",
    }),
    "concentration": frozenset({
        "concentrate", "concentration", "focus", "focusing", "attention",
        "distracted", "scattered", "forgetful", "remember", "forgot",
        "forgetting",
    }),
}


def extract(text: str) -> dict[str, int]:
    """Symptom mentions in one entry. Sparse - only nonzero counts.

    A night with no mentions returns {} rather than nine zeros. Nine zeros per
    night across forty nights is 360 numbers on the wire saying nothing, which is
    exactly the "transmitting data no model reads" mistake the per-symptom model
    was built to correct.
    """
    tokens = tokenise(text)
    counts: dict[str, int] = {}
    for i, token in enumerate(tokens):
        # "No headache today" is a report of no headache.
        if preceded_by_negation(tokens, i):
            continue
        # "A bit tired" is not the same claim as "exhausted", and this model has
        # only a count to say it with. Found by running the extractor against the
        # real demo seed: the phrase "a bit tired but okay overall" is one of the
        # app's MILD-day strings, so hedged mentions were landing on low-rated
        # nights and driving a finding that read "you wrote about fatigue on
        # nights you rated it lower" - an artefact of counting a hedge as a
        # report. Sentiment already scales these by a multiplier; here the honest
        # equivalent is not to count them.
        if preceded_by_diminisher(tokens, i):
            continue
        for key, vocabulary in SYMPTOM_TERMS.items():
            if matches_vocabulary(token, vocabulary):
                counts[key] = counts.get(key, 0) + 1
    return counts


def mentions(entries: list[dict]) -> list[dict]:
    """[{nightOf, text}] -> [{nightOf, mentions}] for entries mentioning anything.

    Entries mentioning no symptom are omitted entirely. Note this list is NOT
    aligned with the sentiment `points` list: an entry can mention a symptom
    while producing no sentiment score (no lexicon hit), and vice versa. The two
    are parallel lists keyed by nightOf, and the client joins on that.
    """
    out = []
    for entry in entries:
        counts = extract(entry["text"])
        if counts:
            out.append({"nightOf": entry["nightOf"], "mentions": counts})
    return out


# Guards the vocabulary against drifting from the clinical item list. Imported by
# the test rather than run at import time, so a mismatch fails a test rather than
# taking down the service.
def vocabulary_keys() -> set[str]:
    return set(SYMPTOM_TERMS)


def clinical_keys() -> set[str]:
    return set(SYMPTOM_KEYS)
