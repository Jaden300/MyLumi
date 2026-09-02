/* Generic 0-6 scale - the PCSS symptom rating and every morning rating.

   Discrete buttons rather than a drag slider: a slider requires fine motor
   control and continuous attention, and it never shows an unanswered state
   honestly (a slider always sits somewhere). Buttons let "not answered" stay
   genuinely empty, which matters because a fabricated 0 would enter the
   clinical record. */

import { useRef } from 'react';
import { RATING_MIN, RATING_MAX } from '../../lib/constants.js';

const VALUES = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i);

export function RatingScale({ label, clinical, hint, anchors, value, onChange, name }) {
  const labelId = `${name}-label`;
  const groupRef = useRef(null);

  /* A radiogroup, not seven toggle buttons.
     `aria-pressed` on each option modelled this as seven independent on/off
     controls, which is wrong twice over: it does not convey "one of seven", and
     it gives no arrow-key navigation, so reaching a 0-6 answer took up to seven
     tab stops on every one of nine symptoms. */
  function onKeyDown(event) {
    const index = VALUES.indexOf(value);
    let next = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = index === -1 ? RATING_MIN : Math.min(RATING_MAX, value + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = index === -1 ? RATING_MIN : Math.max(RATING_MIN, value - 1);
    } else if (event.key === 'Home') {
      next = RATING_MIN;
    } else if (event.key === 'End') {
      next = RATING_MAX;
    } else {
      return;
    }

    event.preventDefault();
    onChange(next);
    // Follow focus, as the radiogroup pattern requires.
    groupRef.current?.querySelector(`[data-value="${next}"]`)?.focus();
  }

  return (
    <div className="scale">
      <div className="field">
        <span className="field__label" id={labelId}>
          {label}
        </span>
        {clinical && <span className="field__clinical">{clinical}</span>}
        {hint && <span className="field__hint">{hint}</span>}
      </div>

      <div
        className="scale__options"
        role="radiogroup"
        aria-labelledby={labelId}
        ref={groupRef}
        onKeyDown={onKeyDown}
      >
        {VALUES.map((option) => (
          <button
            key={option}
            type="button"
            className="scale__option"
            role="radio"
            aria-checked={value === option}
            aria-label={`${option} out of ${RATING_MAX}`}
            data-value={option}
            /* Roving tabindex: the group is ONE tab stop. When nothing is chosen
               yet the first option carries it, so the group stays reachable
               without implying an answer. */
            tabIndex={value === option || (value == null && option === RATING_MIN) ? 0 : -1}
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
