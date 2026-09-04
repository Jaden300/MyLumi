/* Pain rating for one body region, 0-10 in half points.

   A slider, where RatingScale deliberately uses buttons. The reasoning there -
   "a slider always sits somewhere", so an unanswered question cannot be shown
   honestly - still holds, and is honoured the same way MoodScale honours it:
   the control renders visibly unset until first interaction, and reports null
   rather than a midpoint until then.

   What differs from the nine PCSS items is the ordering of events. Those are
   nine questions put to the user at once, where "not answered yet" is the
   normal state of most of them. A pain region only exists here because the user
   deliberately tapped that part of the body, so the question is already
   answered in the affirmative; what remains is how much. Twenty-one buttons
   would also miss the tap-target sizes the accessibility pass settled on.

   0-10 is the Numeric Rating Scale, which is the standard instrument for pain
   and is why this scale is not the 0-6 used elsewhere in the app. */

import { useId } from 'react';
import { PAIN_MIN, PAIN_MAX, PAIN_STEP } from '../../lib/painRegions.js';

/* Verbal anchors for the NRS, following the usual mild 1-3 / moderate 4-6 /
   severe 7-10 split. The wording stays descriptive rather than clinical,
   because this sits next to the number the user chose and must not read as an
   assessment of them.

   Half steps land BETWEEN bands, and the boundaries are set with `<` rather
   than `<=` so that they round the honest way: 6.5 is not yet severe, so it
   reads moderate, and only a full 7 crosses over. Getting this backwards would
   label a rating one band worse than the instrument says it is. */
export function describePain(value) {
  if (!Number.isFinite(value)) return 'Not set';
  if (value === 0) return 'No pain';
  if (value < 4) return 'Mild';
  if (value < 7) return 'Moderate';
  return 'Severe';
}

export function PainScale({ label, value, onChange, onRemove }) {
  const id = useId();
  const isSet = Number.isFinite(value);
  // Where the thumb sits before the user has said anything. The value is not
  // reported until they move it, so this is presentation only.
  const sliderValue = isSet ? value : PAIN_MIN;

  return (
    <div className="pain-scale">
      <div className="pain-scale__head">
        <label className="pain-scale__label" htmlFor={id}>
          {label}
        </label>
        <div className="pain-scale__readout">
          {isSet ? (
            <>
              <strong className="pain-scale__value">{value}</strong>
              <span className="pain-scale__of">/ {PAIN_MAX}</span>
            </>
          ) : (
            <span className="text-muted">Drag to rate</span>
          )}
        </div>
      </div>

      <input
        id={id}
        type="range"
        className="pain-scale__slider"
        min={PAIN_MIN}
        max={PAIN_MAX}
        step={PAIN_STEP}
        value={sliderValue}
        data-unset={isSet ? undefined : 'true'}
        aria-valuetext={isSet ? `${value} out of ${PAIN_MAX}, ${describePain(value)}` : 'Not set'}
        onChange={(event) => onChange(Number(event.target.value))}
      />

      <div className="pain-scale__foot">
        <span className="pain-scale__anchor" aria-hidden="true">
          {describePain(value)}
        </span>
        {onRemove && (
          <button type="button" className="pain-scale__remove" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
