/* Row pairing for the forecast.

   The rule under test: a row's prediction target is the burden of the night that
   ACTUALLY followed it. If the user missed a night, there is no target - pairing
   across a gap would teach the model a two-day transition while labelling it a
   one-day one, which is a silent data-quality bug that would never surface as an
   error, only as a slightly wrong model. */

import { describe, it, expect } from 'vitest';
import { buildRows } from '../../hooks/useInsights.js';
import { PAIN_REGION_IDS } from '../painRegions.js';

const entry = (nightOf, burden) => ({
  nightOf,
  night: {
    symptoms: {},
    symptomBurden: burden,
    mood: 50,
    sleep: { plannedBedtime: '23:00', preSleepStress: 3, sleepAidUsed: false },
  },
  morning: { wakeTime: '07:00', awakenings: '1', sleepQuality: 4 },
});

describe('buildRows', () => {
  it('pairs consecutive nights', () => {
    const rows = buildRows([entry('2026-01-01', 20), entry('2026-01-02', 25)], null);
    expect(rows[0].nextSymptomBurden).toBe(25);
  });

  it('does NOT pair across a missed night', () => {
    // Jan 2 is missing: Jan 1 must not be paired with Jan 3.
    const rows = buildRows([entry('2026-01-01', 20), entry('2026-01-03', 25)], null);
    expect(rows[0].nextSymptomBurden).toBeNull();
  });

  it('leaves the final night without a target', () => {
    const rows = buildRows([entry('2026-01-01', 20), entry('2026-01-02', 25)], null);
    expect(rows.at(-1).nextSymptomBurden).toBeNull();
  });

  it('handles month boundaries', () => {
    const rows = buildRows([entry('2026-01-31', 20), entry('2026-02-01', 25)], null);
    expect(rows[0].nextSymptomBurden).toBe(25);
  });

  it('carries no journal text into the payload', () => {
    const withText = entry('2026-01-01', 20);
    withText.night.journal = { day: 'a private entry', factors: 'secret' };
    withText.morning.journal = { wakeFeeling: 'also private' };

    const serialised = JSON.stringify(buildRows([withText], null));
    expect(serialised).not.toContain('private');
    expect(serialised).not.toContain('secret');
    expect(serialised).not.toContain('journal');
  });

  /* The structural form of the aggregates-only decision. A map of where someone
     aches, stable across weeks, is closer to an identifier than a measurement,
     so the wire carries counts and ratings but never region names. Written as a
     grep over the serialised payload, like the journal test above, so that
     adding a per-region column later breaks a test rather than passing review. */
  it('carries no body region names into the payload', () => {
    const withPain = entry('2026-01-01', 20);
    withPain.night.pain = {
      answered: true,
      regions: { thigh_r: 6.5, lowerback_c: 3, head_front_c: 8 },
    };

    const serialised = JSON.stringify(buildRows([withPain], null));
    for (const id of PAIN_REGION_IDS) {
      expect(serialised, `region id ${id} leaked into the payload`).not.toContain(id);
    }
    expect(serialised).not.toContain('regions');

    // The aggregates themselves do go, and are what makes the row useful.
    expect(serialised).toContain('painRegionCount');
    expect(JSON.parse(serialised)[0].painMax).toBe(8);
  });

  it('drops entries with no night block rather than sending empty rows', () => {
    const rows = buildRows(
      [{ nightOf: '2026-01-01', night: null, morning: null }, entry('2026-01-02', 25)],
      null,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].nightOf).toBe('2026-01-02');
  });

  it('passes injury date through as daysSinceInjury', () => {
    const rows = buildRows([entry('2026-01-11', 20)], '2026-01-01');
    expect(rows[0].daysSinceInjury).toBe(10);
  });
});
