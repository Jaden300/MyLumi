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

  it('renders the composition shift finding', () => {
    render(<SymptomProfileCard symptoms={symptoms} />);
    expect(screen.getByText(/makes up a larger share/)).toBeTruthy();
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

  /* A sentence under the chart used to say the line was an estimate. That copy
     is gone (docs/design-system.md, "No caption layer"), so the distinction now
     rests entirely on the drawing: the user's own readings are on the chart as
     dots, and the estimate is a separate line over them. If the dots ever go,
     the estimate becomes indistinguishable from something the user logged. */
  it('keeps the raw readings on the chart beside the estimated line', () => {
    const { container } = render(<RecoveryStateCard recoveryState={recoveryState} />);
    expect(container.querySelectorAll('.state__observed').length).toBeGreaterThan(0);
    expect(container.querySelector('.state__level')).toBeTruthy();
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

/* --- the two dense charts ------------------------------------------------- */

import { SymptomHeatmap } from '../insights/SymptomHeatmap.jsx';
import { LearningCurve } from '../insights/LearningCurve.jsx';

const grid = {
  nights: ['2026-01-01', '2026-01-02', '2026-01-05', '2026-01-06'],
  keys: ['headache', 'photophobia', 'phonophobia', 'brainFog', 'nausea',
         'dizziness', 'fatigue', 'moodDisturbance', 'concentration'],
  labels: ['headache', 'light sensitivity', 'noise sensitivity', 'brain fog', 'nausea',
           'dizziness', 'fatigue', 'irritability or low mood', 'trouble concentrating'],
  // 9 rows x 4 nights.
  values: Array.from({ length: 9 }, (_, r) => [r % 7, (r + 1) % 7, (r + 2) % 7, (r + 3) % 7]),
};

const curve = [
  { trainSize: 6, error: 5.0, naiveError: 8.0, nightOf: '2026-01-08' },
  { trainSize: 7, error: 4.2, naiveError: 3.1, nightOf: '2026-01-09' },
  { trainSize: 8, error: 3.6, naiveError: 6.4, nightOf: '2026-01-10' },
  { trainSize: 9, error: 2.9, naiveError: 5.2, nightOf: '2026-01-11' },
  { trainSize: 10, error: 2.4, naiveError: 4.8, nightOf: '2026-01-12' },
];

describe('SymptomHeatmap', () => {
  it('draws a cell for every symptom on every day in the span', () => {
    const { container } = render(<SymptomHeatmap grid={grid} />);
    // 9 symptoms x 6 calendar days (Jan 1-6, two of them unlogged).
    expect(container.querySelectorAll('.heatmap__cell').length).toBe(54);
  });

  /* The gap rule, at the point a user sees it: unlogged nights keep their
     column instead of the chart closing up and pretending the month was dense. */
  it('marks unlogged nights rather than closing the gap', () => {
    const { container } = render(<SymptomHeatmap grid={grid} />);
    // Jan 3 and Jan 4 were never logged: 9 symptoms x 2 days.
    expect(container.querySelectorAll('.heatmap__cell--empty').length).toBe(18);
  });

  it('describes its shape for a screen reader instead of reading out cells', () => {
    const { container } = render(<SymptomHeatmap grid={grid} />);
    const label = container.querySelector('svg').getAttribute('aria-label');
    expect(label).toContain('nine symptoms');
    expect(label).toContain('4 logged nights');
  });

  it('renders nothing without enough nights to be a chart', () => {
    for (const g of [undefined, null, { nights: [], values: [] }, { ...grid, nights: ['2026-01-01'] }]) {
      const { container, unmount } = render(<SymptomHeatmap grid={g} />);
      expect(container.textContent).toBe('');
      unmount();
    }
  });
});

describe('LearningCurve', () => {
  it('plots one point per out-of-sample check', () => {
    const { container } = render(<LearningCurve curve={curve} />);
    expect(container.querySelectorAll('.curve__dot').length).toBe(5);
    expect(container.querySelector('.curve__model')).toBeTruthy();
    expect(container.querySelector('.curve__naive')).toBeTruthy();
  });

  /* The point of the shading: a model that wins on average but loses often is
     a different thing from one that wins consistently, and the chart has to
     show both sides rather than only the flattering one. */
  it('shades losses as well as wins', () => {
    const { container } = render(<LearningCurve curve={curve} />);
    expect(container.querySelectorAll('.curve__region--better').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.curve__region--worse').length).toBeGreaterThan(0);
  });

  it('says in its label how often the model actually won', () => {
    const { container } = render(<LearningCurve curve={curve} />);
    expect(container.querySelector('svg').getAttribute('aria-label')).toContain('closer on 4 of 5');
  });

  it('renders nothing with too few checks to show a trend', () => {
    for (const c of [undefined, null, [], curve.slice(0, 3)]) {
      const { container, unmount } = render(<LearningCurve curve={c} />);
      expect(container.textContent).toBe('');
      unmount();
    }
  });
});
