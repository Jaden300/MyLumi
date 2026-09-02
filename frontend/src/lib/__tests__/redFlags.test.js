/* Red-flag rules - the safety-critical logic in the app.

   Two things matter more here than coverage percentages:

   1. Each rule fires on its exact trigger and NOT one notch below it. A rule that
      fires too readily trains people to dismiss the banner, which is worse than
      not having it.
   2. Missing data never produces a finding. A null symptom suppresses its rule
      entirely, and a gap day is never counted as a low reading. */

import { describe, it, expect } from 'vitest';
import { evaluateRedFlags } from '../redFlags.js';

const SYMPTOM_KEYS = [
  'headache',
  'photophobia',
  'phonophobia',
  'brainFog',
  'nausea',
  'dizziness',
  'fatigue',
  'moodDisturbance',
  'concentration',
];

/* A night with every symptom at `base`, overridden per key. Burden is the real
   sum so the trend rules see consistent data. */
function night(nightOf, overrides = {}, base = 0) {
  const symptoms = Object.fromEntries(SYMPTOM_KEYS.map((k) => [k, base]));
  Object.assign(symptoms, overrides);
  const values = SYMPTOM_KEYS.map((k) => symptoms[k]);
  const symptomBurden = values.every(Number.isFinite)
    ? values.reduce((a, b) => a + b, 0)
    : null;
  return { nightOf, night: { symptoms, symptomBurden }, morning: null };
}

const gap = (nightOf) => ({ nightOf, night: null, morning: null });

/* Consecutive nights ending the day before NOW, oldest first. */
function series(specs) {
  const start = new Date(2026, 0, 20);
  return specs.map((spec, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() - (specs.length - 1 - i));
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return spec === null ? gap(iso) : night(iso, spec.overrides, spec.base ?? 0);
  });
}

const NOW = new Date(2026, 0, 20, 21, 0);
const ids = (result) => result.rules.map((r) => r.id);
const evaluate = (entries, opts = {}) => evaluateRedFlags(entries, { now: NOW, ...opts });

const h = (value) => ({ overrides: { headache: value } });

describe('severe-headache-sustained', () => {
  it('fires on two severe headaches in the last three nights', () => {
    const entries = series([h(5), h(1), h(5)]);
    expect(ids(evaluate(entries))).toContain('severe-headache-sustained');
  });

  it('does NOT fire on one severe night - a single bad day is ordinary recovery', () => {
    const entries = series([h(1), h(1), h(5)]);
    expect(ids(evaluate(entries))).not.toContain('severe-headache-sustained');
  });

  it('does NOT fire at 4 - one notch below the threshold', () => {
    const entries = series([h(4), h(4), h(4)]);
    expect(ids(evaluate(entries))).not.toContain('severe-headache-sustained');
  });

  it('does NOT fire with fewer than three logged nights', () => {
    expect(ids(evaluate(series([h(6), h(6)])))).not.toContain('severe-headache-sustained');
  });

  it('a null headache anywhere in the window suppresses the rule entirely', () => {
    const entries = series([h(6), h(null), h(6)]);
    expect(ids(evaluate(entries))).not.toContain('severe-headache-sustained');
  });

  it('a gap day is not counted as a low reading', () => {
    // Two severe nights either side of an unlogged day. The gap is absent from
    // the window rather than scoring 0, so this is 2 of 2 severe, not 2 of 3.
    const entries = series([h(5), null, h(5)]);
    expect(ids(evaluate(entries))).not.toContain('severe-headache-sustained');
  });
});

