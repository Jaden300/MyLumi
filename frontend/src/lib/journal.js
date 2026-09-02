/* The text chokepoint. Pure functions - no storage, no React, no fetch.

   This is the mirror image of `toFeatureRow` in derive.js. That function is the
   single documented description of what NUMERIC data leaves the device; this one
   is the same for TEXT. Two readable functions define the whole outbound
   boundary, and neither can produce the other's shape:

     toFeatureRow      -> numbers, no text fields exist in the output
     buildJournalTexts -> text, no numeric fields exist in the output

   That is what makes "journal text never rides along on a numeric call" a
   structural property of the code rather than a convention someone has to
   remember. Tests assert both directions.

   Consent lives here too (readJournalConsent / writeJournalConsent) as pure
   transforms over a prefs object, so the rule that decides whether text may be
   sent at all is testable without a React test environment. */

/** Fields that may cross the wire to /v1/nlp. Nothing else, ever. */
const TEXT_FIELDS = ['day', 'factors', 'wakeFeeling'];

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Sparse entries -> the /v1/nlp payload. Text and a date, nothing else.
 *
 * Reads exactly three stored fields: `night.journal.day`, `night.journal.factors`
 * and `morning.journal.wakeFeeling`. The output object is built key by key and
 * NEVER spreads the entry - a spread is how a symptom score would one day end up
 * in a text payload without anyone noticing.
 *
 * Entries with no text at all are dropped rather than sent as three empty
 * strings. The backend discards them anyway (`score_text` returns None under 3
 * words), and sending them would overstate how much was shared.
 */
export function buildJournalTexts(entries) {
  const out = [];
  for (const entry of entries ?? []) {
    if (!entry?.nightOf) continue;
    const day = asText(entry.night?.journal?.day);
    const factors = asText(entry.night?.journal?.factors);
    const wakeFeeling = asText(entry.morning?.journal?.wakeFeeling);
    if (!day && !factors && !wakeFeeling) continue;
    out.push({ nightOf: entry.nightOf, day, factors, wakeFeeling });
  }
  return out;
}

/**
 * Cheap change-detector for the fetch gate, mirroring the signature in
 * useInsights.
 *
 * Deliberately NOT a hash or digest of the text. A signature that embodied the
 * content would be a derived copy of journal text living in a React ref, and the
 * entire point of this module is that text exists in exactly one place and moves
 * through exactly one function. Count, last date and total length are enough to
 * notice an edit; a false negative costs a stale card, never a wrong one.
 */
export function journalSignature(texts) {
  const list = texts ?? [];
  if (list.length === 0) return '0::0';
  let chars = 0;
  for (const t of list) {
    for (const field of TEXT_FIELDS) chars += (t[field] ?? '').length;
  }
  return `${list.length}:${list[list.length - 1].nightOf}:${chars}`;
}

/* --- describing a result ---------------------------------------------------- */

/**
 * -1..+1 -> plain language.
 *
 * Never returns a bare number. A patient reading "0.213" has been handed false
 * precision from a word-list scorer; the word is the honest part and the number
 * is shown beside it only so the score stays auditable.
 */
export function describeMeanSentiment(mean) {
  if (!Number.isFinite(mean)) return null;
  if (mean >= 0.35) return 'mostly positive';
  if (mean >= 0.1) return 'mixed, leaning positive';
  if (mean > -0.1) return 'mixed';
  if (mean > -0.35) return 'mixed, leaning negative';
  return 'mostly negative';
}

const TREND_PHRASE = {
  improving: 'reading a little more positively over time',
  declining: 'reading a little more negatively over time',
  steady: 'staying fairly steady',
};

/**
 * Sentence describing the sparkline, for the aria-label on a role="img".
 * Same shape as `describeTrajectory` in trajectory.js.
 *
 * Says nothing causal and makes no claim about recovery - it describes the text
 * that was scored, not the person who wrote it.
 */
export function describeSentiment(result) {
  const points = result?.points ?? [];
  if (points.length === 0) {
    return 'Journal tone over time - nothing scored yet.';
  }

  const word = describeMeanSentiment(result?.meanSentiment);
  const trend = TREND_PHRASE[result?.trend] ?? null;

  const parts = [
    `Journal tone across ${points.length} scored ${points.length === 1 ? 'entry' : 'entries'}.`,
    word ? ` On average ${word}.` : '',
    trend ? ` Overall ${trend}.` : ' Not enough entries yet to describe a direction.',
  ];
  return parts.join('');
}

/**
 * Points -> runs of consecutive scored nights, so the line BREAKS across nights
 * that were not scored.
 *
 * Same rule as the trajectory chart: a line drawn across a gap invents a value
 * for a night nobody wrote about. Entries the backend dropped (too short, no
 * lexicon hit) are absent from `points`, so they are gaps here too.
 *
 * `x` is a day offset from the first point, so the axis is calendar time. Note
 * this differs from the backend's trend slope, which is computed over entry
 * INDEX (see models/nlp.py) - the chart can afford to be calendar-honest about
 * spacing where the slope deliberately is not.
 */
export function buildSentimentSegments(points) {
  const list = points ?? [];
  if (list.length === 0) return [];

  const start = list[0].nightOf;
  const withX = list.map((p) => ({
    nightOf: p.nightOf,
    sentiment: p.sentiment,
    words: p.words,
    x: dayOffset(start, p.nightOf),
  }));

  const segments = [];
  let current = [withX[0]];
  for (let i = 1; i < withX.length; i += 1) {
    if (withX[i].x - withX[i - 1].x === 1) {
      current.push(withX[i]);
    } else {
      segments.push(current);
      current = [withX[i]];
    }
  }
  segments.push(current);
  return segments;
}

/* Local rather than imported from dates.js: this module is the outbound text
   boundary and stays dependency-free so it can be read in isolation. */
function dayOffset(fromIso, toIso) {
  const [ya, ma, da] = fromIso.split('-').map(Number);
  const [yb, mb, db] = toIso.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

/* --- consent ---------------------------------------------------------------- */

/* Consent is stored OFF BY ABSENCE: the key is either `{ granted: true, ... }`
   or it is not there at all. Revoking deletes it rather than writing
   `{ granted: false }`.

   That asymmetry is deliberate. A corrupted, truncated or partially-migrated
   prefs blob can then never be misread as consent - every malformed shape falls
   through to "off", which is the safe direction for a flag whose only job is to
   decide whether someone's private writing leaves their device. */

const CONSENT_KEY = 'journalConsent';

/** True only for the exact shape written by writeJournalConsent. */
export function readJournalConsent(prefs) {
  const stored = prefs?.[CONSENT_KEY];
  return {
    consented: stored?.granted === true,
    grantedAt: typeof stored?.grantedAt === 'string' ? stored.grantedAt : null,
  };
}

/**
 * Returns the NEXT prefs object. Does not write - the caller persists it, so
 * this stays pure and the read-modify-write is visible at the call site.
 *
 * Spreads the existing prefs so granting consent cannot clobber the theme or
 * red-flag dismissals that share this blob.
 */
export function writeJournalConsent(prefs, granted, now = new Date()) {
  const next = { ...(prefs ?? {}) };
  if (granted) {
    next[CONSENT_KEY] = { granted: true, grantedAt: now.toISOString() };
  } else {
    delete next[CONSENT_KEY];
  }
  return next;
}
