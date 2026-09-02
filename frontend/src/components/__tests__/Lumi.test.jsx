import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Lumi } from '../lumi/Lumi.jsx';

/* These tests exist mainly to guard the mascot port. The mark is rendered at 13
   call sites in states that no test previously touched, so the cheapest useful
   assertion is that every state renders something coherent. */

const STATES = [
  'idle', 'encouraging', 'celebrating', 'concerned', 'resting', 'waking',
  'reading', 'waving', 'thinking', 'presenting', 'empty', 'attentive',
  'proud', 'cheering', 'sleepy', 'lost', 'offline',
];

const svgOf = (container) => container.querySelector('svg');

describe('Lumi', () => {
  describe('every state renders', () => {
    it.each(STATES)('%s draws a body and a face', (state) => {
      const { container } = render(<Lumi state={state} />);
      const svg = svgOf(container);
      expect(svg).toBeTruthy();
      // The body path plus at least one face element.
      expect(container.querySelectorAll('path').length).toBeGreaterThan(1);
    });
  });

  it('falls back to idle for an unknown state rather than rendering blank', () => {
    const { container } = render(<Lumi state="not-a-real-state" />);
    const { container: idle } = render(<Lumi state="idle" />);
    // Same element count as idle: the fallback is a real face, not an empty svg.
    expect(container.querySelectorAll('path').length).toBe(
      idle.querySelectorAll('path').length,
    );
  });

  describe('gradient ids are unique per instance', () => {
    /* The bug this replaces: ids were derived from the state name, so two
       Lumis in the same state (the dashboard does this) produced duplicate DOM
       ids and the second one referenced the first one's gradient. */
    it('two Lumis in the same state do not share gradient ids', () => {
      const { container } = render(
        <>
          <Lumi state="encouraging" />
          <Lumi state="encouraging" />
        </>,
      );
      const ids = [...container.querySelectorAll('linearGradient, radialGradient')]
        .map((n) => n.id);
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('every fill reference resolves to an id present in the same svg', () => {
      const { container } = render(
        <>
          <Lumi state="celebrating" />
          <Lumi state="celebrating" />
        </>,
      );
      for (const svg of container.querySelectorAll('svg')) {
        const defined = new Set([...svg.querySelectorAll('[id]')].map((n) => n.id));
        const referenced = [...svg.querySelectorAll('[fill^="url("], [stroke^="url("]')]
          .flatMap((n) => [n.getAttribute('fill'), n.getAttribute('stroke')])
          .filter((v) => v?.startsWith('url(#'))
          .map((v) => v.slice(5, -1));
        for (const ref of referenced) expect(defined).toContain(ref);
      }
    });
  });

  describe('accents', () => {
    it('are dropped below the small-size threshold', () => {
      const { container: big } = render(<Lumi state="thinking" size={64} />);
      const { container: small } = render(<Lumi state="thinking" size={28} />);
      // thinking's accent is three circles; the face has none.
      expect(big.querySelectorAll('circle').length)
        .toBeGreaterThan(small.querySelectorAll('circle').length);
    });

    it('are kept at exactly the threshold size', () => {
      const { container: at } = render(<Lumi state="thinking" size={40} />);
      const { container: below } = render(<Lumi state="thinking" size={39} />);
      expect(at.querySelectorAll('circle').length)
        .toBeGreaterThan(below.querySelectorAll('circle').length);
    });

    it('a state with no accent renders the same at any size', () => {
      const { container: big } = render(<Lumi state="idle" size={96} />);
      const { container: small } = render(<Lumi state="idle" size={20} />);
      expect(big.querySelectorAll('path').length)
        .toBe(small.querySelectorAll('path').length);
    });
  });

  describe('accessibility', () => {
    it('is hidden from assistive tech when it has no title', () => {
      const { container } = render(<Lumi state="idle" />);
      const svg = svgOf(container);
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('role')).toBe('presentation');
    });

    it('is exposed as an image with a name when given a title', () => {
      const { container } = render(<Lumi state="idle" title="Lumi, your guide" />);
      const svg = svgOf(container);
      expect(svg.getAttribute('role')).toBe('img');
      expect(svg.getAttribute('aria-label')).toBe('Lumi, your guide');
      expect(svg.getAttribute('aria-hidden')).toBeNull();
    });
  });

  it('honours the size prop', () => {
    const { container } = render(<Lumi state="idle" size={44} />);
    const svg = svgOf(container);
    expect(svg.getAttribute('width')).toBe('44');
    expect(svg.getAttribute('height')).toBe('44');
  });
});
