import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';

/* The whole point of keeping the picking logic and the renderer apart: with the
   3D surface stubbed to a plain button, the entire selection and rating flow is
   testable in jsdom, which has no WebGL and could never mount a real canvas. */
vi.mock('../pain/PainBodySurface.jsx', () => ({
  PainBodySurface: ({ onPickRegion }) => (
    <div>
      <button type="button" onClick={() => onPickRegion('thigh_r')}>
        tap right thigh
      </button>
      <button type="button" onClick={() => onPickRegion('knee_l')}>
        tap left knee
      </button>
      <button type="button" onClick={() => onPickRegion(null)}>
        tap nothing
      </button>
    </div>
  ),
}));

const { PainMapStep } = await import('../checkin/steps/PainMapStep.jsx');
const { describePain } = await import('../inputs/PainScale.jsx');
const { createNightFlow } = await import('../../lib/flows/nightFlow.js');

/* Mirrors the dotted-path setter in useCheckInFlow, so the step is driven here
   exactly as the real runner drives it. */
function setIn(target, path, value) {
  const [head, ...rest] = path.split('.');
  if (rest.length === 0) return { ...target, [head]: value };
  return { ...target, [head]: setIn(target[head] ?? {}, rest.join('.'), value) };
}

let latestValues;

function Harness({ initial = { pain: { answered: false, regions: {} } } }) {
  const [values, setValues] = useState(initial);
  latestValues = values;
  return (
    <PainMapStep values={values} setValue={(path, v) => setValues((c) => setIn(c, path, v))} />
  );
}

const painStep = createNightFlow(() => {}).steps.find((s) => s.id === 'pain');

beforeEach(() => {
  latestValues = undefined;
});

describe('marking regions', () => {
  it('marks a region when the body is tapped', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('tap right thigh'));

    expect(latestValues.pain.answered).toBe(true);
    expect(latestValues.pain.regions).toHaveProperty('thigh_r');
    expect(screen.getByText('Right thigh')).toBeTruthy();
  });

  it('marks a region without inventing a rating for it', () => {
    // Tapping says where, not how much. A default score would be a fabricated
    // clinical value, so the region is marked and the rating stays unset.
    render(<Harness />);
    fireEvent.click(screen.getByText('tap right thigh'));

    expect(latestValues.pain.regions.thigh_r).toBeNull();
    expect(screen.getByText('Drag to rate')).toBeTruthy();
  });

  it('ignores a tap that resolved to no region', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('tap nothing'));

    expect(latestValues.pain.answered).toBe(false);
    expect(latestValues.pain.regions).toEqual({});
  });

  it('does not duplicate or reset a region tapped twice', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('tap right thigh'));
    fireEvent.change(screen.getByRole('slider'), { target: { value: '6.5' } });
    fireEvent.click(screen.getByText('tap right thigh'));

    expect(Object.keys(latestValues.pain.regions)).toEqual(['thigh_r']);
    expect(latestValues.pain.regions.thigh_r).toBe(6.5);
  });

  it('marks several regions independently', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('tap right thigh'));
    fireEvent.click(screen.getByText('tap left knee'));

    expect(Object.keys(latestValues.pain.regions).sort()).toEqual(['knee_l', 'thigh_r']);
    expect(screen.getAllByRole('slider')).toHaveLength(2);
  });
});

describe('rating a region', () => {
  it('records a half step exactly', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('tap right thigh'));
    fireEvent.change(screen.getByRole('slider'), { target: { value: '7.5' } });

    expect(latestValues.pain.regions.thigh_r).toBe(7.5);
  });

  it('offers half steps on the slider', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('tap right thigh'));
    const slider = screen.getByRole('slider');

    expect(slider.getAttribute('step')).toBe('0.5');
    expect(slider.getAttribute('min')).toBe('0');
    expect(slider.getAttribute('max')).toBe('10');
  });

  it('reads the rating out for a screen reader', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('tap right thigh'));
    const slider = screen.getByRole('slider');

    expect(slider.getAttribute('aria-valuetext')).toBe('Not set');
    fireEvent.change(slider, { target: { value: '7.5' } });
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe(
      '7.5 out of 10, Severe',
    );
  });
});

describe('describePain', () => {
  it('follows the standard NRS bands', () => {
    expect(describePain(0)).toBe('No pain');
    expect(describePain(1)).toBe('Mild');
    expect(describePain(3.5)).toBe('Mild');
    expect(describePain(4)).toBe('Moderate');
    expect(describePain(6)).toBe('Moderate');
    expect(describePain(7)).toBe('Severe');
    expect(describePain(10)).toBe('Severe');
  });

  /* Half steps fall between bands, and they must round toward the lower one -
     6.5 is not yet severe. Labelling a rating one band worse than the
     instrument says is the kind of overstatement this app refuses elsewhere. */
  it('does not promote a half step into the next band', () => {
    expect(describePain(3.5)).toBe('Mild');
    expect(describePain(6.5)).toBe('Moderate');
  });

  it('says nothing at all for an unset rating', () => {
    expect(describePain(null)).toBe('Not set');
    expect(describePain(undefined)).toBe('Not set');
    expect(describePain(NaN)).toBe('Not set');
  });
});

describe('removing a region', () => {
  it('drops the key entirely rather than nulling it', () => {
    // A null value still reads as marked, so the region would stay in the list.
    render(<Harness />);
    fireEvent.click(screen.getByText('tap right thigh'));
    fireEvent.click(screen.getByText('Remove'));

    expect(latestValues.pain.regions).not.toHaveProperty('thigh_r');
    expect(screen.queryByText('Right thigh')).toBeNull();
  });
});

describe('reporting no pain', () => {
  it('answers the question without marking anything', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Nothing hurt today'));

    expect(latestValues.pain).toEqual({ answered: true, regions: {} });
  });

  it('clears regions already marked', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('tap right thigh'));
    fireEvent.click(screen.getByText('Nothing hurt today'));

    expect(latestValues.pain.regions).toEqual({});
  });
});

describe('the list fallback', () => {
  it('can mark a region with no 3D interaction at all', () => {
    // The path a keyboard or screen reader user takes, and the one that works
    // when the model fails to load.
    render(<Harness />);
    fireEvent.click(screen.getByText('Choose an area from a list'));
    fireEvent.click(screen.getByText('Left calf'));

    expect(latestValues.pain.regions).toHaveProperty('calf_l');
  });
});

describe('step validation', () => {
  it('blocks the step until the user has said something', () => {
    expect(painStep.validate({ pain: { answered: false, regions: {} } })).toBe(false);
    expect(painStep.validate({})).toBe(false);
  });

  it('accepts an explicit no-pain answer', () => {
    expect(painStep.validate({ pain: { answered: true, regions: {} } })).toBe(true);
  });

  it('accepts marked regions', () => {
    expect(painStep.validate({ pain: { answered: true, regions: { thigh_r: 5 } } })).toBe(true);
  });

  it('accepts a marked but unrated region, so nobody is forced to invent a number', () => {
    expect(painStep.validate({ pain: { answered: true, regions: { thigh_r: null } } })).toBe(true);
  });
});
