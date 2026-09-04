"""The word lists. Data only - no logic lives here.

This is the file a reviewer opens to audit what the sentiment scorer believes.
That is the whole reason the model is a lexicon rather than a transformer, so
the table has to stay readable by a person in one sitting: roughly 300 entries,
hand-written, each one defensible.

## Why not vendor a published lexicon

VADER is ~7,500 crowd-rated entries and AFINN ~2,500. Both were costed and
rejected for the same two reasons:

1. Nobody audits 7,500 rows. Importing one would void the claim in the package
   docstring - "a human can read the list" - and that claim is the model's
   entire justification for existing.
2. Domain mismatch, and it cuts the wrong way here. VADER is tuned on social
   media, where `sick` and `killed` are frequently POSITIVE ("that was sick").
   The people writing in this app mean them literally. A lexicon that scores a
   concussion patient's "felt sick all afternoon" as mildly positive is worse
   than a smaller one that has never heard the word.

## Weights

-3..+3, where 3 is a word that could only appear on an extreme day and 1 is a
word that leans without committing. Weight magnitude is grouped so the tiers are
visible when reading: a word being moved between tiers should be an obvious
one-line diff.

Every key must be lowercase a-z only. `TOKEN_RE` matches `[a-z]+` against text
that has already had apostrophes stripped, so a key containing a digit, hyphen,
space or apostrophe can never match - it is dead code that looks live. A test
(`test_lexicon_keys_are_matchable`) pins this.

Inflections are NOT listed. `lookup()` in tokens.py strips a short list of
suffixes, so `headaches`, `aching` and `throbbed` all reach their base form. Add
base forms here; do not add plurals or participles.
"""

# --- sentiment weights -------------------------------------------------------

LEXICON = {
    # -- group 1: concussion symptom vocabulary ------------------------------
    # The words people actually use for the nine PCSS items when writing prose
    # rather than moving a slider. This group is why the lexicon is domain-
    # specific at all.
    "awful": -3, "terrible": -3, "unbearable": -3, "horrible": -3, "worst": -3,
    "excruciating": -3, "miserable": -3, "hopeless": -3, "despair": -3,
    "agony": -3, "blinding": -3, "debilitating": -3,

    "bad": -2, "pain": -2, "painful": -2, "headache": -2, "migraine": -2,
    "nausea": -2, "nauseous": -2, "queasy": -2, "vomited": -2, "dizzy": -2,
    "dizziness": -2, "lightheaded": -2, "vertigo": -2, "exhausted": -2,
    "drained": -2, "foggy": -2, "fog": -2, "confused": -2, "irritable": -2,
    "anxious": -2, "frustrated": -2, "overwhelmed": -2, "struggling": -2,
    "sick": -2, "worse": -2, "crashed": -2, "throbbing": -2, "pounding": -2,
    "stabbing": -2, "blurry": -2, "blurred": -2, "ringing": -2, "tinnitus": -2,
    "unsteady": -2, "wobbly": -2, "spacey": -2, "muddled": -2, "photophobic": -2,
    # Base forms of the participles above. Listed because SUFFIX_RULES resolves
    # an inflection only to a form that is ITSELF a key: without `throb` here,
    # `throbbed` and `throbs` stem correctly and then find nothing. Verbs whose
    # participle is the common usage still keep their own entry above, so a
    # weight change to one is a visible one-line diff rather than an inheritance.
    "throb": -2, "pound": -2, "drain": -2, "exhaust": -2, "crash": -2,
    "blur": -2, "vomit": -2,

    "tired": -1, "sore": -1, "ache": -1, "slow": -1, "sluggish": -1, "off": -1,
    "rough": -1, "hard": -1, "difficult": -1, "sensitive": -1, "stressed": -1,
    "sad": -1, "groggy": -1, "restless": -1, "fuzzy": -1, "hazy": -1,
    "cloudy": -1, "forgetful": -1, "distracted": -1, "unfocused": -1,
    "scattered": -1, "jittery": -1, "tense": -1, "stiff": -1, "tight": -1,
    "pressure": -1, "glare": -1, "squinting": -1, "bright": -1, "loud": -1,
    "noisy": -1, "dull": -1, "heavy": -1, "achy": -1, "queasiness": -1,

    # -- group 2: functional capacity ----------------------------------------
    # What the day allowed. In recovery journalling these carry more signal
    # about how a day went than mood words do. Included ONLY where the sign is
    # defensible standing alone - a word whose valence depends entirely on its
    # object was left out rather than given a made-up weight.
    #
    # Deliberately absent: `walk` / `walked`. It has no standalone sign
    # ("walked to the shop" vs "managed a short walk"), and
    # test_text_with_no_lexicon_words_returns_none depends on it staying out.
    # Also absent: `work`, `drove`, `finished` - same reason.
    "overdid": -2, "collapsed": -2, "bedridden": -2,
    "cancelled": -1, "skipped": -1, "missed": -1, "abandoned": -1,
    "pushed": -1, "quit": -1,
    "managed": 1, "coped": 1, "paced": 1, "completed": 1, "handled": 1,
    "rested": 2, "recovered": 2,

    # -- group 3: mood and affect --------------------------------------------
    # Post-concussion mental health is half the product (MyLumi_Plan.md 1), and
    # the evening check-in asks about mood disturbance explicitly.
    "angry": -2, "furious": -2, "distraught": -2, "panicked": -2,
    "snappy": -1, "weepy": -1, "tearful": -1, "flat": -1, "numb": -1,
    "lonely": -1, "discouraged": -1, "defeated": -1, "impatient": -1,
    "moody": -1, "worried": -1, "fed": -1, "annoyed": -1, "grumpy": -1,
    "amazing": 3, "wonderful": 3, "fantastic": 3, "excellent": 3, "great": 3,
    "brilliant": 3, "delighted": 3,
    "good": 2, "better": 2, "clear": 2, "refreshed": 2, "calm": 2, "happy": 2,
    "productive": 2, "strong": 2, "energised": 2, "energized": 2,
    "improving": 2, "progress": 2, "hopeful": 2, "relaxed": 2, "cheerful": 2,
    "encouraged": 2, "optimistic": 2, "motivated": 2, "grateful": 2,
    "relieved": 2, "pleased": 2, "confident": 2,
    "ok": 1, "okay": 1, "fine": 1, "steady": 1, "manageable": 1, "easier": 1,
    "normal": 1, "settled": 1, "gentle": 1, "quiet": 1, "content": 1,
    "patient": 1, "stable": 1, "bearable": 1, "alright": 1,

    # -- group 4: sleep vocabulary -------------------------------------------
    # One of the three fields sent to this endpoint is literally `wakeFeeling`,
    # and sleep is the app's central modifiable factor (MyLumi_Plan.md 2).
    "insomnia": -2, "sleepless": -2, "nightmare": -2,
    "tossing": -1, "broken": -1, "interrupted": -1, "unrefreshing": -1,
    "overslept": -1, "wakeful": -1, "disturbed": -1, "sleepy": -1,
    "drowsy": -1, "unrested": -1,
    "deep": 1, "solid": 1, "undisturbed": 1, "uninterrupted": 1,
    "refreshing": 2, "restful": 2, "restorative": 2,

    # -- group 5: general evaluative -----------------------------------------
    # Words with a clear sign that belong to none of the above but appear
    # constantly in short first-person writing.
    "dreadful": -3, "horrendous": -3,
    "stressful": -2, "unpleasant": -2, "hate": -2, "failing": -2,
    "disappointing": -1, "frustrating": -1, "tricky": -1, "awkward": -1,
    "helpful": 2, "lovely": 2, "enjoyed": 2, "pleasant": 2, "smooth": 2,
    "nice": 1, "decent": 1, "reasonable": 1, "acceptable": 1,
}

