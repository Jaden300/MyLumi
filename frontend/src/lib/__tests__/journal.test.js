/* The text chokepoint.

   The headline test here is the exact INVERSE of `buildRows > carries no journal
   text into the payload`. That one asserts text never reaches the numeric
   endpoint; this one asserts numbers never reach the text endpoint. Together
   they pin both directions of the boundary described in docs/responsible-ai.md,
   so neither payload can drift into carrying the other's content.

   The key-set assertion matters more than it looks: it is what fails if someone
   later "simplifies" buildJournalTexts into a spread of the entry. */

import { describe, it, expect } from 'vitest';
import {
  buildJournalTexts,
  journalSignature,
  describeMeanSentiment,
  describeSentiment,
  buildSentimentSegments,
  readJournalConsent,
  writeJournalConsent,
} from '../journal.js';

const entry = (nightOf, { day = '', factors = '', wakeFeeling = '' } = {}) => ({
  nightOf,
  night: {
    symptoms: { headache: 5, nausea: 2 },
    symptomBurden: 42,
    mood: 30,
    completedAt: '2026-01-01T22:00:00.000Z',
    journal: { day, factors },
    sleep: { plannedBedtime: '23:00', preSleepStress: 4, sleepAidUsed: true },
  },
  morning: {
    wakeTime: '07:00',
    sleepQuality: 3,
    energy: 2,
    readiness: 2,
    journal: { wakeFeeling },
  },
});

describe('buildJournalTexts', () => {
  it('extracts the three text fields from their stored paths', () => {
    const [text] = buildJournalTexts([
      entry('2026-01-01', { day: 'a slow day', factors: 'too much screen time', wakeFeeling: 'groggy' }),
    ]);
    expect(text).toEqual({
      nightOf: '2026-01-01',
      day: 'a slow day',
      factors: 'too much screen time',
      wakeFeeling: 'groggy',
    });
  });

  it('emits EXACTLY the four wire keys and nothing else', () => {
    // Fails loudly if anyone refactors this into a spread of the entry.
    const [text] = buildJournalTexts([entry('2026-01-01', { day: 'something' })]);
    expect(Object.keys(text).sort()).toEqual(['day', 'factors', 'nightOf', 'wakeFeeling']);
  });

  it('carries no numeric or clinical data into the payload', () => {
    // The inverse of the buildRows privacy assertion.
    const serialised = JSON.stringify(buildJournalTexts([entry('2026-01-01', { day: 'a note' })]));
    expect(serialised).not.toContain('symptomBurden');
    expect(serialised).not.toContain('symptoms');
    expect(serialised).not.toContain('headache');
    expect(serialised).not.toContain('sleepQuality');
    expect(serialised).not.toContain('preSleepStress');
    expect(serialised).not.toContain('completedAt');
    expect(serialised).not.toContain('42');
  });

  it('drops entries with no text at all', () => {
    expect(buildJournalTexts([entry('2026-01-01')])).toEqual([]);
  });

  it('drops entries whose text is only whitespace', () => {
    expect(buildJournalTexts([entry('2026-01-01', { day: '   ' })])).toEqual([]);
  });

  it('keeps a morning-only entry, with the night fields empty', () => {
    const [text] = buildJournalTexts([
      { nightOf: '2026-01-01', night: null, morning: { journal: { wakeFeeling: 'rested' } } },
    ]);
    expect(text).toEqual({ nightOf: '2026-01-01', day: '', factors: '', wakeFeeling: 'rested' });
  });

  it('survives null blocks without throwing', () => {
    expect(() =>
      buildJournalTexts([{ nightOf: '2026-01-01', night: null, morning: null }]),
    ).not.toThrow();
  });

  it('coerces non-string journal values to empty strings', () => {
    // A corrupted blob must not put a number or an object on the wire.
    const corrupt = {
      nightOf: '2026-01-01',
      night: { journal: { day: 42, factors: { nested: true } } },
      morning: { journal: { wakeFeeling: 'fine' } },
    };
    const [text] = buildJournalTexts([corrupt]);
    expect(text.day).toBe('');
    expect(text.factors).toBe('');
    expect(text.wakeFeeling).toBe('fine');
  });

  it('handles empty and nullish input', () => {
    expect(buildJournalTexts([])).toEqual([]);
    expect(buildJournalTexts(null)).toEqual([]);
    expect(buildJournalTexts(undefined)).toEqual([]);
  });
});

describe('journalSignature', () => {
  const texts = (day) => buildJournalTexts([entry('2026-01-01', { day })]);

  it('is stable across identical input', () => {
    expect(journalSignature(texts('same'))).toBe(journalSignature(texts('same')));
  });

  it('changes when text is edited', () => {
    expect(journalSignature(texts('short'))).not.toBe(journalSignature(texts('much longer text')));
  });

  it('changes when an entry is added', () => {
    const one = buildJournalTexts([entry('2026-01-01', { day: 'a' })]);
    const two = buildJournalTexts([
      entry('2026-01-01', { day: 'a' }),
      entry('2026-01-02', { day: 'b' }),
    ]);
    expect(journalSignature(one)).not.toBe(journalSignature(two));
  });

  it('contains none of the journal text itself', () => {
    // The signature lives in a React ref; it must not be a copy of the writing.
    const sig = journalSignature(texts('a deeply private confession'));
    expect(sig).not.toContain('private');
    expect(sig).not.toContain('confession');
  });

  it('handles an empty list', () => {
    expect(journalSignature([])).toBe('0::0');
    expect(journalSignature(null)).toBe('0::0');
  });
});

