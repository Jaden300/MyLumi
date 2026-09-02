import { useId } from 'react';
import { MAX_JOURNAL_CHARS } from '../../lib/constants.js';

export function TextArea({ label, hint, placeholder, value, onChange, optional = false }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {optional && <span className="field__hint"> · optional</span>}
      </label>
      {hint && <span className="field__hint">{hint}</span>}
      <textarea
        id={id}
        className="textarea"
        placeholder={placeholder}
        value={value ?? ''}
        maxLength={MAX_JOURNAL_CHARS}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
