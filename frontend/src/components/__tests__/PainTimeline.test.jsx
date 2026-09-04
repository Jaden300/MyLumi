import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

/* Same trick as PainMapStep.test.jsx: the 3D surface is stubbed, so the
   transport, the caption and the three-state rendering are all testable in
   jsdom, which has no WebGL and could never mount a real canvas.

   The stub also renders what it was handed, which is how the colour handoff is
   asserted without a GPU: if the timeline ever stopped shading regions, or
   started letting a viewer tap pain into the record, these tests fail. */
vi.mock('../pain/PainBodySurface.jsx', () => ({
  PainBodySurface: ({ regionColors, readOnly }) => (
    <div
      data-testid="surface"
      data-readonly={readOnly ? 'true' : 'false'}
      data-shaded={Object.keys(regionColors ?? {}).sort().join(',')}
    />
  ),
}));

const { PainTimeline } = await import('../painmap/PainTimeline.jsx');

const frame = (nightOf, answered, regions = {}) => ({ nightOf, answered, regions });

const FRAMES = [
  frame('2026-02-01', true, { neck_c: 6 }),
  frame('2026-02-02', false),
  frame('2026-02-03', true, {}),
  frame('2026-02-04', true, { neck_c: 4, knee_l: 2 }),
];

describe('PainTimeline', () => {
  it('says so plainly when there is nothing to play', () => {
    render(<PainTimeline frames={[]} />);
    expect(screen.getByText(/play them back here/i)).toBeTruthy();
  });

  it('shades the regions rated on the current night', () => {
    render(<PainTimeline frames={FRAMES} />);
    expect(screen.getByTestId('surface').dataset.shaded).toBe('neck_c');
  });

  /* A playback view is someone looking, not someone reporting. If a tap here
     could write a rating it would put a number in the clinical record that
     nobody entered. */
  it('puts the body in read-only mode', () => {
    render(<PainTimeline frames={FRAMES} />);
    expect(screen.getByTestId('surface').dataset.readonly).toBe('true');
  });

  /* The distinction the whole caption exists for. The body looks identical on
     these two nights, so if the caption collapsed them the app would be
     claiming "nothing hurt" on a night nobody logged - a fabricated answer. */
  it('keeps not-logged and nothing-hurt visibly different', () => {
    render(<PainTimeline frames={FRAMES} />);
    const scrub = screen.getByRole('slider');

    fireEvent.change(scrub, { target: { value: '1' } });
    expect(screen.getByText('Not logged')).toBeTruthy();

    fireEvent.change(scrub, { target: { value: '2' } });
    expect(screen.getByText('Nothing hurt')).toBeTruthy();
    expect(screen.queryByText('Not logged')).toBeNull();
  });

  it('names every rated region, worst first', () => {
    render(<PainTimeline frames={FRAMES} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '3' } });
    expect(screen.getByText('Neck 4, Left knee 2')).toBeTruthy();
  });

  it('scrubbing moves the shading', () => {
    render(<PainTimeline frames={FRAMES} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '3' } });
    expect(screen.getByTestId('surface').dataset.shaded).toBe('knee_l,neck_c');
  });

  it('plays forward and stops at the end', () => {
    vi.useFakeTimers();
    try {
      render(<PainTimeline frames={FRAMES} />);
      fireEvent.click(screen.getByRole('button', { name: 'Play' }));

      act(() => {
        vi.advanceTimersByTime(700 * 10);
      });

      // Landed on the last frame and stopped there rather than looping.
      expect(screen.getByRole('slider').value).toBe('3');
      expect(screen.getByRole('button', { name: 'Replay' })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('scrubbing stops playback rather than fighting it', () => {
    vi.useFakeTimers();
    try {
      render(<PainTimeline frames={FRAMES} />);
      fireEvent.click(screen.getByRole('button', { name: 'Play' }));
      fireEvent.change(screen.getByRole('slider'), { target: { value: '1' } });

      act(() => {
        vi.advanceTimersByTime(700 * 3);
      });

      expect(screen.getByRole('slider').value).toBe('1');
      expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

/* Idle motion is a symptom trigger for the people this app is for, so the
   animation has to be genuinely absent under the preference - not merely
   slower - and every night still has to be reachable without it. */
describe('PainTimeline under prefers-reduced-motion', () => {
  it('offers stepping instead of autoplay, and still reaches every night', () => {
    const original = window.matchMedia;
    window.matchMedia = (query) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      onchange: null,
      dispatchEvent: () => false,
    });

    try {
      render(<PainTimeline frames={FRAMES} />);

      expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
      const step = screen.getByRole('button', { name: 'Next night' });

      fireEvent.click(step);
      fireEvent.click(step);
      fireEvent.click(step);

      expect(screen.getByRole('slider').value).toBe('3');
      expect(step.disabled).toBe(true);
    } finally {
      window.matchMedia = original;
    }
  });
});
