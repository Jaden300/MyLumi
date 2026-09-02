/* Wraps <input type="time">, which returns "HH:mm" natively — exactly the
   format we store, so there's no parsing step to get wrong.

   Some browsers hand back "" for a partially-entered time, so the value is
   validated before it reaches state rather than storing an empty string. */

import { useId } from 'react';
import { isValidTime } from '../../lib/dates.js';

export function TimePicker({ label, hint, value, onChange }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {hint && <span className="field__hint">{hint}</span>}
      <input
        id={id}
        type="time"
        className="time-input"
        value={value ?? ''}
        onChange={(event) => {
          const next = event.target.value;
          onChange(isValidTime(next) ? next : null);
        }}
      />
    </div>
  );
}
