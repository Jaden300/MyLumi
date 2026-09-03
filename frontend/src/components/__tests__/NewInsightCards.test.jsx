/* The three cards added for the per-symptom, validation and latent-state models.

   Same two rules the PredictionCard tests pin, for the same reason: these mount
   inside the insights page, and a throw here costs the whole screen through the
   error boundary. Every card must refuse an unavailable or malformed section
   rather than rendering a partial one.

   The fixtures below are real response shapes, copied from what the backend
   actually returns for a 22-night demo dataset. */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SymptomProfileCard } from '../insights/SymptomProfileCard.jsx';
import { ModelHonestyCard } from '../insights/ModelHonestyCard.jsx';
import { RecoveryStateCard } from '../insights/RecoveryStateCard.jsx';

const symptoms = {
  available: true,
  reason: null,
  confidence: 'moderate',
  nDays: 22,
  summary: 'Your headache ratings have been coming down, while your brain fog has stayed about the same.',
  shifts: [
    {
      key: 'brainFog',
      label: 'brain fog',
      shiftPoints: 5.7,
      direction: 'larger',
      pValue: 0.005,
      n: 21,
      statement:
        'On days following your shorter nights, brain fog makes up a larger share of your total symptom burden.',
    },
  ],
  rates: [
    {
      key: 'headache',
      label: 'headache',
      weeklyChange: -0.56,
      ciLow: -0.7,
      ciHigh: -0.41,
      status: 'easing',
      laggard: false,
      n: 22,
    },
    {
      key: 'brainFog',
      label: 'brain fog',
      weeklyChange: -0.02,
      ciLow: -0.3,
      ciHigh: 0.24,
      status: 'unclear',
      laggard: false,
      n: 22,
    },
  ],
};

const validation = {
  available: true,
  reason: null,
  confidence: 'low',
  nDays: 22,
  folds: 13,
  modelError: 3.04,
  naiveError: 6.39,
  skillScore: 0.524,
  beatsNaive: true,
  coverage: 0.846,
  targetCoverage: 0.8,
  statement:
    "Tested on 13 of your own nights, MyLumi's forecast was about 52% closer than simply assuming tomorrow matches today.",
};

const recoveryState = {
  available: true,
  reason: null,
  confidence: 'moderate',
  nDays: 22,
  points: [
    { nightOf: '2026-01-01', observed: 32, level: 30.1, lower: 26.0, upper: 34.2 },
    { nightOf: '2026-01-02', observed: 30, level: 29.2, lower: 25.4, upper: 33.0 },
    // A three-night gap: the band must widen here rather than a value appearing.
    { nightOf: '2026-01-06', observed: 25, level: 26.0, lower: 20.1, upper: 31.9 },
    { nightOf: '2026-01-07', observed: 24, level: 25.1, lower: 21.0, upper: 29.2 },
  ],
  slopePerDay: -0.88,
  direction: 'improving',
  observationNoise: 3.1,
  statement:
    'Underneath the day-to-day movement, your symptom burden has been easing by roughly 6.2 points a week.',
  maxBurden: 54,
};

describe('SymptomProfileCard', () => {
  it('renders the summary and a bar per symptom', () => {
    render(<SymptomProfileCard symptoms={symptoms} />);
    expect(screen.getByText(/headache ratings have been coming down/)).toBeTruthy();
    expect(screen.getByText('headache')).toBeTruthy();
    expect(screen.getByText('brain fog')).toBeTruthy();
  });

  it('shows an undecided trend as words, never as a direction', () => {
    render(<SymptomProfileCard symptoms={symptoms} />);
    // The unclear symptom must not be given a signed rate.
    expect(screen.getByText('not clear yet')).toBeTruthy();
    expect(screen.queryByText('-0.0/wk')).toBeNull();
  });

  it('renders the composition shift finding with its sample size', () => {
    render(<SymptomProfileCard symptoms={symptoms} />);
    expect(screen.getByText(/makes up a larger share/)).toBeTruthy();
    expect(screen.getByText(/Based on 21 nights/)).toBeTruthy();
  });

  it('renders nothing when unavailable', () => {
    const { container } = render(
      <SymptomProfileCard symptoms={{ available: false, reason: 'not yet' }} />,
    );
    expect(container.textContent).toBe('');
  });

  it('renders nothing for a missing or empty section', () => {
    for (const section of [undefined, null, {}, { available: true, rates: [], shifts: [] }]) {
      const { container, unmount } = render(<SymptomProfileCard symptoms={section} />);
      expect(container.textContent).toBe('');
      unmount();
    }
  });
});

