import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { findAgreement, describeAgreement, FLOORS } from '../agreement.js';

/* The text-vs-numbers join. Pure, so it is testable without a browser - the same
   arrangement as journal.js, and for the same reason: the rule that decides what
   this card may claim about someone's own account of their symptoms should not
   need a React test environment to check. */

/** n nights, each with a rating for `key` and optionally a mention of it. */
function build({ n = 20, key = 'headache', ratingWhenMentioned, ratingWhenSilent, mentionEvery = 2 }) {
  const mentions = [];
  const entries = [];
  for (let i = 1; i <= n; i += 1) {
    const nightOf = `2026-01-${String(i).padStart(2, '0')}`;
    const mentioned = i % mentionEvery === 0;
    mentions.push({ nightOf, mentions: mentioned ? { [key]: 1 } : { fatigue: 1 } });
    entries.push({
      nightOf,
      night: { symptoms: { [key]: mentioned ? ratingWhenMentioned : ratingWhenSilent } },
    });
  }
  return { mentions, entries };
}

describe('findAgreement', () => {
  it('finds a symptom rated higher on the nights it was written about', () => {
    const { mentions, entries } = build({ ratingWhenMentioned: 5, ratingWhenSilent: 1 });
    const finding = findAgreement(mentions, entries);
    expect(finding.key).toBe('headache');
    expect(finding.gap).toBeGreaterThan(0);
    expect(finding.statement).toMatch(/pointing the same way/);
  });

  it('finds a symptom rated lower on the nights it was written about', () => {
    const { mentions, entries } = build({ ratingWhenMentioned: 1, ratingWhenSilent: 5 });
    const finding = findAgreement(mentions, entries);
    expect(finding.gap).toBeLessThan(0);
    expect(finding.statement).toMatch(/rated it lower/);
  });

  it('joins by nightOf, not by position', () => {
    const { mentions, entries } = build({ ratingWhenMentioned: 6, ratingWhenSilent: 0 });
    const shuffled = [...entries].reverse();
    expect(findAgreement(mentions, shuffled)).toEqual(findAgreement(mentions, entries));
  });

  /* The rule that matters most here. `night.symptoms[key]` can be undefined -
     a user who skipped the symptom section - and reading that as 0 would invent
     a clinical observation, exactly what the feature rows refuse to do. */
  it('drops nights with a missing rating rather than reading them as zero', () => {
    /* Isolates the imputation rule from the floors. 24 nights, every headache
       rating equal at 4, so the true gap is 0 and there is nothing to report.
       Then blank the rating on most of the SILENT nights.

       If `undefined` were read as 0, those zeros would take over the silent
       median and manufacture a gap out of skipped questions. Enough nights
       remain rated on both sides to clear every floor, so a null here can only
       come from the drop. */
    const mentions = [];
    const entries = [];
    for (let i = 1; i <= 24; i += 1) {
      const nightOf = `2026-01-${String(i).padStart(2, '0')}`;
      const mentioned = i % 2 === 0;
      mentions.push({ nightOf, mentions: mentioned ? { headache: 1 } : { fatigue: 1 } });
      // Blank all but four silent nights; every rated night is a 4.
      const blanked = !mentioned && i > 8;
      entries.push({
        nightOf,
        night: { symptoms: { headache: blanked ? undefined : 4 } },
      });
    }

    expect(findAgreement(mentions, entries)).toBeNull();

    /* And the control: the same shape with those four nights genuinely rated 0
       IS a finding. Which proves the assertion above is about the missing
       values, not about the data being unremarkable. */
    const rated = entries.map((e) => ({
      ...e,
      night: { symptoms: { headache: e.night.symptoms.headache ?? 0 } },
    }));
    expect(findAgreement(mentions, rated)).not.toBeNull();
  });

  it('refuses below the per-side night floor', () => {
    // Only three nights mention it; the floor is four.
    const { mentions, entries } = build({
      n: 14,
      ratingWhenMentioned: 6,
      ratingWhenSilent: 0,
      mentionEvery: 5,
    });
    expect(findAgreement(mentions, entries)).toBeNull();
  });

  it('refuses below the total-nights floor', () => {
    const { mentions, entries } = build({ n: 8, ratingWhenMentioned: 6, ratingWhenSilent: 0 });
    expect(findAgreement(mentions, entries)).toBeNull();
  });

  it('refuses a gap too small to act on', () => {
    const { mentions, entries } = build({ ratingWhenMentioned: 3, ratingWhenSilent: 2.5 });
    expect(findAgreement(mentions, entries)).toBeNull();
  });

  it('reports at most one symptom, the largest gap', () => {
    const mentions = [];
    const entries = [];
    for (let i = 1; i <= 20; i += 1) {
      const nightOf = `2026-01-${String(i).padStart(2, '0')}`;
      const mentioned = i % 2 === 0;
      mentions.push({
        nightOf,
        mentions: mentioned ? { headache: 1, nausea: 1 } : {},
      });
      entries.push({
        nightOf,
        night: {
          symptoms: {
            headache: mentioned ? 4 : 2,   // gap 2
            nausea: mentioned ? 6 : 0,     // gap 6, should win
          },
        },
      });
    }
    const finding = findAgreement(mentions, entries);
    expect(finding.key).toBe('nausea');
  });

  it('ignores nights that were never analysed', () => {
    /* An entry with no journal text was never sent, so it cannot be evidence of
       silence about a symptom - it is absent from the question entirely. */
    const { mentions, entries } = build({ ratingWhenMentioned: 5, ratingWhenSilent: 1 });
    entries.push({ nightOf: '2026-02-01', night: { symptoms: { headache: 6 } } });
    expect(findAgreement(mentions, entries).key).toBe('headache');
  });

  it('survives empty and malformed input', () => {
    expect(findAgreement(null, null)).toBeNull();
    expect(findAgreement([], [])).toBeNull();
    expect(findAgreement([{}], [{}])).toBeNull();
    expect(findAgreement([{ nightOf: 'x' }], [{ nightOf: 'x' }])).toBeNull();
  });
});

describe('the words it is allowed to use', () => {
  /* The same discipline the backend models are held to, plus the words specific
     to this feature. The app cannot know whether the writing or the rating is
     the better record of a day, so it must not imply that either is wrong. */
  const BANNED = [
    'underreport', 'under-report', 'inaccurate', 'wrong', 'should have',
    'failed to', 'inconsistent', 'causes', 'due to', 'because', 'makes your',
  ];

  it('never blames the user or claims causation', () => {
    for (const gap of [3, -3]) {
      const statement = describeAgreement({ label: 'headache', gap }).toLowerCase();
      for (const word of BANNED) {
        expect(statement).not.toContain(word);
      }
    }
  });
});

describe('the module boundary', () => {
  /* This computation exists on the client precisely so symptom ratings never
     meet journal text in a request. A future import of the API client here
     would quietly undo that, so it is asserted on the source rather than
     trusted to review. */
  it('imports nothing that can send anything', () => {
    const source = readFileSync(new URL('../agreement.js', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from\s+['"].*api\.js['"]/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/XMLHttpRequest|navigator\.sendBeacon/);
  });

  it('states its floors so they can be read from one place', () => {
    expect(FLOORS.MIN_NIGHTS_PER_SIDE).toBeGreaterThanOrEqual(4);
    expect(FLOORS.MIN_RATING_GAP).toBeGreaterThanOrEqual(1);
    expect(FLOORS.MIN_NIGHTS_FOR_AGREEMENT).toBeGreaterThanOrEqual(12);
  });
});