describe('describeMeanSentiment', () => {
  it('names each band', () => {
    expect(describeMeanSentiment(0.6)).toBe('mostly positive');
    expect(describeMeanSentiment(0.2)).toBe('mixed, leaning positive');
    expect(describeMeanSentiment(0)).toBe('mixed');
    expect(describeMeanSentiment(-0.2)).toBe('mixed, leaning negative');
    expect(describeMeanSentiment(-0.6)).toBe('mostly negative');
  });

  it('is inclusive at the positive boundaries', () => {
    expect(describeMeanSentiment(0.35)).toBe('mostly positive');
    expect(describeMeanSentiment(0.1)).toBe('mixed, leaning positive');
  });

  it('returns null rather than a word for missing values', () => {
    expect(describeMeanSentiment(null)).toBeNull();
    expect(describeMeanSentiment(undefined)).toBeNull();
    expect(describeMeanSentiment(NaN)).toBeNull();
  });
});

describe('describeSentiment', () => {
  const result = (over) => ({ points: [{ nightOf: '2026-01-01', sentiment: 0.2, words: 12 }], meanSentiment: 0.2, trend: 'steady', ...over });

  it('states the entry count and the average', () => {
    const text = describeSentiment(result());
    expect(text).toContain('1 scored entry');
    expect(text).toContain('mixed, leaning positive');
  });

  it('pluralises the entry count', () => {
    const points = [
      { nightOf: '2026-01-01', sentiment: 0.2, words: 9 },
      { nightOf: '2026-01-02', sentiment: 0.3, words: 9 },
    ];
    expect(describeSentiment(result({ points }))).toContain('2 scored entries');
  });

  it('says so plainly when there is no trend, rather than hedging one', () => {
    const text = describeSentiment(result({ trend: null }));
    expect(text).toContain('Not enough entries yet');
    expect(text).not.toContain('improving');
    expect(text).not.toContain('declining');
  });

  it('handles an empty result', () => {
    expect(describeSentiment({ points: [] })).toContain('nothing scored yet');
    expect(describeSentiment(null)).toContain('nothing scored yet');
  });

  it('makes no causal claim', () => {
    // Matches the vocabulary the backend test forbids in generated copy.
    const text = describeSentiment(result({ trend: 'declining' }));
    for (const banned of ['causes', 'due to', 'makes your', 'because']) {
      expect(text).not.toContain(banned);
    }
  });
});

describe('buildSentimentSegments', () => {
  const point = (nightOf, sentiment) => ({ nightOf, sentiment, words: 10 });

  it('returns one run for consecutive nights', () => {
    const segments = buildSentimentSegments([
      point('2026-01-01', 0.1),
      point('2026-01-02', 0.2),
      point('2026-01-03', 0.3),
    ]);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toHaveLength(3);
  });

  it('breaks the line across an unscored night', () => {
    // Jan 2 was not scored: the line must not be drawn across it.
    const segments = buildSentimentSegments([point('2026-01-01', 0.1), point('2026-01-03', 0.3)]);
    expect(segments).toHaveLength(2);
  });

  it('spaces points by calendar day, not by index', () => {
    const segments = buildSentimentSegments([point('2026-01-01', 0.1), point('2026-01-08', 0.3)]);
    expect(segments[1][0].x).toBe(7);
  });

  it('handles month boundaries', () => {
    const segments = buildSentimentSegments([point('2026-01-31', 0.1), point('2026-02-01', 0.2)]);
    expect(segments).toHaveLength(1);
  });

  it('handles empty input', () => {
    expect(buildSentimentSegments([])).toEqual([]);
    expect(buildSentimentSegments(null)).toEqual([]);
  });
});

describe('journal consent', () => {
  it('reads as OFF when the key is absent', () => {
    expect(readJournalConsent({}).consented).toBe(false);
    expect(readJournalConsent(null).consented).toBe(false);
    expect(readJournalConsent(undefined).consented).toBe(false);
  });

  it('reads as OFF for every malformed shape', () => {
    // Off by absence: nothing but the exact written shape may read as consent.
    for (const bad of [true, 'yes', 1, {}, { granted: 'true' }, { granted: false }, []]) {
      expect(readJournalConsent({ journalConsent: bad }).consented).toBe(false);
    }
  });

  it('round-trips a grant', () => {
    const now = new Date('2026-03-01T12:00:00.000Z');
    const next = writeJournalConsent({}, true, now);
    const read = readJournalConsent(next);
    expect(read.consented).toBe(true);
    expect(read.grantedAt).toBe('2026-03-01T12:00:00.000Z');
  });

  it('removes the key entirely on revoke', () => {
    const granted = writeJournalConsent({}, true);
    const revoked = writeJournalConsent(granted, false);
    expect('journalConsent' in revoked).toBe(false);
    expect(readJournalConsent(revoked).consented).toBe(false);
  });

  it('preserves the other prefs that share this blob', () => {
    // The read-modify-write bug that would silently reset someone's theme.
    const prefs = { theme: 'dark', redFlagDismissals: { 'neuro-cluster': 'sig-1' } };
    const granted = writeJournalConsent(prefs, true);
    expect(granted.theme).toBe('dark');
    expect(granted.redFlagDismissals).toEqual({ 'neuro-cluster': 'sig-1' });

    const revoked = writeJournalConsent(granted, false);
    expect(revoked.theme).toBe('dark');
    expect(revoked.redFlagDismissals).toEqual({ 'neuro-cluster': 'sig-1' });
  });

  it('does not mutate the prefs object it is given', () => {
    const prefs = { theme: 'dark' };
    writeJournalConsent(prefs, true);
    expect(prefs).toEqual({ theme: 'dark' });
  });
});
