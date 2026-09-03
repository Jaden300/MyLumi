/* Flow-agnostic stepper. Knows nothing about symptoms or sleep - it drives any
   flow config from lib/flows/. Both check-ins share this one machine. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadDraft, saveDraft, clearDraft } from '../lib/entries.js';

const DEBOUNCE_MS = 400;

/** Immutable set at a dotted path: setIn(v, 'sleep.stress', 3). */
function setIn(target, path, value) {
  const [head, ...rest] = path.split('.');
  if (rest.length === 0) return { ...target, [head]: value };
  return { ...target, [head]: setIn(target[head] ?? {}, rest.join('.'), value) };
}

export function useCheckInFlow(flow, targetNightOf, { onComplete } = {}) {
  const [values, setValues] = useState(() => flow.initialValues());
  const [stepIndex, setStepIndex] = useState(0);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const debounceRef = useRef(null);
  // Synchronous double-submit guard; see submit() for why state is not enough.
  const submittingRef = useRef(false);
  const latestRef = useRef({ values, stepIndex });
  latestRef.current = { values, stepIndex };

  /* `stepIndexOverride` exists because `latestRef` is assigned during render,
     while commitAndMove needs to persist the step it is moving TO before that
     render has happened. Without it the draft recorded the step the user just
     left, and a tab killed at the wrong moment restored them one screen back. */
  const writeDraft = useCallback(
    (stepIndexOverride) => {
      const { values: v, stepIndex: i } = latestRef.current;
      const index = typeof stepIndexOverride === 'number' ? stepIndexOverride : i;
      saveDraft(flow.draftKey, {
        schemaVersion: 1,
        flowVersion: flow.version ?? 1,
        kind: flow.kind,
        nightOf: targetNightOf,
        stepId: flow.steps[index]?.id ?? flow.steps[0].id,
        values: v,
        updatedAt: new Date().toISOString(),
      });
    },
    [flow, targetNightOf],
  );

  /* Restore on mount. Guarded on nightOf and flowVersion: a draft from a
     previous night must never resurface into tonight's record, and a draft made
     against an older step list can't be trusted to line up. */
  useEffect(() => {
    const draft = loadDraft(flow.draftKey);
    if (!draft || draft.nightOf !== targetNightOf || (draft.flowVersion ?? 1) !== (flow.version ?? 1)) {
      if (draft) clearDraft(flow.draftKey);
      return;
    }
    const index = flow.steps.findIndex((s) => s.id === draft.stepId);
    setValues({ ...flow.initialValues(), ...draft.values });
    setStepIndex(index >= 0 ? index : 0);
    setRestoredFromDraft(true);
  }, [flow, targetNightOf]);

  /* Debounced save while typing or dragging a slider. */
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(writeDraft, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [values, writeDraft]);

  /* Mobile Safari kills backgrounded tabs without firing beforeunload, and the
     target user is on a phone in a dark room. visibilitychange + pagehide is the
     pair that actually fires. */
  useEffect(() => {
    const flush = () => {
      clearTimeout(debounceRef.current);
      writeDraft();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [writeDraft]);

  const step = flow.steps[stepIndex];
  const stepCount = flow.steps.length;

  const setValue = useCallback((path, value) => {
    setValues((current) => setIn(current, path, value));
  }, []);

  const patchValues = useCallback((patch) => {
    setValues((current) => ({ ...current, ...patch }));
  }, []);

  /* Step transitions write immediately rather than waiting on the debounce -
     this is the checkpoint that has to survive a refresh. */
  const commitAndMove = useCallback(
    (nextIndex) => {
      clearTimeout(debounceRef.current);
      setStepIndex(nextIndex);
      // Write the destination step explicitly: this runs before React commits
      // the new index, so latestRef still holds the step being left.
      writeDraft(nextIndex);
    },
    [writeDraft],
  );

  const canAdvance = useMemo(() => (step?.validate ? step.validate(values) : true), [step, values]);

  const next = useCallback(() => {
    if (!canAdvance || stepIndex >= stepCount - 1) return;
    commitAndMove(stepIndex + 1);
  }, [canAdvance, stepIndex, stepCount, commitAndMove]);

  const back = useCallback(() => {
    if (stepIndex <= 0) return;
    commitAndMove(stepIndex - 1);
  }, [stepIndex, commitAndMove]);

  const discardDraft = useCallback(() => {
    clearTimeout(debounceRef.current);
    clearDraft(flow.draftKey);
    setValues(flow.initialValues());
    setStepIndex(0);
    setRestoredFromDraft(false);
  }, [flow]);

  const submit = useCallback(() => {
    /* The guard is a REF, not the isSubmitting state.
       `flow.submit` is synchronous, so setIsSubmitting(true) and (false) land in
       the same React batch and the state is never observably true. Two events
       dispatched before the next render - Enter on a focused button plus the
       click it also fires, or a fast double-tap - therefore both passed the
       state check. The second call hit the no-silent-overwrite rule, came back
       `already-exists`, and flashed "We couldn't save that" over a check-in that
       had in fact saved. A ref updates synchronously, so the second caller sees
       it immediately. */
    if (!canAdvance || submittingRef.current) return { ok: false, reason: 'invalid' };
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    let result;
    try {
      result = flow.submit(targetNightOf, values);
    } catch (error) {
      submittingRef.current = false; // an exception is not a completed check-in
      setIsSubmitting(false);
      setSubmitError('unknown');
      throw error;
    }

    if (result.ok) {
      clearTimeout(debounceRef.current);
      clearDraft(flow.draftKey); // draft survives a FAILED submit on purpose
      /* The guard stays LATCHED on success. Releasing it here would defeat the
         whole point: `flow.submit` is synchronous, so a second click in the same
         tick would find the ref already cleared. A completed check-in is
         terminal - the caller navigates away or swaps in the report - and the
         only way back is a fresh mount. */
      onComplete?.(result);
    } else {
      // A real failure must stay retryable, so release the guard.
      submittingRef.current = false;
      setSubmitError(result.reason ?? 'unknown');
    }
    setIsSubmitting(false);
    return result;
  }, [canAdvance, flow, targetNightOf, values, onComplete]);

  /* Progress is grouped by label, not step index: three symptom screens read as
     one "Symptoms" segment. "Step 3 of 6" when you've barely started is
     discouraging, and this audience is already fatigued. */
  const segments = useMemo(() => {
    const groups = [];
    flow.steps.forEach((s, i) => {
      const last = groups[groups.length - 1];
      if (last && last.label === s.label) {
        last.total += 1;
        if (i <= stepIndex) last.done += 1;
      } else {
        groups.push({ label: s.label, total: 1, done: i <= stepIndex ? 1 : 0, active: false });
      }
    });
    const activeLabel = flow.steps[stepIndex]?.label;
    for (const g of groups) g.active = g.label === activeLabel;
    return groups;
  }, [flow.steps, stepIndex]);

  return {
    step,
    stepIndex,
    stepCount,
    segments,
    isFirst: stepIndex === 0,
    isLast: stepIndex === stepCount - 1,
    values,
    setValue,
    patchValues,
    canAdvance,
    next,
    back,
    submit,
    isSubmitting,
    submitError,
    restoredFromDraft,
    discardDraft,
  };
}
