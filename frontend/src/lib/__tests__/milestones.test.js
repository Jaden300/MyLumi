/* Milestones.

   The rule worth protecting: a milestone is earned by nights LOGGED and is never
   taken back. A user who reaches 14 and then misses a day has still logged 14
   nights, and withdrawing the celebration for a missed day would punish exactly
   the bad day streak rescue exists to forgive. */

import { describe, it, expect } from 'vitest';
import { MILESTONES, milestoneFor, pendingMilestone, nextMilestone } from '../milestones.js';

describe('milestoneFor', () => {
  it('returns nothing below the first threshold', () => {
    expect(milestoneFor(0)).toBeNull();
    expect(milestoneFor(6)).toBeNull();
  });

  it('returns the milestone exactly at its threshold', () => {
    expect(milestoneFor(7).nights).toBe(7);
    expect(milestoneFor(14).nights).toBe(14);
    expect(milestoneFor(21).nights).toBe(21);
    expect(milestoneFor(30).nights).toBe(30);
  });

  it('returns the HIGHEST milestone reached, not the first', () => {
    expect(milestoneFor(20).nights).toBe(14);
    expect(milestoneFor(29).nights).toBe(21);
  });

  it('stays at the last milestone beyond it', () => {
    expect(milestoneFor(200).nights).toBe(30);
  });

  it('handles missing input', () => {
    expect(milestoneFor(null)).toBeNull();
    expect(milestoneFor(undefined)).toBeNull();
    expect(milestoneFor(NaN)).toBeNull();
  });
});

describe('pendingMilestone', () => {
  it('shows an unacknowledged milestone', () => {
    expect(pendingMilestone(7, null).nights).toBe(7);
  });

  it('hides one already acknowledged', () => {
    expect(pendingMilestone(7, 7)).toBeNull();
    expect(pendingMilestone(10, 7)).toBeNull();
  });

  it('shows the NEXT milestone after an earlier one was acknowledged', () => {
    expect(pendingMilestone(14, 7).nights).toBe(14);
  });

  it('never withdraws a milestone once the nights are logged', () => {
    // The user reached 14 and then missed days; complete nights do not decrease,
    // so this is really a guard against counting the streak instead.
    expect(pendingMilestone(14, null).nights).toBe(14);
    expect(pendingMilestone(15, null).nights).toBe(14);
  });
});

describe('nextMilestone', () => {
  it('counts down to the next threshold', () => {
    expect(nextMilestone(0)).toMatchObject({ nights: 7, remaining: 7 });
    expect(nextMilestone(5)).toMatchObject({ nights: 7, remaining: 2 });
    expect(nextMilestone(7)).toMatchObject({ nights: 14, remaining: 7 });
  });

  it('returns null past the last milestone', () => {
    expect(nextMilestone(30)).toBeNull();
    expect(nextMilestone(99)).toBeNull();
  });
});

describe('milestone copy', () => {
  it('celebrates data, never the person getting better', () => {
    /* A milestone marks what MyLumi can now do. Copy implying recovery would set
       up the next ordinary week to read as a failure - the same reason
       DailyReport refuses to say "you're doing well". */
    for (const { title, body } of MILESTONES) {
      const text = `${title} ${body}`.toLowerCase();
      for (const banned of ['better', 'improving', 'recovered', 'progress', 'healing', 'well done']) {
        expect(text).not.toContain(banned);
      }
    }
  });

  it('is ordered and unique', () => {
    const nights = MILESTONES.map((m) => m.nights);
    expect(nights).toEqual([...nights].sort((a, b) => a - b));
    expect(new Set(nights).size).toBe(nights.length);
  });
});
