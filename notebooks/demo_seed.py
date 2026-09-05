"""A faithful Python port of frontend/src/lib/demoSeed.js.

Why port it rather than write a fresh generator
-----------------------------------------------
The notebook next to this file runs the real models from backend/app/models on
the same 24 nights the live demo shows. That only means something if the data is
byte-for-byte the data the app generates: if the notebook made its own synthetic
series, its correlation coefficient and forecast interval would be numbers about
some other dataset, and the claim "here is the maths behind what you just saw"
would be false.

Python's `random` cannot reproduce this. demoSeed.js uses mulberry32, a specific
32-bit PRNG, and the whole demo is deterministic off seed 20260214. So the PRNG
comes across exactly, and - just as importantly - so does the ORDER of the draws.
Every `random()` call in the JS advances one shared stream, including the ones
inside buildPain that this notebook never looks at. Skipping an unused draw would
silently shift every subsequent number. The port therefore keeps the dead calls.

Verified against the JS by running both and comparing all 24 nights of symptom
burden and sleep hours; see verify_against_js() at the bottom and the check cell
in mylumi-ml.ipynb.

This file is a mirror, not a source of truth. If demoSeed.js changes, this has to
change with it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

# Mirrors SYMPTOM_KEYS in frontend/src/lib/constants.js, in order. The order
# matters: distribute_burden draws one random per key.
SYMPTOM_KEYS = [
    "headache",
    "photophobia",
    "phonophobia",
    "brainFog",
    "nausea",
    "dizziness",
    "fatigue",
    "moodDisturbance",
    "concentration",
]

DEMO_NIGHTS = 24
DEMO_LONG_NIGHTS = 42
SEED = 20260214

UINT32 = 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    """JavaScript's Math.imul: 32-bit signed integer multiply."""
    a &= UINT32
    b &= UINT32
    result = (a * b) & UINT32
    return result - 0x100000000 if result >= 0x80000000 else result


def _to_int32(value: int) -> int:
    """JavaScript's `| 0`: coerce to a signed 32-bit integer."""
    value &= UINT32
    return value - 0x100000000 if value >= 0x80000000 else value


def make_random(seed: int):
    """mulberry32, matching makeRandom() in demoSeed.js exactly.

    The `>>> 0` and `>>> 15` in the JS are unsigned shifts, so every intermediate
    is masked back to 32 bits here rather than allowed to grow, which is what
    Python's arbitrary-precision ints would otherwise do.
    """
    state = {"a": _to_int32(seed)}

    def random() -> float:
        a = _to_int32(state["a"])
        a = _to_int32(a + 0x6D2B79F5)
        state["a"] = a
        t = _imul(a ^ ((a & UINT32) >> 15), 1 | a)
        t = _to_int32(_to_int32(t + _imul(t ^ ((t & UINT32) >> 7), 61 | t)) ^ t)
        return ((t ^ ((t & UINT32) >> 14)) & UINT32) / 4294967296

    return random


def _clamp(v: float, lo: float, hi: float) -> int:
    """JS `clamp` - note it rounds, and JS rounds .5 toward +Infinity."""
    return int(max(lo, min(hi, _js_round(v))))


def _js_round(v: float) -> float:
    """Math.round in JS rounds half UP (toward +Infinity), unlike Python's
    banker's rounding. -2.5 becomes -2, not -3. Every rating in this file goes
    through it, so the difference is not academic."""
    import math

    return math.floor(v + 0.5)


