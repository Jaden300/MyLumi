import { Navigate, Link } from 'react-router-dom';
import { useLumiData } from '../hooks/useLumiData.jsx';
import { TodayCard } from '../components/dashboard/TodayCard.jsx';
import { StreakCard } from '../components/dashboard/StreakCard.jsx';
import { StreakRescuePrompt } from '../components/dashboard/StreakRescuePrompt.jsx';
import { MilestoneCard } from '../components/dashboard/MilestoneCard.jsx';
import { LastNightSummary } from '../components/dashboard/LastNightSummary.jsx';
import { SymptomHeatStrip } from '../components/history/SymptomHeatStrip.jsx';
import { InsightsSection } from '../components/insights/InsightsSection.jsx';
import { DemoDataControl } from '../components/dashboard/DemoDataControl.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Lumi } from '../components/lumi/Lumi.jsx';
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

  /* The mascot reflects where the user is in the day rather than smiling
     unconditionally: still owing a check-in reads as attentive, all done as
     pleased. See the tone rule in Lumi.jsx. */
  const heroState = status.nightDone && !status.morningDue ? 'celebrating' : 'idle';

  return (
    <div className="stack stack--loose">
      <header className="page-head">
        <div className="stack stack--tight">
          <h1>Today</h1>
          {daysSinceInjury != null && (
            <p className="day-count">
              Day <span className="day-count__n">{daysSinceInjury}</span> since your injury
            </p>
          )}
        </div>
        <div className="page-head__art hero__art">
          <Lumi size={84} state={heroState} />
        </div>
      </header>

      <TodayCard status={status} />

      {/* Above the streak card, below the day's action. It waits here until
          acknowledged, so a milestone earned on a morning check-in is not lost
          by closing the tab. */}
      <MilestoneCard />

      {streak.canRescue && (
        <StreakRescuePrompt
          nightOf={streak.rescuableNightOf}
          priorStreak={streak.current || 0}
          onRescue={redeemRescue}
        />
      )}

      {/* Streak and last night are both glanceable figures, so they pair across
          rather than stacking and pushing the chart below the fold. */}
      <div className="grid grid--2">
        <StreakCard streak={streak} nightDone={status.nightDone} morningDue={status.morningDue} />
        {lastLogged && <LastNightSummary entry={lastLogged} />}
      </div>

      {/* Compact: the number and its confidence, linking through for the
          reasoning. Moving the forecast off the home screen entirely would lose
          the app's most distinctive feature from first view. */}
      <InsightsSection variant="compact" />

      {hasAnyEntry && (
        <Card title={`Last ${TREND_DAYS} days`} variant={['feature', 'accent']}>
          <Lumi size={200} state="presenting" className="lumi-deco lumi-deco--br" />
          <SymptomHeatStrip entries={recent} />
          <div style={{ marginTop: 'var(--space-4)' }}>
            {/* Stays a Link so it keeps real anchor behaviour - middle-click,
                open in new tab, the status bar preview - while wearing the
                button styling the affordance deserves. */}
            <Link to="/history" className="btn btn--secondary">
              See all history
            </Link>
          </div>
        </Card>
      )}

      {!hasAnyEntry && (
        <Card variant="feature">
          <Lumi size={180} state="empty" className="lumi-deco lumi-deco--tr" />
          <div className="stack stack--tight">
            <h2 className="card__title">Your patterns start here</h2>
            <p className="text-muted">
              Log a few nights and this fills with your own trend.
            </p>
          </div>
        </Card>
      )}

      <DemoDataControl />
    </div>
  );
}

function shiftBack(iso, days) {
  let cursor = iso;
  for (let i = 0; i < days; i += 1) cursor = prevDay(cursor);
  return cursor;
}
