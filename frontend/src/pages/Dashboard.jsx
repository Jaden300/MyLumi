import { Navigate, Link } from 'react-router-dom';
import { useLumiData } from '../hooks/useLumiData.jsx';
import { TodayCard } from '../components/dashboard/TodayCard.jsx';
import { StreakCard } from '../components/dashboard/StreakCard.jsx';
import { StreakRescuePrompt } from '../components/dashboard/StreakRescuePrompt.jsx';
import { LastNightSummary } from '../components/dashboard/LastNightSummary.jsx';
import { SymptomHeatStrip } from '../components/history/SymptomHeatStrip.jsx';
import { Card } from '../components/ui/Card.jsx';
import { prevDay, toLocalISODate } from '../lib/dates.js';

const TREND_DAYS = 14;

export function Dashboard() {
  const { isOnboarded, status, streak, daysSinceInjury, getEntryRange, redeemRescue } =
    useLumiData();

  if (!isOnboarded) return <Navigate to="/onboarding" replace />;

  const today = toLocalISODate(new Date());
  const recent = getEntryRange(shiftBack(today, TREND_DAYS - 1), today);
  const hasAnyEntry = recent.some((e) => e.night);

  // Show the most recent night that actually has data.
  const lastLogged = [...recent].reverse().find((e) => e.night) ?? null;

  return (
    <div className="stack stack--loose">
      <header className="stack stack--tight">
        <h1>Today</h1>
        {daysSinceInjury != null && (
          <p className="text-muted text-sm">
            Day {daysSinceInjury} since your injury
          </p>
        )}
      </header>

      <TodayCard status={status} />

      {streak.canRescue && (
        <StreakRescuePrompt
          nightOf={streak.rescuableNightOf}
          priorStreak={streak.current || 0}
          onRescue={redeemRescue}
        />
      )}

      <StreakCard streak={streak} nightDone={status.nightDone} morningDue={status.morningDue} />

      {lastLogged && <LastNightSummary entry={lastLogged} />}

      {hasAnyEntry && (
        <Card title={`Last ${TREND_DAYS} days`}>
          <SymptomHeatStrip entries={recent} />
          <p className="text-muted text-xs" style={{ marginTop: 'var(--space-3)' }}>
            Symptom burden per night. Taller and warmer means a heavier day. Flat marks are nights
            without an entry.{' '}
            <Link to="/history">See all history</Link>
          </p>
        </Card>
      )}

      {!hasAnyEntry && (
        <Card>
          <p className="text-muted text-sm">
            Once you've logged a few nights, your patterns will start showing up here.
          </p>
        </Card>
      )}
    </div>
  );
}

function shiftBack(iso, days) {
  let cursor = iso;
  for (let i = 0; i < days; i += 1) cursor = prevDay(cursor);
  return cursor;
}