describe('headache-escalating', () => {
  it('fires on a monotonic rise of 3 ending at 4 or above', () => {
    const entries = series([h(1), h(2), h(3), h(4)]);
    expect(ids(evaluate(entries))).toContain('headache-escalating');
  });

  it('does NOT fire on a non-monotonic 0 -> 5 -> 2 -> 5 - a jagged bad week is not escalation', () => {
    const entries = series([h(0), h(5), h(2), h(5)]);
    expect(ids(evaluate(entries))).not.toContain('headache-escalating');
  });

  it('does NOT fire on 0 -> 3, which is a rough few days rather than a trajectory', () => {
    const entries = series([h(0), h(1), h(2), h(3)]);
    expect(ids(evaluate(entries))).not.toContain('headache-escalating');
  });

  it('does NOT fire on a rise smaller than 3', () => {
    const entries = series([h(4), h(4), h(5), h(6)]);
    expect(ids(evaluate(entries))).not.toContain('headache-escalating');
  });

  it('does NOT fire with fewer than four logged nights', () => {
    expect(ids(evaluate(series([h(1), h(3), h(6)])))).not.toContain('headache-escalating');
  });
});

describe('neuro-cluster', () => {
  const cluster = { nausea: 4, dizziness: 4, brainFog: 4 };

  it('fires when nausea, dizziness and a cognitive symptom are all high on the latest night', () => {
    expect(ids(evaluate(series([{ overrides: cluster }])))).toContain('neuro-cluster');
  });

  it('accepts concentration in place of brain fog', () => {
    const entries = series([{ overrides: { nausea: 5, dizziness: 5, concentration: 5 } }]);
    expect(ids(evaluate(entries))).toContain('neuro-cluster');
  });

  it('does NOT fire on a bad headache day alone - three domains is what keeps it specific', () => {
    expect(ids(evaluate(series([h(6)])))).not.toContain('neuro-cluster');
  });

  it('does NOT fire when only two of the three domains are high', () => {
    const entries = series([{ overrides: { nausea: 5, dizziness: 5, brainFog: 1, concentration: 1 } }]);
    expect(ids(evaluate(entries))).not.toContain('neuro-cluster');
  });

  it('does NOT fire at 3 - one notch below the threshold', () => {
    const entries = series([{ overrides: { nausea: 3, dizziness: 3, brainFog: 3 } }]);
    expect(ids(evaluate(entries))).not.toContain('neuro-cluster');
  });

  it('does NOT fire when nausea is missing', () => {
    const entries = series([{ overrides: { nausea: null, dizziness: 5, brainFog: 5 } }]);
    expect(ids(evaluate(entries))).not.toContain('neuro-cluster');
  });

  it('only looks at the most recent night', () => {
    const entries = series([{ overrides: cluster }, {}]);
    expect(ids(evaluate(entries))).not.toContain('neuro-cluster');
  });
});

describe('burden-sustained-worsening', () => {
  // base 1 across 9 symptoms = burden 9; base 4 = burden 36. A rise of 27.
  const rising = () => series([...Array(7).fill({ base: 1 }), ...Array(7).fill({ base: 4 })]);

  it('fires when the recent week averages well above the week before it', () => {
    expect(ids(evaluate(rising()))).toContain('burden-sustained-worsening');
  });

  it('does NOT fire with fewer than fourteen logged nights', () => {
    const entries = series([...Array(6).fill({ base: 1 }), ...Array(7).fill({ base: 4 })]);
    expect(ids(evaluate(entries))).not.toContain('burden-sustained-worsening');
  });

  it('does NOT fire on a rise that stays low on the scale', () => {
    // burden 0 -> 9. A real rise, but a nearly-resolved user at 9 of 54 is not
    // deteriorating in any sense worth a banner.
    const entries = series([...Array(7).fill({ base: 0 }), ...Array(7).fill({ base: 1 })]);
    expect(ids(evaluate(entries))).not.toContain('burden-sustained-worsening');
  });

  it('does NOT fire when burden is flat', () => {
    const entries = series(Array(14).fill({ base: 4 }));
    expect(ids(evaluate(entries))).not.toContain('burden-sustained-worsening');
  });

  it('is a discuss, not a prompt', () => {
    const found = evaluate(rising()).rules.find((r) => r.id === 'burden-sustained-worsening');
    expect(found.severity).toBe('discuss');
  });
});

