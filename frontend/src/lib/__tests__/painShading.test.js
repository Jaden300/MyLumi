import { describe, it, expect } from 'vitest';
import { SEVERITY_HEX, painHex, painIntensity, shadeFrame } from '../painShading.js';
import { painSeverityLevel } from '../severity.js';
import { PAIN_MAX, PAIN_STEP } from '../painRegions.js';

describe('SEVERITY_HEX', () => {
  /* The ramp is duplicated from tokens.css because three.js needs a colour
     value rather than a var() reference. Duplication is the cost; this test is
     what stops the two drifting into disagreement about how many steps there
     are, which would show up as an undefined colour on the worst ratings. */
  it('covers every level painSeverityLevel can return', () => {
    const levels = new Set();
    for (let score = 0; score <= PAIN_MAX; score += PAIN_STEP) {
      levels.add(painSeverityLevel(score));
    }
    expect(SEVERITY_HEX).toHaveLength(levels.size);
    for (const level of levels) {
      expect(SEVERITY_HEX[level]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('painHex', () => {
  it('maps the whole scale to a real colour', () => {
    for (let score = 0; score <= PAIN_MAX; score += PAIN_STEP) {
      expect(painHex(score)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('returns null for a missing score rather than a default colour', () => {
    expect(painHex(null)).toBeNull();
    expect(painHex(undefined)).toBeNull();
    expect(painHex(NaN)).toBeNull();
  });
});

describe('painIntensity', () => {
  it('rises with the rating', () => {
    let previous = painIntensity(0);
    for (let score = PAIN_STEP; score <= PAIN_MAX; score += PAIN_STEP) {
      const intensity = painIntensity(score);
      expect(intensity).toBeGreaterThan(previous);
      previous = intensity;
    }
  });

  /* A region the user said hurt must stay visible even at the bottom of the
     scale. If the lowest rating faded to nothing, a reported area would vanish
     off the body and the timeline would under-report what was logged. */
  it('keeps the lowest real rating clearly visible', () => {
    expect(painIntensity(PAIN_STEP)).toBeGreaterThan(0.3);
    expect(painIntensity(PAIN_MAX)).toBeLessThanOrEqual(1);
  });

  it('is zero for a missing score', () => {
    expect(painIntensity(null)).toBe(0);
    expect(painIntensity(NaN)).toBe(0);
  });
});

describe('shadeFrame', () => {
  it('shades every rated region', () => {
    const shaded = shadeFrame({ neck_c: 8, knee_l: 2 });
    expect(Object.keys(shaded).sort()).toEqual(['knee_l', 'neck_c']);
    expect(shaded.neck_c.hex).toBe(painHex(8));
    expect(shaded.neck_c.intensity).toBeGreaterThan(shaded.knee_l.intensity);
  });

  /* The vocabulary is frozen so an arbitrary key cannot reach storage. The
     renderer gets the same guarantee: a hand-edited export must not be able to
     put an unknown region in front of the shader. */
  it('drops region ids outside the frozen vocabulary', () => {
    expect(shadeFrame({ not_a_region_x: 5, neck_c: 5 })).toEqual({
      neck_c: { hex: painHex(5), intensity: painIntensity(5) },
    });
  });

  it('drops regions with no usable score', () => {
    expect(shadeFrame({ neck_c: null, knee_l: undefined })).toEqual({});
  });

  it('handles an empty or missing frame', () => {
    expect(shadeFrame({})).toEqual({});
    expect(shadeFrame(null)).toEqual({});
  });
});
