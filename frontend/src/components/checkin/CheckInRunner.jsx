/* Generic driver for any flow config. Both check-ins render through this. */

import { useEffect, useRef } from 'react';
import { useCheckInFlow } from '../../hooks/useCheckInFlow.js';
import { stepRegistry } from './stepRegistry.js';
import { ProgressIndicator } from './ProgressIndicator.jsx';
import { Button } from '../ui/Button.jsx';
import { Banner } from '../ui/Banner.jsx';
import { Lumi } from '../lumi/Lumi.jsx';
import { formatNightLabel } from '../../lib/dates.js';

export function CheckInRunner({ flow, nightOf, onComplete, onCancel }) {
  const {
    step,
    stepIndex,
    stepCount,
    segments,
    isFirst,
    isLast,
    values,
    setValue,
    canAdvance,
    next,
    back,
    submit,
    isSubmitting,
    submitError,
    restoredFromDraft,
    discardDraft,
  } = useCheckInFlow(flow, nightOf, { onComplete });

  const StepComponent = stepRegistry[step.component];

  /* Lumi follows the flow rather than sitting on one face throughout: settling
     down for the night check-in, waking for the morning one, reading alongside
     the journal step, and encouraging on the last screen where finishing is the
     only thing left to do. */
  const lumiState = isLast
    ? 'encouraging'
    : step.component === 'JournalStep'
      ? 'reading'
      : flow.kind === 'morning'
        ? 'waking'
        : 'resting';

  /* Moving between steps swaps the question in place, with no navigation and no
     focus change. A sighted user sees a new question; a screen-reader user gets
     nothing at all, and the keyboard focus stays on the "Next" button they just
     pressed - which is now attached to a different question.

     Focusing the step region on each change announces the new content and puts
     the user at the top of it. Skipped on the first step, where focus is already
     in the right place and stealing it would interrupt the page being read. */
  const stepRef = useRef(null);
  const firstStep = useRef(true);

  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    stepRef.current?.focus();
  }, [stepIndex]);

  return (
    <div className="stack">
      <header className="checkin__header">
        <div className="lumi-row" style={{ marginBottom: 'var(--space-4)' }}>
          <Lumi size={48} state={lumiState} />
          <div>
            <h1 className="h-size-h2">{flow.title}</h1>
            <p className="text-muted text-sm">{formatNightLabel(nightOf)}</p>
          </div>
        </div>
        <ProgressIndicator segments={segments} stepIndex={stepIndex} stepCount={stepCount} />
      </header>

      {/* Quiet inline notice, never a modal - a fatigued user should not have to
          reconstruct what happened before they can continue. */}
      {restoredFromDraft && (
        <Banner
          title="Picked up where you left off"
          action={
            <Button variant="ghost" onClick={discardDraft}>
              Start over
            </Button>
          }
        >
          Your earlier answers are still here.
        </Banner>
      )}

      {submitError && (
        <Banner tone="alert" title="We couldn't save that" role="alert">
          {submitError === 'already-exists'
            ? "You've already completed this check-in."
            : 'Something went wrong. Your answers are still saved here - try again.'}
        </Banner>
      )}

      {/* tabIndex={-1} makes this focusable programmatically but not a tab stop.
          aria-label carries the position so the announcement is "Step 3 of 6",
          not just the question text read out of nowhere. */}
      <div
        ref={stepRef}
        tabIndex={-1}
        className="checkin__step"
        aria-label={`Step ${stepIndex + 1} of ${stepCount}`}
      >
        {StepComponent ? (
          <StepComponent {...(step.props ?? {})} values={values} setValue={setValue} />
        ) : (
          <Banner tone="alert" role="alert">
            This step is unavailable.
          </Banner>
        )}
      </div>

      <div className="checkin__actions">
        <Button variant="secondary" onClick={isFirst ? onCancel : back}>
          {isFirst ? 'Cancel' : 'Back'}
        </Button>
        {isLast ? (
          <Button onClick={submit} disabled={!canAdvance || isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Finish'}
          </Button>
        ) : (
          <Button onClick={next} disabled={!canAdvance}>
            Next
          </Button>
        )}
      </div>

      {!canAdvance && (
        <p className="text-muted text-xs text-center">Answer everything above to continue.</p>
      )}
    </div>
  );
}