describe('ModelHonestyCard', () => {
  it('shows the comparison against the naive baseline', () => {
    render(<ModelHonestyCard validation={validation} />);
    expect(screen.getByText(/52% closer/)).toBeTruthy();
    expect(screen.getByText('Tomorrow = today')).toBeTruthy();
    expect(screen.getByText('3.0')).toBeTruthy();
    expect(screen.getByText('6.4')).toBeTruthy();
  });

  it('reports coverage against the target it aimed for', () => {
    render(<ModelHonestyCard validation={validation} />);
    expect(screen.getByText('85%')).toBeTruthy();
    expect(screen.getByText(/80% of the time/)).toBeTruthy();
  });

  /* The whole point of this card. If it only rendered when the news was good it
     would be marketing rather than validation. */
  it('renders a loss just as plainly as a win', () => {
    render(
      <ModelHonestyCard
        validation={{
          ...validation,
          modelError: 7.1,
          naiveError: 6.39,
          skillScore: -0.111,
          beatsNaive: false,
          statement:
            "Tested on 13 of your own nights, MyLumi's forecast was no better than assuming tomorrow matches today. That is why the range matters more than the single number.",
        }}
      />,
    );
    expect(screen.getByText(/no better than assuming/)).toBeTruthy();
    expect(screen.getByText('7.1')).toBeTruthy();
  });

  it('renders nothing when unavailable or malformed', () => {
    for (const section of [
      undefined,
      null,
      { available: false, reason: 'not enough nights' },
      { available: true, folds: 0, modelError: null },
    ]) {
      const { container, unmount } = render(<ModelHonestyCard validation={section} />);
      expect(container.textContent).toBe('');
      unmount();
    }
  });
});

describe('RecoveryStateCard', () => {
  it('renders the statement and both series', () => {
    const { container } = render(<RecoveryStateCard recoveryState={recoveryState} />);
    expect(screen.getByText(/easing by roughly 6.2 points a week/)).toBeTruthy();
    // One dot per logged night, and one estimated line.
    expect(container.querySelectorAll('.state__observed').length).toBe(4);
    expect(container.querySelector('.state__level')).toBeTruthy();
    expect(container.querySelector('.state__band')).toBeTruthy();
  });

  /* The doctrine the model is built around, checked at the point a user sees
     it: a night nobody logged gets no dot. */
  it('draws no point for a night that was never logged', () => {
    const { container } = render(<RecoveryStateCard recoveryState={recoveryState} />);
    const titles = [...container.querySelectorAll('title')].map((t) => t.textContent);
    expect(titles.some((t) => t.includes('2026-01-03'))).toBe(false);
    expect(titles.some((t) => t.includes('2026-01-06'))).toBe(true);
  });

  it('says plainly that the line is an estimate', () => {
    render(<RecoveryStateCard recoveryState={recoveryState} />);
    expect(screen.getByText(/not something you logged/)).toBeTruthy();
  });

  it('renders nothing when unavailable or too short to plot', () => {
    for (const section of [
      undefined,
      null,
      { available: false, reason: 'not yet' },
      { available: true, points: [] },
      { available: true, points: [recoveryState.points[0]] },
    ]) {
      const { container, unmount } = render(<RecoveryStateCard recoveryState={section} />);
      expect(container.textContent).toBe('');
      unmount();
    }
  });

  it('never renders the strings "null" or "undefined"', () => {
    const { container } = render(
      <RecoveryStateCard
        recoveryState={{ ...recoveryState, statement: null, observationNoise: undefined }}
      />,
    );
    expect(container.textContent).not.toContain('null');
    expect(container.textContent).not.toContain('undefined');
  });
});
