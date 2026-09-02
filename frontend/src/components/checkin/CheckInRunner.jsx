/* Generic driver for any flow config. Both check-ins render through this. */

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

  return (
    <div className="stack">
      <header className="checkin__header">
        <div className="lumi-row" style={{ marginBottom: 'var(--space-4)' }}>
          <Lumi size={48} state={isLast ? 'encouraging' : 'idle'} />
          <div>
            <h1 style={{ fontSize: 'var(--fs-h2)' }}>{flow.title}</h1>
            <p className="text-muted text-sm">{formatNightLabel(nightOf)}</p>
          </div>
        </div>
        <ProgressIndicator segments={segments} stepIndex={stepIndex} stepCount={stepCount} />
      </header>

      {/* Quiet inline notice, never a modal — a fatigued user should not have to
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
            : 'Something went wrong. Your answers are still saved here — try again.'}
        </Banner>
      )}

      {StepComponent ? (
        <StepComponent {...(step.props ?? {})} values={values} setValue={setValue} />
      ) : (
        <Banner tone="alert" role="alert">
          This step is unavailable.
        </Banner>
      )}

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