# --- modifiers ---------------------------------------------------------------

# Words that flip the sign of a following lexicon hit, and that suppress a
# symptom mention entirely in symptom_terms.py ("no headache today").
#
# MUST be spelled apostrophe-free. `tokenise` strips apostrophes before
# matching, so an entry written as "didn't" would never fire. Every entry here
# is the stripped form on purpose; a test pins it.
NEGATIONS = {
    "not", "no", "never", "none", "nothing", "neither", "nor",
    "cant", "cannot", "couldnt", "didnt", "wasnt", "isnt", "arent", "werent",
    "wont", "wouldnt", "dont", "doesnt", "havent", "hasnt", "hadnt",
    "hardly", "barely", "without", "lacked", "stopped", "avoided", "free",
}

INTENSIFIERS = {
    "very": 1.5, "really": 1.5, "extremely": 2.0, "so": 1.3, "quite": 1.2,
    "incredibly": 2.0, "totally": 1.5, "absolutely": 2.0, "completely": 1.8,
    "utterly": 2.0, "unbelievably": 2.0, "super": 1.5, "massively": 1.8,
    "constantly": 1.5, "always": 1.4, "particularly": 1.3, "especially": 1.3,
    "horribly": 1.8, "unusually": 1.3,
}

DIMINISHERS = {
    "slightly": 0.5, "bit": 0.6, "little": 0.6, "somewhat": 0.7,
    "mildly": 0.5, "kind": 0.7, "almost": 0.7, "nearly": 0.7, "slight": 0.5,
    "minor": 0.5, "mild": 0.5, "faint": 0.5, "occasionally": 0.6,
    "sometimes": 0.6, "briefly": 0.5, "marginally": 0.5, "fairly": 0.8,
    "reasonably": 0.8, "mostly": 0.9,
}

# --- suffix normalisation ----------------------------------------------------

# Ordered (suffix, replacement) pairs tried when an exact lookup misses. A
# stripped form counts ONLY if it is itself in LEXICON, so this can never invent
# a match - see lookup() in tokens.py, which also enforces a minimum stem
# length.
#
# `-ful` is deliberately absent. Stripping it would turn `helpful` into `help`
# (not in the lexicon, harmless) but the rule earns nothing: every -ful word
# worth scoring is listed explicitly above with its own weight, and a stripping
# rule would make `painful` inherit `pain`'s weight silently rather than
# visibly. Same for `-less`, which REVERSES sense (`sleepless` vs `sleep`) and
# is the one suffix where a naive strip produces a wrong sign.
SUFFIX_RULES = (
    ("ies", "y"),     # dizzies -> dizzy
    ("es", ""),       # aches -> ache
    ("s", ""),        # headaches -> headache
    ("ing", ""),      # throbbing handled with undoubling below
    ("ing", "e"),     # aching -> ache
    ("ed", ""),       # pounded -> pound
    ("ed", "e"),      # ached -> ache
    ("ily", "y"),     # easily -> easy
    ("ly", ""),       # calmly -> calm
    ("er", ""),       # slower -> slow
    ("est", ""),      # slowest -> slow
    ("ness", ""),     # tiredness -> tired
    ("iness", "y"),   # dizziness handled explicitly above, kept for others
)

# Shortest stem a suffix rule may produce. Below this the "word" carries no
# meaning and a strip is just a way to manufacture a false hit: `sing` -> `s`,
# `ties` -> `t`, `ring` -> `r`.
MIN_STEM_LENGTH = 3
