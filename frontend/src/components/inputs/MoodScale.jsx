/* Visual analog mood scale, 0-100.

   A continuous slider is correct here - VAS mood measures are collected this way
   precisely because mood doesn't quantise into 7 buckets. Until the user touches
   it there is no value, so the thumb starting at the midpoint would be a
   fabricated answer; the control renders unset until first interaction. */

import { useId } from 'react';
import { MOOD_VAS_MIN, MOOD_VAS_MAX } from '../../lib/constants.js';

function describeMood(value) {
  if (value == null) return 'Not set';
  if (value <= 15) return 'Very low';
  if (value <= 35) return 'Low';
  if (value <= 65) return 'Okay';
  if (value <= 85) return 'Good';
  return 'Very good';
}

export function MoodScale({ label, hint, value, onChange }) {
  const id = useId();
  const isSet = Number.isFinite(value);
  const sliderValue = isSet ? value : 50;

  return (
    <div className="vas">
      <div className="field">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        {hint && <span className="field__hint">{hint}</span>}
      </div>

      <div className="vas__value" aria-hidden="true">
        {isSet ? describeMood(value) : <span className="text-muted">Drag to set</span>}
      </div>

      <input
        id={id}
        type="range"
        className="vas__slider"
        min={MOOD_VAS_MIN}
        max={MOOD_VAS_MAX}
        step={1}
        value={sliderValue}
        aria-valuetext={isSet ? `${value} of 100, ${describeMood(value)}` : 'Not set'}
        onChange={(event) => onChange(Number(event.target.value))}
      />

      <div className="scale__anchors" aria-hidden="true">
        <span>Very low</span>
        <span>Very good</span>
      </div>
    </div>
  );
}
