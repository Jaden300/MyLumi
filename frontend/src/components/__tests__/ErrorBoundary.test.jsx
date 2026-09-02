import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../layout/ErrorBoundary.jsx';

/* The boundary is the last thing between a render crash and a white screen, so
   it is worth proving it actually catches rather than assuming it does. */

function Boom() {
  throw new Error('render exploded');
}

afterEach(() => vi.restoreAllMocks());

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('all good')).toBeTruthy();
  });

  it('catches a render crash instead of propagating it', () => {
    // React logs the caught error; silence it so the run stays readable.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>,
      ),
    ).not.toThrow();
  });

  it('shows a recovery affordance rather than a blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(container.textContent.trim().length).toBeGreaterThan(0);
    expect(container.querySelector('button')).toBeTruthy();
  });

  it('does not leak the raw error message to the user', () => {
    /* Stack traces and internal messages are noise to a fatigued user and can
       expose internals; the boundary should say something human instead. */
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(container.textContent).not.toContain('render exploded');
  });
});
