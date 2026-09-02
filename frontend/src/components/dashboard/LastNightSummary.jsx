import { Card } from '../ui/Card.jsx';
import { Stat } from '../ui/Stat.jsx';
import {
  deriveSleepDuration,
  worstSymptom,
  hasDstShift,
} from '../../lib/derive.js';
import { formatDuration, formatNightLabel } from '../../lib/dates.js';
import { SYMPTOMS, MAX_SYMPTOM_BURDEN } from '../../lib/constants.js';

const labelFor = (key) => SYMPTOMS.find((s) => s.key === key)?.label ?? key;

export function LastNightSummary({ entry }) {
  if (!entry?.night) return null;

  const burden = entry.night.symptomBurden;
  const duration = deriveSleepDuration(entry);
  const worst = worstSymptom(entry);

  return (
    <Card title={formatNightLabel(entry.nightOf)}>
      <div className="row" style={{ gap: 'var(--space-6)', flexWrap: 'wrap' }}>
        <Stat
          label="Symptom burden"
          value={Number.isFinite(burden) ? `${burden}` : '-'}
          note={Number.isFinite(burden) ? `of ${MAX_SYMPTOM_BURDEN}` : 'incomplete'}
        />
        <Stat
          label="Sleep"
          value={formatDuration(duration) ?? '-'}
          note={duration == null ? 'awaiting morning check-in' : null}
        />
        {worst && <Stat label="Most severe" value={labelFor(worst.key)} note={`rated ${worst.value} of 6`} />}
      </div>

      {/* Wall-clock sleep maths is an hour out across a daylight-saving change.
          Say so rather than quietly reporting a wrong duration. */}
      {duration != null && hasDstShift(entry) && (
        <p className="text-muted text-xs" style={{ marginTop: 'var(--space-4)' }}>
          The clocks changed this night, so this duration may be off by an hour.
        </p>
      )}
    </Card>
  );
}
