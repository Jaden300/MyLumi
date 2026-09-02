/* One labelled figure. Used by the last-night summary, the weekly summary, and
   the daily report - extracted so the three read as the same kind of thing.

   `value` takes an em dash when a figure is genuinely unavailable, never a 0.
   Callers pass the dash; this component does not invent one, because deciding
   that a missing value should display as something is the caller's judgement. */

export function Stat({ label, value, note }) {
  return (
    <div className="stack stack--tight">
      <span className="text-muted text-xs">{label}</span>
      <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>{value}</strong>
      {note && <span className="text-muted text-xs">{note}</span>}
    </div>
  );
}
