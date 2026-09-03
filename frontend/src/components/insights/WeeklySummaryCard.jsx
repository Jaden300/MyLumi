/* The last seven days, described.

   Every line here is a fact about what was logged. None of it is a claim about
   cause: "your heaviest night was Tuesday" is fine, "Tuesday set you back" is
   not, and the difference is the entire reason the correlation engine downstream
   is Holm-corrected. The summary must not smuggle in through plain English what
   the statistics deliberately refuse to say.

   A rise in symptoms is reported without alarm and a fall without congratulation.
   Telling someone in recovery that their good week was notable sets them up to
   read the next ordinary week as a failure. */

import { Card } from '../ui/Card.jsx';
import { Stat } from '../ui/Stat.jsx';
import { Lumi } from '../lumi/Lumi.jsx';
import { useLumiData } from '../../hooks/useLumiData.jsx';
import { buildWeeklySummary, MIN_NIGHTS } from '../../lib/weekly.js';
import { formatShortDate, prevDay, toLocalISODate } from '../../lib/dates.js';
import { SYMPTOMS, MAX_SYMPTOM_BURDEN } from '../../lib/constants.js';

const labelFor = (key) => SYMPTOMS.find((s) => s.key === key)?.label ?? key;

const round = (value) => Math.round(value * 10) / 10;

export function WeeklySummaryCard() {
  const { getEntryRange } = useLumiData();

  const end = toLocalISODate(new Date());
  let start = end;
  for (let i = 0; i < 13; i += 1) start = prevDay(start); // two weeks, for the delta
  const summary = buildWeeklySummary(getEntryRange(start, end), { now: new Date() });

  if (!summary.available) {
    return (
      <Card title="This week">
        <p className="text-muted text-sm">
          You've logged {summary.nComplete} of the {MIN_NIGHTS} nights needed for a weekly summary.
          Keep going and this will fill in.
        </p>
      </Card>
    );
  }

  const { meanBurden, deltaVsPriorWeek, worstSymptom, bestNight, worstNight, bestSleep, worstSleep } =
    summary;

  return (
    <Card title="This week" variant="feature">
      <Lumi size={140} state="presenting" className="lumi-deco lumi-deco--br" />
      <div className="stack">
        <div className="row" style={{ gap: 'var(--space-6)', flexWrap: 'wrap' }}>
          <Stat
            label="Average symptom burden"
            value={`${round(meanBurden)}`}
            note={`of ${MAX_SYMPTOM_BURDEN}, across ${summary.nComplete} nights`}
          />
          {worstSymptom && (
            <Stat
              label="Most present symptom"
              value={labelFor(worstSymptom.key)}
              note={`averaged ${round(worstSymptom.meanValue)} of 6`}
            />
          )}
          {worstNight && (
            <Stat
              label="Heaviest night"
              value={formatShortDate(worstNight.nightOf)}
              note={`burden ${worstNight.value}`}
            />
          )}
          {bestNight && bestNight.nightOf !== worstNight?.nightOf && (
            <Stat
              label="Lightest night"
              value={formatShortDate(bestNight.nightOf)}
              note={`burden ${bestNight.value}`}
            />
          )}
          {bestSleep && (
            <Stat
              label="Best sleep"
              value={formatShortDate(bestSleep.nightOf)}
              note={`quality ${bestSleep.value} of 6`}
            />
          )}
          {worstSleep && worstSleep.nightOf !== bestSleep?.nightOf && (
            <Stat
              label="Worst sleep"
              value={formatShortDate(worstSleep.nightOf)}
              note={`quality ${worstSleep.value} of 6`}
            />
          )}
        </div>

        {deltaVsPriorWeek !== null && (
          <p className="text-sm">
            {describeDelta(deltaVsPriorWeek)}{' '}
            <span className="text-muted">compared with the week before.</span>
          </p>
        )}

        {deltaVsPriorWeek === null && (
          <p className="text-muted text-sm">
            Not enough entries in the week before this one to compare against.
          </p>
        )}
      </div>
    </Card>
  );
}

/** Plainly, and without praise or alarm. */
function describeDelta(delta) {
  const size = Math.abs(round(delta));
  if (size < 2) return 'Your average symptom burden was about the same';
  return delta > 0
    ? `Your average symptom burden was ${size} points higher`
    : `Your average symptom burden was ${size} points lower`;
}
