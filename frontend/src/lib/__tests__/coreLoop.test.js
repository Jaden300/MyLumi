/* Integration test for the full core loop, driving the domain API the way the
   UI does. Unit tests cover each module; this covers the wiring between them. */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadData,
  saveNightCheckIn,
  saveMorningCheckIn,
  getCheckInStatus,
  getStreak,
  redeemRescue,
  setProfile,
  exportJSON,
  getEntryRange,
} from '../entries.js';
import { SYMPTOM_KEYS } from '../constants.js';
import { __resetBackendForTests } from '../storage.js';

const nightValues = (overrides = {}) => ({
  symptoms: Object.fromEntries(SYMPTOM_KEYS.map((k) => [k, 2])),
  mood: 60,
  journal: { day: 'A steady day.', factors: 'Screens made it worse.' },
  sleep: { plannedBedtime: '23:00', preSleepStress: 2, sleepAidUsed: false },
  ...overrides,
});

const morningValues = (overrides = {}) => ({
  wakeTime: '07:00',
  awakenings: '1',
  sleepQuality: 4,
  dreamRecall: true,
  moodMorning: 4,
  energy: 3,
  readiness: 4,
  journal: { wakeFeeling: 'Groggy but okay.' },
  ...overrides,
});

const EVENING = new Date(2026, 0, 10, 22, 0); // Jan 10, 10pm
const NEXT_MORNING = new Date(2026, 0, 11, 8, 0); // Jan 11, 8am

beforeEach(() => {
  __resetBackendForTests();
});

describe('a full night-then-morning cycle', () => {
  it('walks from empty through both check-ins', () => {
    let data = setProfile(loadData(EVENING), { injuryDate: '2026-01-01' }, EVENING);

    // Evening: night is due, morning is not (no prior night exists).
    let status = getCheckInStatus(data, EVENING);
    expect(status.nightOf).toBe('2026-01-10');
    expect(status.primary).toBe('night');
    expect(status.morningDue).toBe(false);

    // Complete the night check-in.
    const nightResult = saveNightCheckIn(data, status.nightOf, nightValues(), { now: EVENING });
    expect(nightResult.ok).toBe(true);
    data = nightResult.data;
    expect(data.entries['2026-01-10'].night.symptomBurden).toBe(18); // 9 x 2

    // Still the same evening: nothing left to do.
    expect(getCheckInStatus(data, EVENING).primary).toBe('none');

    // Next morning: the morning check-in targets the PREVIOUS night's episode.
    status = getCheckInStatus(data, NEXT_MORNING);
    expect(status.nightOf).toBe('2026-01-11');
    expect(status.morningTargetNightOf).toBe('2026-01-10');
    expect(status.morningDue).toBe(true);
    expect(status.primary).toBe('morning');

    const morningResult = saveMorningCheckIn(data, status.morningTargetNightOf, morningValues(), {
      now: NEXT_MORNING,
    });
    expect(morningResult.ok).toBe(true);
    data = morningResult.data;

    // Both halves landed in ONE record.
    const entry = data.entries['2026-01-10'];
    expect(entry.night).toBeTruthy();
    expect(entry.morning).toBeTruthy();

    // The streak now counts that completed episode.
    expect(getStreak(data, NEXT_MORNING).current).toBe(1);
  });

  it('files a 2am check-in under the previous night', () => {
    let data = setProfile(loadData(EVENING), { injuryDate: '2026-01-01' }, EVENING);
    const lateNight = new Date(2026, 0, 11, 2, 0); // 2am on Jan 11

    const status = getCheckInStatus(data, lateNight);
    expect(status.nightOf).toBe('2026-01-10');

    data = saveNightCheckIn(data, status.nightOf, nightValues(), { now: lateNight }).data;
    // Stored under Jan 10, but honestly stamped as written on Jan 11.
    expect(data.entries['2026-01-10'].night.localDate).toBe('2026-01-11');
  });

  it('refuses to silently overwrite a completed check-in', () => {
    let data = setProfile(loadData(EVENING), { injuryDate: '2026-01-01' }, EVENING);
    data = saveNightCheckIn(data, '2026-01-10', nightValues(), { now: EVENING }).data;

    const second = saveNightCheckIn(data, '2026-01-10', nightValues({ mood: 10 }), { now: EVENING });
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('already-exists');
    expect(data.entries['2026-01-10'].night.mood).toBe(60); // unchanged
  });
});

describe('missed nights', () => {
  it('leaves gaps absent and renders them in a dense range', () => {
    let data = setProfile(loadData(EVENING), { injuryDate: '2026-01-08' }, EVENING);
    data = saveNightCheckIn(data, '2026-01-08', nightValues(), { now: EVENING }).data;

    // Jan 9 never logged.
    const range = getEntryRange(data, '2026-01-08', '2026-01-10');
    expect(range).toHaveLength(3);
    expect(range[1].nightOf).toBe('2026-01-09');
    expect(range[1].night).toBe(null); // the gap is visible, not collapsed
  });
});

describe('streak rescue', () => {
  it('preserves the streak without inventing data', () => {
    let data = setProfile(loadData(EVENING), { injuryDate: '2026-01-01' }, EVENING);

    // Complete Jan 7, 8, 9 — then miss Jan 10.
    for (const nightOf of ['2026-01-07', '2026-01-08', '2026-01-09']) {
      data = saveNightCheckIn(data, nightOf, nightValues(), { now: EVENING }).data;
      data = saveMorningCheckIn(data, nightOf, morningValues(), { now: EVENING }).data;
    }

    const jan11Evening = new Date(2026, 0, 11, 21, 0);
    expect(getStreak(data, jan11Evening).current).toBe(0); // Jan 10 broke it

    const streak = getStreak(data, jan11Evening);
    expect(streak.canRescue).toBe(true);
    expect(streak.rescuableNightOf).toBe('2026-01-10');

    const result = redeemRescue(data, '2026-01-10', jan11Evening);
    expect(result.ok).toBe(true);
    data = result.data;

    // Streak restored across the rescued night...
    expect(getStreak(data, jan11Evening).current).toBe(4);
    // ...but no entry was fabricated for it.
    expect(data.entries['2026-01-10']).toBeUndefined();
  });
});

describe('export', () => {
  it('serializes the stored shape with no transformation', () => {
    let data = setProfile(loadData(EVENING), { injuryDate: '2026-01-01' }, EVENING);
    data = saveNightCheckIn(data, '2026-01-10', nightValues(), { now: EVENING }).data;

    const parsed = JSON.parse(exportJSON(data, EVENING));
    expect(parsed.entries['2026-01-10'].night.symptomBurden).toBe(18);
    expect(parsed.exportedAt).toBeTruthy();
    expect(parsed.profile.injuryDate).toBe('2026-01-01');
  });
});