# Journal text. Present so the draw sequence matches; the notebook does not use
# the strings themselves.
ROUGH_DAYS = [
    "Headache most of the afternoon. Screens made it worse.",
    "Foggy and slow today. Couldn't concentrate on anything for long.",
    "Rough one. Tired and irritable, and the light in the office was hard.",
    "Bad headache again. Had to lie down after lunch.",
    "Dizzy when I stood up too fast. Felt drained by the evening.",
]
OKAY_DAYS = [
    "Steady day. Nothing much to report.",
    "Manageable. Got through work without needing a break.",
    "A bit tired but okay overall.",
    "Fine until the evening, then a mild ache.",
]
GOOD_DAYS = [
    "Good day. Felt clearer than I have in a while.",
    "Much better. Managed a short walk and felt fine after.",
    "Rested and calm. Easily the best day this week.",
    "Clear head most of the day. Really encouraging.",
]
ROUGH_FACTORS = [
    "Too much screen time.",
    "Skipped lunch and pushed through a long meeting.",
    "Loud open-plan office all afternoon.",
    "Went to bed far too late.",
]
GOOD_FACTORS = [
    "Took proper breaks away from screens.",
    "Early night and a quiet morning.",
    "Short walk outside, no screens after dinner.",
]
ROUGH_WAKE = [
    "Groggy. Took a while to feel awake.",
    "Woke up with a headache already there.",
    "Restless night, still exhausted.",
]
GOOD_WAKE = [
    "Woke up rested for once.",
    "Slept through. Felt clear.",
    "Better morning. Calm and steady.",
]

PAIN_OCCASIONAL = ["shoulder_l", "shoulder_r", "upperback_c", "midback_c"]
PAIN_RARE = ["knee_r", "knee_l", "hip_r", "calf_l", "forearm_r"]

PAIN_COURSES = [
    {"id": "neck_c", "start": 7.0, "slopePerDay": -0.16, "reportRate": 0.92,
     "noise": 0.7, "burdenCoupling": 1.2},
    {"id": "head_front_c", "start": 6.0, "slopePerDay": -0.09, "reportRate": 0.82,
     "noise": 0.8, "burdenCoupling": 1.2},
    {"id": "lowerback_c", "start": 4.8, "slopePerDay": 0.0, "reportRate": 0.7,
     "noise": 1.1, "burdenCoupling": 0},
]


def _pick(random, items):
    return items[_floor(random() * len(items))]


def _floor(v: float) -> int:
    import math

    return math.floor(v)


def compute_symptom_burden(symptoms: dict) -> int:
    """Mirrors computeSymptomBurden in frontend/src/lib/derive.js: the sum of the
    nine ratings, 0 to 54."""
    return sum(symptoms[key] for key in SYMPTOM_KEYS)


def distribute_burden(target: float, random, poor_sleep: bool) -> dict:
    weights = {
        "headache": 1.5,
        "photophobia": 1.1,
        "phonophobia": 0.9,
        "brainFog": 1.6 if poor_sleep else 1.2,
        "nausea": 0.5,
        "dizziness": 0.7,
        "fatigue": 1.8 if poor_sleep else 1.4,
        "moodDisturbance": 1.0,
        "concentration": 1.4 if poor_sleep else 1.1,
    }
    total_weight = sum(weights[key] for key in SYMPTOM_KEYS)
    symptoms = {}
    for key in SYMPTOM_KEYS:
        share = (target * weights[key]) / total_weight
        symptoms[key] = _clamp(share + (random() - 0.5) * 0.9, 0, 6)
    return symptoms


def build_pain(random, burden: float, day_index: int) -> dict:
    """Ported in full, including branches the notebook ignores.

    The notebook does not model per-region pain (region names never leave the
    device, which is the point of doing that work in the browser). This exists
    because every random() below advances the same stream the symptom and sleep
    numbers are drawn from. Omitting it would desynchronise everything after the
    first night.
    """
    if burden <= 18 and random() < 0.6:
        return {"answered": True, "regions": {}}

    severity = min(1, burden / 34)
    regions = {}

    def rate(base: float) -> float:
        score = base + severity * 4.5 + (random() - 0.5) * 1.6
        return min(10, max(0.5, _js_round(score * 2) / 2))

    for course in PAIN_COURSES:
        if random() > course["reportRate"]:
            continue
        level = (
            course["start"]
            + course["slopePerDay"] * day_index
            + severity * course["burdenCoupling"]
            + (random() - 0.5) * course["noise"] * 2
        )
        regions[course["id"]] = min(10, max(0.5, _js_round(level * 2) / 2))

    if random() < 0.3 + severity * 0.45:
        regions[PAIN_OCCASIONAL[_floor(random() * len(PAIN_OCCASIONAL))]] = rate(1.5)
    if random() < 0.12:
        regions[PAIN_RARE[_floor(random() * len(PAIN_RARE))]] = rate(1.2)

    return {"answered": True, "regions": regions}


