/* Discrete choice from a small option set (e.g. awakenings 0/1/2/3+).
   Buttons rather than a <select> - one tap, no popup, large targets.

   A radiogroup with roving tabindex, for the same reasons as RatingScale:
   `aria-pressed` per option announced these as independent toggles rather than
   one choice among several, and gave no arrow-key navigation. */

import { useRef } from 'react';

export function SegmentedControl({ options, value, onChange, label, name }) {
  const groupRef = useRef(null);

  const normalised = options.map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option,
  );

  function onKeyDown(event) {
    const index = normalised.findIndex((o) => o.value === value);
    let nextIndex = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = index === -1 ? 0 : (index + 1) % normalised.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = index === -1 ? 0 : (index - 1 + normalised.length) % normalised.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = normalised.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const next = normalised[nextIndex].value;
    onChange(next);
    groupRef.current?.querySelector(`[data-value="${CSS.escape(String(next))}"]`)?.focus();
  }

  return (
    <div className="field">
      {label && (
        <span className="field__label" id={`${name}-label`}>
          {label}
        </span>
      )}
      <div
        className="segmented"
        role="radiogroup"
        aria-labelledby={label ? `${name}-label` : undefined}
        ref={groupRef}
        onKeyDown={onKeyDown}
      >
        {normalised.map((option, i) => (
          <button
            key={option.value}
            type="button"
            className="segmented__option"
            role="radio"
            aria-checked={value === option.value}
            data-value={option.value}
            /* One tab stop for the group; the first option holds it while
               nothing is selected, so an unanswered control stays reachable
               without implying an answer. */
            tabIndex={value === option.value || (value == null && i === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
