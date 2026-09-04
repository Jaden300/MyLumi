import { useNavigate } from 'react-router-dom';
import { formatShortDate, formatDuration } from '../../lib/dates.js';
import { deriveSleepDuration } from '../../lib/derive.js';
import { MAX_SYMPTOM_BURDEN } from '../../lib/constants.js';

/* Three honest states: fully logged, partially logged, and not logged. A
   rescued night shows as rescued rather than as data - the streak never
   pretends a night was recorded. */

export function HistoryDayRow({ entry, rescued }) {
  const navigate = useNavigate();
  const hasNight = Boolean(entry.night);
  const hasMorning = Boolean(entry.morning);
  const burden = entry.night?.symptomBurden;
  const duration = deriveSleepDuration(entry);
  const painAreas = Object.keys(entry.night?.pain?.regions ?? {}).length;

  if (!hasNight && !hasMorning) {
    return (
      <div className="history-row history-row--empty">
        <span className="history-row__date text-muted">{formatShortDate(entry.nightOf)}</span>
        <div className="history-row__body">
          {rescued ? (
            <>
              <span className="badge badge--rescued">Streak rescued</span>
              <div className="history-row__meta">No data logged for this night.</div>
            </>
          ) : (
            <span className="history-row__meta">Not logged</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="history-row"
      onClick={() => navigate(`/history/${entry.nightOf}`)}
    >
      <span className="history-row__date">{formatShortDate(entry.nightOf)}</span>
      <div className="history-row__body">
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          {Number.isFinite(burden) ? (
            <strong>
              {burden}
              <span className="text-muted text-xs"> / {MAX_SYMPTOM_BURDEN}</span>
            </strong>
          ) : (
            <span className="text-muted text-sm">No symptoms logged</span>
          )}
          {/* Count only. The burden number above is this row's headline, and a
              second figure beside it competes with it rather than adding to it -
              the detail page is where the per-area ratings live. */}
          {painAreas > 0 && (
            <span className="badge">
              {painAreas} {painAreas === 1 ? 'area' : 'areas'}
            </span>
          )}
          {!hasMorning && <span className="badge badge--partial">Night only</span>}
        </div>
        <div className="history-row__meta">
          {duration ? `Slept ${formatDuration(duration)}` : 'Sleep not recorded'}
        </div>
      </div>
    </button>
  );
}
