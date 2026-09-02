/* Symptom burden over time. Height AND colour both encode severity, so the
   chart is readable without relying on colour alone - and missing days render
   as a visible flat mark rather than silently closing the gap.

   ## Why the cells are links

   This was a div with a `title` attribute, which is the one tooltip mechanism
   that is neither keyboard-reachable nor reliably announced - and on touch, where
   most of these users are, it never appears at all. The trajectory chart solved
   the same problem with real SVG <title> children, but this strip is HTML, so
   that option does not exist here.

   Making each logged night a link to its detail page fixes the accessibility
   problem and the usability one together: the value is now in the accessible
   name, it is reachable by keyboard, and tapping a night goes somewhere useful
   instead of revealing a tooltip. Unlogged days stay inert divs - there is
   nothing to navigate to, and a disabled control would just add a tab stop.

   ## Why role="img" moved off the container

   It used to sit on the wrapper. `role="img"` makes an element a leaf: everything
   inside it is removed from the accessibility tree, which was harmless for divs
   but would make these links unreachable to a screen reader - an accessibility
   fix that broke accessibility.

   So the summary is now a visually-hidden <p> beside the strip, and the strip
   itself is a plain container of real links. A screen-reader user hears the
   overall shape first and can then navigate the individual nights, which is
   strictly more than the old version offered. */

import { Link } from 'react-router-dom';
import { MAX_SYMPTOM_BURDEN } from '../../lib/constants.js';
import { formatShortDate } from '../../lib/dates.js';
import { severityToken } from '../../lib/severity.js';

export function SymptomHeatStrip({ entries, linkToDetail = true }) {
  /* Without links there is nothing focusable inside, so the old leaf-node
     treatment is still the right one. */
  if (!linkToDetail) {
    return (
      <div className="heat-strip" role="img" aria-label={describe(entries)}>
        {entries.map((entry) => {
          const burden = entry?.night?.symptomBurden;
          if (!Number.isFinite(burden)) {
            return <div key={entry.nightOf} className="heat-strip__cell heat-strip__cell--empty" />;
          }
          return (
            <div
              key={entry.nightOf}
              className="heat-strip__cell"
              style={{
                height: `${Math.max(8, (burden / MAX_SYMPTOM_BURDEN) * 100)}%`,
                background: severityToken(burden),
              }}
              title={`${formatShortDate(entry.nightOf)}: ${burden} of ${MAX_SYMPTOM_BURDEN}`}
            />
          );
        })}
      </div>
    );
  }

  return (
    <>
      <p className="sr-only">{describe(entries)}</p>
      <div className="heat-strip">
        {entries.map((entry) => {
          const burden = entry?.night?.symptomBurden;
          if (!Number.isFinite(burden)) {
            return <div key={entry.nightOf} className="heat-strip__cell heat-strip__cell--empty" />;
          }

          const description = `${formatShortDate(entry.nightOf)}: ${burden} of ${MAX_SYMPTOM_BURDEN}`;
          return (
            <Link
              key={entry.nightOf}
              to={`/history/${entry.nightOf}`}
              className="heat-strip__cell heat-strip__cell--link"
              style={{
                height: `${Math.max(8, (burden / MAX_SYMPTOM_BURDEN) * 100)}%`,
                background: severityToken(burden),
              }}
              aria-label={description}
              title={description}
            />
          );
        })}
      </div>
    </>
  );
}

function describe(entries) {
  const logged = entries.filter((e) => Number.isFinite(e?.night?.symptomBurden));
  if (logged.length === 0) return 'Symptom burden chart - no entries yet.';
  const first = logged[0].night.symptomBurden;
  const last = logged[logged.length - 1].night.symptomBurden;
  const direction = last < first ? 'lower than' : last > first ? 'higher than' : 'about the same as';
  return `Symptom burden over ${entries.length} days. Most recent is ${last} of ${MAX_SYMPTOM_BURDEN}, ${direction} the start of this period. ${entries.length - logged.length} days not logged.`;
}