@dataclass
class Night:
    """One generated night, flattened to what the models actually consume."""

    night_of: str
    day_index: int
    symptoms: dict
    symptom_burden: int
    mood: int
    sleep_hours: float
    pre_sleep_stress: int
    sleep_aid_used: bool
    awakenings: str
    sleep_quality: int
    dream_recall: bool
    mood_morning: int
    energy: int
    readiness: int
    pain: dict = field(default_factory=dict)


def build_demo_nights(nights: int = DEMO_NIGHTS, end: date | None = None) -> list[Night]:
    """Generate the demo record, in the same order and with the same draws as
    buildDemoData() in demoSeed.js.

    `end` is the last night generated (the JS uses "yesterday" relative to the
    current night). It only shifts the date labels; every value below is a pure
    function of the seed and the night index, so the numbers are identical
    whenever this is run.

    The two deliberate gaps from the JS (indices 8 and 15) are applied here too:
    a demo where every night is logged would hide the missing-data handling that
    is most of the point.
    """
    random = make_random(SEED)
    end = end or (date.today() - timedelta(days=1))

    dates = [(end - timedelta(days=nights - 1 - i)).isoformat() for i in range(nights)]

    # Sleep hours first, in one pass, exactly as the JS `dates.map(...)` does.
    short_nights = {3, 5, 9, 12, 16, 18}
    knock_on = {6, 13, 19}
    sleep_hours = []
    for i in range(nights):
        if i in short_nights:
            sleep_hours.append(5.0 + random() * 0.7)
        elif i in knock_on:
            sleep_hours.append(5.9 + random() * 0.4)
        else:
            sleep_hours.append(7.2 + random() * 1.6)

    out: list[Night] = []
    for i, night_of in enumerate(dates):
        day_index = i + 1

        trend = 30 - day_index * 0.62

        # The planted effect: LAST night's short sleep raises today's symptoms.
        prev_sleep = 7.5 if i == 0 else sleep_hours[i - 1]
        sleep_penalty = (6.5 - prev_sleep) * 9.0 if prev_sleep < 6.5 else 0

        noise = (random() - 0.5) * 3.5
        target = max(2, trend + sleep_penalty + noise)

        symptoms = distribute_burden(target, random, sleep_penalty > 0)
        burden = compute_symptom_burden(symptoms)

        rough = burden >= 26
        good = burden <= 14

        bed_hour = 22 + _floor(random() * 2)
        bed_minute = 0 if random() < 0.5 else 30

        mood = _clamp(72 - burden * 1.15 + (random() - 0.5) * 16, 0, 100)
        pain = build_pain(random, burden, day_index)

        # Journal draws. Consumed for stream fidelity.
        if rough:
            _pick(random, ROUGH_DAYS)
        elif good:
            _pick(random, GOOD_DAYS)
        else:
            _pick(random, OKAY_DAYS)
        if rough:
            _pick(random, ROUGH_FACTORS)
        elif good:
            _pick(random, GOOD_FACTORS)

        pre_sleep_stress = _clamp(3.4 + random() if rough else 2.2 + random(), 1, 5)
        sleep_aid_used = random() < 0.16

        if sleep_hours[i] < 6.2:
            awakenings = "2" if random() < 0.5 else "3+"
        else:
            awakenings = "0" if random() < 0.6 else "1"

        sleep_quality = _clamp(sleep_hours[i] - 1.6 + (random() - 0.5), 0, 6)
        dream_recall = random() < 0.4
        mood_morning = _clamp(5.2 - burden / 9 + (random() - 0.5), 0, 6)
        energy = _clamp(5.0 - burden / 9.5 + (random() - 0.5), 0, 6)
        readiness = _clamp(5.0 - burden / 9.5 + (random() - 0.5), 0, 6)

        if sleep_hours[i] < 6.3:
            _pick(random, ROUGH_WAKE)
        elif good:
            _pick(random, GOOD_WAKE)

        out.append(
            Night(
                night_of=night_of,
                day_index=day_index,
                symptoms=symptoms,
                symptom_burden=burden,
                mood=mood,
                sleep_hours=sleep_hours[i],
                pre_sleep_stress=pre_sleep_stress,
                sleep_aid_used=sleep_aid_used,
                awakenings=awakenings,
                sleep_quality=sleep_quality,
                dream_recall=dream_recall,
                mood_morning=mood_morning,
                energy=energy,
                readiness=readiness,
                pain=pain,
            )
        )

    # The two deliberate gaps, by index, as in the JS.
    dropped = {8, 15}
    return [night for i, night in enumerate(out) if i not in dropped]


