/* Generic 0-6 scale — the PCSS symptom rating and every morning rating.

   Discrete buttons rather than a drag slider: a slider requires fine motor
   control and continuous attention, and it never shows an unanswered state
   honestly (a slider always sits somewhere). Buttons let "not answered" stay
   genuinely empty, which matters because a fabricated 0 would enter the
   clinical record. */

import { RATING_MIN, RATING_MAX } from '../../lib/constants.js';

const VALUES = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i);

export function RatingScale({ label, clinical, hint, anchors, value, onChange, name }) {
  const labelId = `${name}-label`;
  return (
    <div className="scale">
      <div className="field">
        <span className="field__label" id={labelId}>
          {label}
        </span>
        {clinical && <span className="field__clinical">{clinical}</span>}
        {hint && <span className="field__hint">{hint}</span>}
      </div>

      <div className="scale__options" role="group" aria-labelledby={labelId}>
        {VALUES.map((option) => (
          <button
            key={option}
            type="button"
            className="scale__option"
            aria-pressed={value === option}
            aria-label={`${option} out of ${RATING_MAX}`}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>

      {anchors && (
        <div className="scale__anchors" aria-hidden="true">
          <span>{anchors.min}</span>
          <span>{anchors.max}</span>
        </div>
      )}
    </div>
  );
}
