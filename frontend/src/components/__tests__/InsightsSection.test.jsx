/* The dashboard mounts this, so a throw here costs the whole screen through the
   error boundary - streak, today's action, milestone and all. These pin the two
   rules that keep that from happening: never destructure an unvalidated body,
   and never render a prediction the data does not support. */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PredictionCard } from '../insights/PredictionCard.jsx';

const renderCard = (forecast) =>
  render(
    <MemoryRouter>
      <PredictionCard forecast={forecast} />
    </MemoryRouter>,
  );

const goodForecast = {
  available: true,
  nDays: 20,
  confidence: 'moderate',
  predictedBurden: 22.5,
  interval: [19, 26],
  drivers: [],
  maxBurden: 54,
};

describe('PredictionCard', () => {
  it('renders a well-formed forecast', () => {
    renderCard(goodForecast);
    expect(screen.getByText('19-26')).toBeTruthy();
  });

  /* The under-7-nights rule is the project's hardest, and it was enforced only
     on the server. A partial body with `available: true` rendered the literal
     headline "null-null of 54 - most likely around undefined, a difficult day"
     from three nights of data. */
  it('renders nothing below the seven-night threshold, whatever the server says', () => {
    const { container } = renderCard({ ...goodForecast, nDays: 3 });
    expect(container.textContent).toBe('');
  });

  it('renders nothing when the interval is missing', () => {
    const { container } = renderCard({ ...goodForecast, interval: null });
    expect(container.textContent).toBe('');
  });

  it('renders nothing when the point estimate is missing', () => {
    const { container } = renderCard({ ...goodForecast, predictedBurden: null });
    expect(container.textContent).toBe('');
  });

  it('never renders the strings "null" or "undefined"', () => {
    for (const forecast of [
      { ...goodForecast, interval: [null, null], predictedBurden: null },
      { ...goodForecast, interval: undefined, predictedBurden: undefined },
      { ...goodForecast, nDays: undefined },
    ]) {
      const { container, unmount } = renderCard(forecast);
      expect(container.textContent).not.toContain('null');
      expect(container.textContent).not.toContain('undefined');
      expect(container.textContent).not.toContain('NaN');
      unmount();
    }
  });

  it('renders nothing when the section is unavailable', () => {
    const { container } = renderCard({ available: false, reason: 'not enough data' });
    expect(container.textContent).toBe('');
  });
});
