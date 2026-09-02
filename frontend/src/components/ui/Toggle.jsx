export function Toggle({ label, hint, checked, onChange }) {
  return (
    <button type="button" className="toggle" aria-pressed={checked} onClick={() => onChange(!checked)}>
      <span>
        <span style={{ display: 'block', fontWeight: 500 }}>{label}</span>
        {hint && <span className="field__hint">{hint}</span>}
      </span>
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
    </button>
  );
}
