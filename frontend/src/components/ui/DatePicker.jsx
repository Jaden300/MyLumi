/* Wraps <input type="date">, which returns "YYYY-MM-DD" natively - exactly the
   format the profile stores, so there is no parsing step to get wrong. The same
   shape as TimePicker, which wraps <input type="time"> for the same reason.

   Why the native control rather than a hand-rolled calendar: it is already
   keyboard-operable, already announces correctly, already becomes a proper wheel
   picker on mobile, and already speaks the storage format. A custom calendar
   would have to re-earn all four.

   The trade-off is that the dropdown grid the browser opens is drawn by the OS
   and cannot be themed by CSS. `color-scheme` (tokens.css) at least makes it
   follow the dark or light theme. Everything the page itself owns - the field,
   the icon, the focus ring, the date parts - is branded in components.css. */

import { useId } from 'react';

export function DatePicker({ label, hint, value, onChange, max, min, invalid = false }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {hint && <span className="field__hint">{hint}</span>}
      <div className="date-field">
        <input
          id={id}
          type="date"
          className="date-input"
          max={max}
          min={min}
          value={value ?? ''}
          aria-invalid={invalid || undefined}
          /* The raw value is passed straight through, unlike TimePicker which
             nulls an invalid one. A date field is validated on submit here, and
             the caller owns the error copy ("that date is in the future"), so
             swallowing a half-typed value mid-edit would fight the user. */
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}
