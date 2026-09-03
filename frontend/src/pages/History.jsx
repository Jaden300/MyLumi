import { Navigate } from 'react-router-dom';
import { useLumiData } from '../hooks/useLumiData.jsx';
import { HistoryDayRow } from '../components/history/HistoryDayRow.jsx';
import { SymptomHeatStrip } from '../components/history/SymptomHeatStrip.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Lumi } from '../components/lumi/Lumi.jsx';
import { currentNightOf } from '../lib/dates.js';

export function History() {
  const { isOnboarded, data, getEntryRange } = useLumiData();
  if (!isOnboarded) return <Navigate to="/onboarding" replace />;

  const end = currentNightOf(new Date(), data.profile.dayRolloverHour);
  const start = data.profile.injuryDate ?? end;

  /* A DENSE range, not Object.keys(entries) - a sparse map would silently close
     the gaps, and a missed night is information worth seeing. */
  const entries = getEntryRange(start, end);
  const newestFirst = [...entries].reverse();
  const rescuedNights = new Set((data.streak.rescueHistory ?? []).map((r) => r.nightOf));
  const loggedCount = entries.filter((e) => e.night).length;

  return (
    <div className="stack stack--loose">
      <header className="page-head">
        <div className="stack stack--tight">
          <h1>History</h1>
          {loggedCount > 0 && (
            <p className="text-muted text-sm">
              {loggedCount} of {entries.length} nights logged since your injury.
            </p>
          )}
        </div>
        {loggedCount > 0 && (
          <div className="page-head__art hero__art">
            <Lumi size={72} state="reading" />
          </div>
        )}
      </header>

      {loggedCount === 0 ? (
        <Card variant="feature">
          <Lumi size={200} state="empty" className="lumi-deco lumi-deco--tr" />
          <div className="stack stack--tight">
            <h2 className="card__title">Nothing logged yet</h2>
            <p className="text-muted">Your first check-in starts this record.</p>
          </div>
        </Card>
      ) : (
        <Card title="Symptom burden" variant={['feature', 'accent']}>
          <Lumi size={190} state="presenting" className="lumi-deco lumi-deco--br" />
          <SymptomHeatStrip entries={entries} />
        </Card>
      )}

      <Card variant="flush">
        {newestFirst.map((entry) => (
          <HistoryDayRow
            key={entry.nightOf}
            entry={entry}
            rescued={rescuedNights.has(entry.nightOf)}
          />
        ))}
      </Card>
    </div>
  );
}