describe('no-improvement-late', () => {
  const sustained = () => series(Array(10).fill({ base: 3 })); // burden 27

  it('fires past day 28 with sustained burden', () => {
    const found = ids(evaluate(sustained(), { daysSinceInjury: 30 }));
    expect(found).toContain('no-improvement-late');
  });

  it('does NOT fire before day 28', () => {
    expect(ids(evaluate(sustained(), { daysSinceInjury: 27 }))).not.toContain('no-improvement-late');
  });

  it('does NOT fire without an injury date to count from', () => {
    expect(ids(evaluate(sustained(), { daysSinceInjury: null }))).not.toContain('no-improvement-late');
  });

  it('does NOT fire when symptoms have largely resolved', () => {
    const entries = series(Array(10).fill({ base: 1 })); // burden 9
    expect(ids(evaluate(entries, { daysSinceInjury: 40 }))).not.toContain('no-improvement-late');
  });

  it('does NOT fire on too few logged nights, however late it is', () => {
    const entries = series(Array(7).fill({ base: 3 }));
    expect(ids(evaluate(entries, { daysSinceInjury: 90 }))).not.toContain('no-improvement-late');
  });

  it('never names a condition - that would be a diagnosis', () => {
    const found = evaluate(sustained(), { daysSinceInjury: 30 }).rules.find(
      (r) => r.id === 'no-improvement-late',
    );
    expect(found.detail.toLowerCase()).not.toContain('syndrome');
    expect(found.detail.toLowerCase()).not.toContain('post-concussion');
  });
});

describe('evaluateRedFlags', () => {
  it('finds nothing on an all-zero dataset', () => {
    const result = evaluate(series(Array(14).fill({ base: 0 })));
    expect(result.active).toBe(false);
    expect(result.rules).toEqual([]);
  });

  it('finds nothing on an empty dataset', () => {
    expect(evaluate([]).active).toBe(false);
  });

  it('finds nothing on a three-night dataset with no severe readings', () => {
    expect(evaluate(series([{ base: 2 }, { base: 2 }, { base: 2 }])).active).toBe(false);
  });

  it('ignores nights outside the 21-day lookback', () => {
    // Two severe headaches, but two months ago. A user returning after a break
    // must not be greeted by a banner about a pattern that has long passed.
    const entries = [
      night('2025-11-01', { headache: 6 }),
      night('2025-11-02', { headache: 6 }),
      night('2025-11-03', { headache: 6 }),
    ];
    expect(evaluate(entries).active).toBe(false);
  });

  it('sorts prompt above discuss so the UI can take the most serious finding', () => {
    const entries = series([
      ...Array(7).fill({ base: 1 }),
      ...Array(6).fill({ base: 4 }),
      { base: 4, overrides: { headache: 6 } },
    ]);
    // Nudge the last three nights into severe-headache territory too.
    const withHeadache = entries.map((e, i) =>
      i >= entries.length - 3 && e.night
        ? night(e.nightOf, { headache: 6 }, 4)
        : e,
    );
    const result = evaluate(withHeadache);
    expect(result.rules[0].severity).toBe('prompt');
  });

  it('signatures a finding by its most recent logged night', () => {
    const entries = series([h(5), h(5), h(5)]);
    const [finding] = evaluate(entries).rules;
    expect(finding.signature).toBe(`severe-headache-sustained:${entries.at(-1).nightOf}`);
  });

  it('changes the signature when a new night is logged while the condition holds', () => {
    // This is what makes a dismissal temporary: same rule, new signature, so the
    // banner returns rather than staying silenced forever. `series` anchors its
    // LAST night to the day before NOW, so appending a night has to be done by
    // hand - otherwise both runs would end on the same date and prove nothing.
    const entries = series([h(5), h(5), h(5), h(5)]);
    const before = evaluate(entries.slice(0, -1), { now: new Date(2026, 0, 19, 21, 0) });
    const after = evaluate(entries);
    const sig = (r, id) => r.rules.find((x) => x.id === id).signature;
    expect(sig(after, 'severe-headache-sustained')).not.toBe(
      sig(before, 'severe-headache-sustained'),
    );
  });
});
