import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PainSummaryCard, sortedPainRegions } from '../pain/PainSummaryCard.jsx';

describe('PainSummaryCard', () => {
  /* Absence is the point. A night logged before this feature existed, or one
     where the question was never put, must not render a card saying no pain was
     reported - that would assert something about the night that nobody said. */
  it('renders nothing when the user was never asked', () => {
    const { container } = render(<PainSummaryCard pain={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for an unanswered block', () => {
    const { container } = render(<PainSummaryCard pain={{ answered: false, regions: {} }} />);
    expect(container.innerHTML).toBe('');
  });

  it('says so explicitly when the user reported no pain', () => {
    render(<PainSummaryCard pain={{ answered: true, regions: {} }} />);
    expect(screen.getByText('No aching areas reported.')).toBeTruthy();
  });

  it('shows each area with its rating out of ten', () => {
    render(<PainSummaryCard pain={{ answered: true, regions: { thigh_r: 6.5 } }} />);
    expect(screen.getByText('Right thigh')).toBeTruthy();
    expect(screen.getByText('6.5 / 10')).toBeTruthy();
  });

  it('marks an area that was never rated rather than showing a zero', () => {
    render(<PainSummaryCard pain={{ answered: true, regions: { neck_c: null } }} />);
    expect(screen.getByText('Not rated')).toBeTruthy();
    expect(screen.queryByText('0 / 10')).toBeNull();
  });
});

describe('sortedPainRegions', () => {
  it('puts the worst first', () => {
    const sorted = sortedPainRegions({ neck_c: 3, thigh_r: 8, knee_l: 5 });
    expect(sorted.map(([id]) => id)).toEqual(['thigh_r', 'knee_l', 'neck_c']);
  });

  it('sinks unrated areas below rated ones', () => {
    const sorted = sortedPainRegions({ neck_c: null, thigh_r: 2 });
    expect(sorted.map(([id]) => id)).toEqual(['thigh_r', 'neck_c']);
  });

  it('is empty for no regions', () => {
    expect(sortedPainRegions({})).toEqual([]);
    expect(sortedPainRegions(undefined)).toEqual([]);
  });
});
