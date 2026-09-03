/* The stepper drives both check-ins, and until now nothing tested it.

   These cover the two failures that actually reach a user: a check-in that saved
   but reported an error anyway, and a draft that restores the wrong screen. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCheckInFlow } from '../useCheckInFlow.js';
import { loadDraft, clearDraft } from '../../lib/entries.js';
import { __resetBackendForTests } from '../../lib/storage.js';

const NIGHT_OF = '2026-01-10';

/* A miniature flow with the same contract as the real ones. Using a fake keeps
   the test about the stepper rather than about symptom validation.

   Build it ONCE per test and hold the identity stable: `flow` is a dependency of
   the restore effect, so constructing it inside the render function would make a
   new object every render and spin forever. The real pages memoise it for the
   same reason. */
function makeFlow(submitImpl) {
  return {
    kind: 'night',
    draftKey: 'night',
    version: 1,
    title: 'Test flow',
    initialValues: () => ({ a: null, b: null }),
    steps: [
      { id: 'one', label: 'One', component: 'SymptomStep', validate: () => true },
      { id: 'two', label: 'Two', component: 'MoodStep', validate: () => true },
      { id: 'three', label: 'Three', component: 'JournalStep', validate: () => true },
    ],
    submit: submitImpl,
  };
}

beforeEach(() => {
  __resetBackendForTests();
  clearDraft('night');
});

describe('submit', () => {
  /* The real failure: `flow.submit` is synchronous, so setIsSubmitting(true) and
     (false) land in one React batch and the state guard is never observably
     true. Two events dispatched before the next render - Enter on a focused
     button plus its click, or a fast double-tap - both got through. The second
     hit the no-silent-overwrite rule and flashed "We couldn't save that" over a
     check-in that HAD saved. */
  it('ignores a second submit fired before React re-renders', () => {
    const submit = vi.fn(() => ({ ok: true, data: {} }));
    const flow = makeFlow(submit);
    const { result } = renderHook(() => useCheckInFlow(flow, NIGHT_OF));

    act(() => {
      result.current.submit();
      result.current.submit(); // same tick, as a double-click produces
    });

    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('reports no error when the single submit succeeded', () => {
    const submit = vi.fn(() => ({ ok: true, data: {} }));
    const flow = makeFlow(submit);
    const { result } = renderHook(() => useCheckInFlow(flow, NIGHT_OF));

    act(() => {
      result.current.submit();
      result.current.submit();
    });

    expect(result.current.submitError).toBe(null);
  });

  it('calls onComplete exactly once', () => {
    const onComplete = vi.fn();
    const flow = makeFlow(() => ({ ok: true, data: {} }));
    const { result } = renderHook(() => useCheckInFlow(flow, NIGHT_OF, { onComplete }));

    act(() => {
      result.current.submit();
      result.current.submit();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('surfaces a real failure and keeps the draft', () => {
    const flow = makeFlow(() => ({ ok: false, reason: 'already-exists' }));
    const { result } = renderHook(() => useCheckInFlow(flow, NIGHT_OF));

    // Drafts are debounced; step transitions write immediately.
    act(() => {
      result.current.setValue('a', 1);
      result.current.next();
    });
    act(() => {
      result.current.submit();
    });

    expect(result.current.submitError).toBe('already-exists');
    // A failed submit must not throw away what the user typed.
    expect(loadDraft('night')).toBeTruthy();
  });

  it('stays retryable after a failure', () => {
    const submit = vi.fn(() => ({ ok: false, reason: 'quota' }));
    const flow = makeFlow(submit);
    const { result } = renderHook(() => useCheckInFlow(flow, NIGHT_OF));

    act(() => {
      result.current.submit();
    });
    act(() => {
      result.current.submit();
    });

    // The double-submit guard must not lock the user out of a real retry.
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('clears the draft only on success', () => {
    const flow = makeFlow(() => ({ ok: true, data: {} }));
    const { result } = renderHook(() => useCheckInFlow(flow, NIGHT_OF));

    act(() => {
      result.current.setValue('a', 1);
    });
    act(() => {
      result.current.submit();
    });

    expect(loadDraft('night')).toBe(null);
  });
});

describe('draft position', () => {
  /* The draft is written from a ref assigned during render, but commitAndMove
     runs before that render. Persisting without the destination index recorded
     the step the user just LEFT, so a tab killed at the wrong moment restored
     them one screen back - re-asking questions they had answered. */
  it('records the step being moved to, not the one being left', () => {
    const flow = makeFlow(() => ({ ok: true }));
    const { result } = renderHook(() => useCheckInFlow(flow, NIGHT_OF));

    act(() => {
      result.current.next(); // 0 -> 1
    });
    expect(loadDraft('night').stepId).toBe('two');

    act(() => {
      result.current.next(); // 1 -> 2
    });
    expect(loadDraft('night').stepId).toBe('three');

    act(() => {
      result.current.back(); // 2 -> 1
    });
    expect(loadDraft('night').stepId).toBe('two');
  });

  it('restores to the step the draft recorded', () => {
    const flow = makeFlow(() => ({ ok: true }));
    const first = renderHook(() => useCheckInFlow(flow, NIGHT_OF));
    act(() => {
      first.result.current.setValue('a', 7);
    });
    // `next` writes the draft immediately, capturing the value set above; the
    // debounced write would not have fired yet.
    act(() => {
      first.result.current.next();
    });
    first.unmount();

    const second = renderHook(() => useCheckInFlow(flow, NIGHT_OF));
    expect(second.result.current.stepIndex).toBe(1);
    expect(second.result.current.values.a).toBe(7);
    expect(second.result.current.restoredFromDraft).toBe(true);
  });

  it('ignores a draft belonging to a different night', () => {
    const flow = makeFlow(() => ({ ok: true }));
    const first = renderHook(() => useCheckInFlow(flow, NIGHT_OF));
    act(() => {
      first.result.current.next();
    });
    first.unmount();

    // A draft from last night must never resurface into tonight's record.
    const second = renderHook(() => useCheckInFlow(flow, '2026-01-11'));
    expect(second.result.current.stepIndex).toBe(0);
    expect(second.result.current.restoredFromDraft).toBe(false);
  });
});