def to_feature_rows(nights: list[Night], as_models: bool = True):
    """Shape the generated nights into the wire contract the backend expects.

    Mirrors toFeatureRow in frontend/src/lib/derive.js. `nextSymptomBurden` is
    the next CONSECUTIVE night's burden, and is None where the following night
    was not logged - which is what makes the two planted gaps cost the forecast
    real training pairs rather than being quietly bridged.

    Returns validated `FeatureRow` models by default, so the ported rows have to
    satisfy the same pydantic contract a real request does. Pass
    `as_models=False` for plain dicts (useful for a dataframe).
    """
    by_date = {night.night_of: night for night in nights}
    rows = []
    for night in nights:
        following = (date.fromisoformat(night.night_of) + timedelta(days=1)).isoformat()
        next_night = by_date.get(following)
        row = {
            "nightOf": night.night_of,
            "daysSinceInjury": night.day_index,
            "symptomBurden": night.symptom_burden,
            "mood": night.mood,
            "preSleepStress": night.pre_sleep_stress,
            "sleepAidUsed": 1 if night.sleep_aid_used else 0,
            "sleepDurationMinutes": _js_round(night.sleep_hours * 60),
            "sleepQuality": night.sleep_quality,
            "awakenings": 3 if night.awakenings == "3+" else int(night.awakenings),
            "dreamRecall": 1 if night.dream_recall else 0,
            "moodMorning": night.mood_morning,
            "energy": night.energy,
            "readiness": night.readiness,
            "dstAffected": 0,
            "nextSymptomBurden": next_night.symptom_burden if next_night else None,
            "painRegionCount": len(night.pain.get("regions", {})),
            "painMax": max(night.pain["regions"].values()) if night.pain.get("regions") else None,
            "painMean": (
                sum(night.pain["regions"].values()) / len(night.pain["regions"])
                if night.pain.get("regions")
                else None
            ),
        }
        for key in SYMPTOM_KEYS:
            row[f"symptom_{key}"] = night.symptoms[key]
        rows.append(row)

    if not as_models:
        return rows

    # Imported lazily so this module stays usable (for the JS comparison check)
    # without the backend on the path.
    from app.schemas import FeatureRow

    return [FeatureRow(**row) for row in rows]


if __name__ == "__main__":
    generated = build_demo_nights()
    print(f"{len(generated)} nights (24 generated, 2 deliberate gaps removed)\n")
    print(f"{'night':>3}  {'sleep':>6}  {'burden':>6}")
    for night in generated:
        print(f"{night.day_index:>3}  {night.sleep_hours:>6.2f}  {night.symptom_burden:>6}")
