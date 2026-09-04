import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/* The 3D surface is stubbed for the usual reason - jsdom has no WebGL. */
vi.mock('../../components/pain/PainBodySurface.jsx', () => ({
  PainBodySurface: () => <div data-testid="surface" />,
}));

const { PainInsights } = await import('../PainInsights.jsx');
const { LumiDataProvider, useLumiData } = await import('../../hooks/useLumiData.jsx');
const { buildDemoData, DEMO_LONG_NIGHTS } = await import('../../lib/demoSeed.js');
const { __resetBackendForTests } = await import('../../lib/storage.js');
const { KEYS } = await import('../../lib/storage.js');

/* Drives the page against the REAL demo generator rather than a fixture.

   docs/tasks.md records this as having caught five bugs across two phases, all
   of the silent kind - models that ran without error and reported the wrong
   thing. A fixture shaped to suit the assertions would not have caught any of
   them. */
function LoadDemo({ nights }) {
  const { loadDemo } = useLumiData();
  return (
    <button type="button" onClick={() => loadDemo({ nights })}>
      load demo
    </button>
  );
}

function renderWithDemo(nights = DEMO_LONG_NIGHTS) {
  render(
    <MemoryRouter>
      <LumiDataProvider>
        <LoadDemo nights={nights} />
        <PainInsights />
      </LumiDataProvider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'load demo' }));
}

describe('PainInsights against the real demo seed', () => {
  beforeEach(() => {
    __resetBackendForTests();
    window.localStorage?.clear?.();
  });

  it('shows a trend for the areas with enough ratings', () => {
    renderWithDemo();
    expect(screen.getByRole('heading', { name: /pain over time/i })).toBeTruthy();
    // The demo plants a clearly easing neck and a genuinely flat lower back.
    expect(screen.getByText('Neck')).toBeTruthy();
    expect(screen.getAllByText('easing').length).toBeGreaterThan(0);
  });

  /* The flat region must reach the user as "not clear yet" rather than being
     handed a direction. This is the refusal the whole trend model exists to be
     able to make, and it is invisible unless something asserts it end to end. */
  it('says not clear yet for the area with no real trend', () => {
    renderWithDemo();
    expect(screen.getByText('Lower back')).toBeTruthy();
    expect(screen.getAllByText('not clear yet').length).toBeGreaterThan(0);
  });

  /* Areas below the floor are named, not hidden. Silently omitting them would
     make the page look like a complete picture of where someone hurts when it
     is not. */
  it('names the areas it does not have enough ratings for', () => {
    renderWithDemo();
    expect(screen.getByText(/not on enough nights for a trend yet/i)).toBeTruthy();
  });

  it('opens the projected-against-actual detail for a region', () => {
    renderWithDemo();
    fireEvent.click(screen.getByRole('button', { name: /Neck/ }));

    expect(screen.getByRole('heading', { name: /Neck: projected against actual/i })).toBeTruthy();
    expect(screen.getByText(/only the nights before it/i)).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
  });

  /* The population shape has to be labelled as population data wherever it can
     influence what the user sees, and the page must not promise a date. */
  it('labels the population shape and refuses a recovery date', () => {
    renderWithDemo();
    expect(screen.getByText(/general population data, not a prediction about you/i)).toBeTruthy();
    expect(screen.getByText(/will not estimate a date/i)).toBeTruthy();
  });

  /* Found by opening the page, not by a test.

     The window is a fixed 60 days but the demo covers 42, so the timeline
     opened on 18 nights of nothing - an unlit body captioned "Not logged" as
     the first impression of the headline feature. Every test passed: the
     component was correctly rendering a frame that should never have been in
     the list. Trailing empties were already trimmed and leading ones were not,
     which is exactly the kind of asymmetry that survives review. */
  it('opens on a night that has data, not on the empty start of the window', () => {
    renderWithDemo();
    expect(screen.queryByText('Not logged')).toBeNull();
    expect(screen.getByRole('slider').value).toBe('0');
  });

  it('invites a first entry when nothing has been marked', () => {
    render(
      <MemoryRouter>
        <LumiDataProvider>
          <PainInsights />
        </LumiDataProvider>
      </MemoryRouter>,
    );
    // No demo loaded, so the onboarding redirect or the empty state - either
    // way, no chart and no table.
    expect(screen.queryByRole('table')).toBeNull();
  });
});
