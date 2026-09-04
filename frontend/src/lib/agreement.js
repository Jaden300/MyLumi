/* Do the words match the numbers?

   The only feature in the app that joins the two data channels - and it joins
   them HERE, in the browser, because that is the one place both already exist.

   The backend receives journal text and returns which symptom words appear on
   which night. It never learns what the user rated. This module takes those word
   counts, joins them to the PCSS ratings in local storage by `nightOf`, and asks
   whether the two point the same way. Nothing computed here is ever sent
   anywhere; this module imports no API client and has no way to.

   That is not a workaround for the wire boundary in CLAUDE.md ("journal text
   only ever goes to /v1/nlp"). It is what the boundary buys: a comparison that
   would require a server to hold text and clinical scores together instead
   happens on the device that already holds both.

   Pure functions - no storage, no React, no fetch - so the rule that decides
   what this card may claim is testable without a browser, the same arrangement
   as journal.js.

   ## Why there is no significance test here

   Nine symptoms is a multiple-comparison surface, and every backend model that
   tests nine things applies Holm-Bonferroni. This one does not, and the reason
   is worth stating rather than hiding.

   Mention counts are mostly 0 or 1 across 7-40 nights. A rank test on that,
   implemented in JavaScript without scipy and then Holm-corrected across nine
   candidates, returns nothing on essentially every real dataset - a lot of code
   whose output is a card that never speaks.

   So the discipline is expressed as a SELECTION RULE instead: hard floors on
   both group sizes and on the effect size, and then at most ONE symptom
   reported - the largest surviving gap. With nine candidates and a card that
   must stay quiet, taking a single largest effect above a floor is a stricter
   filter than Holm would be, not a weaker one. It is not a corrected test and
   this file does not describe it as one. */

/* The nine PCSS keys, in check-in order. Mirrors SYMPTOM_KEYS in
   backend/app/models/features.py and the storage schema. */
const SYMPTOM_LABELS = {
  headache: 'headache',
  photophobia: 'light sensitivity',
  phonophobia: 'noise sensitivity',
  brainFog: 'brain fog',
  nausea: 'nausea',
  dizziness: 'dizziness',
  fatigue: 'fatigue',
  moodDisturbance: 'irritability or low mood',
  concentration: 'trouble concentrating',
};

/* Nights needed on EACH side of the mentioned/not-mentioned split. Mirrors
   MIN_PER_SIDE in backend/app/models/symptoms.py - a difference computed from
   two nights on one side is not a finding, it is two nights. */
const MIN_NIGHTS_PER_SIDE = 4;

/* Smallest median gap worth a sentence, in points on the 0-6 PCSS scale. A full
   point is the smallest difference a person could actually recognise in their
   own ratings; below that the finding is real and useless. */
const MIN_RATING_GAP = 1.0;

/* Nights with BOTH journal text and a rating for the symptom in question. A
   stricter unit than either "nights logged" or "entries written", because this
   model needs the two to overlap.

   This is the one confidence floor in the app that lives on the client, and it
   lives here rather than in backend/app/models/confidence.py deliberately: a
   constant sitting in that file which no backend model reads would be a worse
   record than this comment. The model it gates cannot run on the server without
   breaking the wire boundary, so its floor belongs with it. */
const MIN_NIGHTS_FOR_AGREEMENT = 12;

/** Median of a numeric array. Assumes non-empty; callers check the floors. */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Mention counts from the server + local entries -> at most one finding.
 *
 * `mentions` is the sparse list from /v1/nlp: [{nightOf, mentions: {key: n}}].
 * `entries` is the local clinical record. Nothing from `entries` leaves this
 * function.
 *
 * A night is only usable for a symptom when that night has BOTH a journal entry
 * that was analysed and a rating for that symptom. A missing rating is DROPPED,
 * never read as 0 - the same rule the feature rows follow, and for the same
 * reason: a fabricated 0 is a clinical claim nobody made.
 */
export function findAgreement(mentions, entries) {
  const byNight = new Map();
  for (const item of mentions ?? []) {
    if (item?.nightOf) byNight.set(item.nightOf, item.mentions ?? {});
  }
  if (byNight.size === 0) return null;

  /* Only nights that were actually analysed count toward the floor. An entry
     with no journal text was never sent, so it can neither mention a symptom
     nor stay silent about one - it is absent from this question, not evidence
     of silence. */
  const analysed = [];
  for (const entry of entries ?? []) {
    if (!entry?.nightOf || !byNight.has(entry.nightOf)) continue;
    analysed.push({ nightOf: entry.nightOf, symptoms: entry.night?.symptoms ?? {} });
  }
  if (analysed.length < MIN_NIGHTS_FOR_AGREEMENT) return null;

  const candidates = [];
  for (const key of Object.keys(SYMPTOM_LABELS)) {
    const mentioned = [];
    const silent = [];
    for (const night of analysed) {
      const rating = night.symptoms?.[key];
      // Missing rating: this night says nothing about this symptom. Dropped.
      if (typeof rating !== 'number' || !Number.isFinite(rating)) continue;
      const count = byNight.get(night.nightOf)?.[key] ?? 0;
      (count > 0 ? mentioned : silent).push(rating);
    }
    if (mentioned.length < MIN_NIGHTS_PER_SIDE || silent.length < MIN_NIGHTS_PER_SIDE) continue;

    const gap = median(mentioned) - median(silent);
    if (Math.abs(gap) < MIN_RATING_GAP) continue;

    candidates.push({
      key,
      label: SYMPTOM_LABELS[key],
      gap: Math.round(gap * 10) / 10,
      mentionedNights: mentioned.length,
      silentNights: silent.length,
    });
  }

  if (candidates.length === 0) return null;

  // At most one. See the header comment.
  const best = candidates.reduce((a, b) => (Math.abs(b.gap) > Math.abs(a.gap) ? b : a));
  return { ...best, statement: describeAgreement(best) };
}

/**
 * The sentence. Describes two things the user did; draws no conclusion between
 * them.
 *
 * Both directions are reported. A card that appears only when something looks
 * wrong is an alarm, not an insight - and "your writing and your ratings agree"
 * is a genuine, quietly reassuring thing to be able to say.
 *
 * What this must never say: that the user underreported, that a rating was
 * wrong or inaccurate, that they should have rated something differently, or
 * that one number explains the other. The app cannot know which of the two is
 * the better record of a day, and saying otherwise would be a judgement about a
 * person's account of their own symptoms.
 */
export function describeAgreement(finding) {
  const { label, gap } = finding;
  if (gap > 0) {
    return (
      `On nights you wrote about ${label}, you also rated it higher. ` +
      'Your writing and your ratings have been pointing the same way.'
    );
  }
  return (
    `You wrote about ${label} on nights you rated it lower. ` +
    'Both are your own record of the day - this is just where they differ.'
  );
}

export const FLOORS = {
  MIN_NIGHTS_PER_SIDE,
  MIN_RATING_GAP,
  MIN_NIGHTS_FOR_AGREEMENT,
};
