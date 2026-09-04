import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RegionTable } from '../painmap/RegionTable.jsx';

const points = [
  { nightOf: '2026-02-01', day: 8, projected: 5.2, actual: 5, error: 0.2, trainSize: 7 },
  { nightOf: '2026-02-02', day: 9, projected: 4.8, actual: 6, error: -1.2, trainSize: 8 },
];

const backtest = (over) => ({
  points,
  modelError: 0.7,
  naiveError: 1.4,
  beatsNaive: true,
  n: points.length,
  ...over,
});

describe('RegionTable', () => {
  it('renders a row per tested night', () => {
    render(<RegionTable backtest={backtest()} />);
    expect(screen.getAllByRole('row')).toHaveLength(points.length + 1); // + header
  });

  /* Signed, not absolute. Whether the model runs high or low is the useful half
     of the information and an absolute value throws it away. */
  it('shows the direction of each miss', () => {
    render(<RegionTable backtest={backtest()} />);
    expect(screen.getByText('+0.2')).toBeTruthy();
    expect(screen.getByText('-1.2')).toBeTruthy();
  });

  it('renders nothing when there is no backtest to show', () => {
    const { container } = render(<RegionTable backtest={{ points: [], n: 0 }} />);
    expect(container.firstChild).toBeNull();
  });

  /* The pair of tests that matter.

     A validation layer that only appears when the news is good is marketing,
     not validation. Both branches have to render, in the same place and in the
     same register - so both are pinned, and the losing one is pinned hardest,
     because it is the one that would be quietly convenient to lose. */
  it('reports the comparison when the model wins', () => {
    render(<RegionTable backtest={backtest({ beatsNaive: true })} />);
    expect(screen.getByText(/off by 0\.7 points on average/i)).toBeTruthy();
    expect(screen.getByText(/would have been off by 1\.4/i)).toBeTruthy();
    expect(screen.queryByText(/did not do better/i)).toBeNull();
  });

  it('reports the comparison just as plainly when the model loses', () => {
    render(
      <RegionTable
        backtest={backtest({ modelError: 1.9, naiveError: 0.8, beatsNaive: false })}
      />,
    );
    expect(screen.getByText(/off by 1\.9 points on average/i)).toBeTruthy();
    expect(screen.getByText(/did not do better than that here/i)).toBeTruthy();
  });

  /* The projections must be described as out-of-sample wherever they are
     shown. Without that sentence a reader has no way to tell this from a fitted
     line drawn over the data it was fitted on. */
  it('says the projections were made without the night they are compared to', () => {
    render(<RegionTable backtest={backtest()} />);
    expect(screen.getByText(/only the nights before it/i)).toBeTruthy();
  });
});
