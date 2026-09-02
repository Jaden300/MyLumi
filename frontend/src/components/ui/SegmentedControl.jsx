/* Discrete choice from a small option set (e.g. awakenings 0/1/2/3+).
   Buttons rather than a <select> — one tap, no popup, large targets. */

export function SegmentedControl({ options, value, onChange, label, name }) {
  return (
    <div className="field">
      {label && (
        <span className="field__label" id={`${name}-label`}>
          {label}
        </span>
      )}
      <div className="segmented" role="group" aria-labelledby={label ? `${name}-label` : undefined}>
        {options.map((option) => {
          const optionValue = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? option : option.label;
          return (
            <button
              key={optionValue}
              type="button"
              className="segmented__option"
              aria-pressed={value === optionValue}
              onClick={() => onChange(optionValue)}
            >
              {optionLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
