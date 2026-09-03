/* One labelled figure. Used by the last-night summary, the weekly summary, and
   the daily report - extracted so the three read as the same kind of thing.

   `value` takes an em dash when a figure is genuinely unavailable, never a 0.
   Callers pass the dash; this component does not invent one, because deciding
   that a missing value should display as something is the caller's judgement. */

export function Stat({ label, value, note, size = 'md' }) {
  return (
    <div className="stat stack stack--tight">
      <span className="stat__label">{label}</span>
      <strong className={`stat__value stat__value--${size}`}>{value}</strong>
      {note && <span className="stat__note">{note}</span>}
    </div>
  );
}
