/* Symptom burden over time. Height AND colour both encode severity, so the
   chart is readable without relying on colour alone — and missing days render
   as a visible flat mark rather than silently closing the gap. */

import { MAX_SYMPTOM_BURDEN } from '../../lib/constants.js';
import { formatShortDate } from '../../lib/dates.js';

function severityToken(burden) {
  const level = Math.min(6, Math.floor((burden / MAX_SYMPTOM_BURDEN) * 7));
  return `var(--sev-${level})`;
}

export function SymptomHeatStrip({ entries }) {
  return (
    <div className="heat-strip" role="img" aria-label={describe(entries)}>
      {entries.map((entry) => {
        const burden = entry?.night?.symptomBurden;
        if (!Number.isFinite(burden)) {
          return <div key={entry.nightOf} className="heat-strip__cell heat-strip__cell--empty" />;
        }
        const fraction = burden / MAX_SYMPTOM_BURDEN;
        return (
          <div
            key={entry.nightOf}
            className="heat-strip__cell"
            style={{
              height: `${Math.max(8, fraction * 100)}%`,
              background: severityToken(burden),
            }}
            title={`${formatShortDate(entry.nightOf)}: ${burden} of ${MAX_SYMPTOM_BURDEN}`}
          />
        );
      })}
    </div>
  );
}

function describe(entries) {
  const logged = entries.filter((e) => Number.isFinite(e?.night?.symptomBurden));
  if (logged.length === 0) return 'Symptom burden chart — no entries yet.';
  const first = logged[0].night.symptomBurden;
  const last = logged[logged.length - 1].night.symptomBurden;
  const direction = last < first ? 'lower than' : last > first ? 'higher than' : 'about the same as';
  return `Symptom burden over ${entries.length} days. Most recent is ${last} of ${MAX_SYMPTOM_BURDEN}, ${direction} the start of this period. ${entries.length - logged.length} days not logged.`;
}
