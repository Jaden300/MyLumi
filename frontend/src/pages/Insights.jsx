/* Everything MyLumi has worked out, in one place.

   The dashboard answers "what do I do right now". This page answers "what has
   been happening". Splitting them keeps the dashboard to one clear action, which
   matters for a user with cognitive fatigue.

   Note what works with no backend: the weekly summary and the trajectory chart
   are computed locally from the user's own entries, so this page still says
   something useful when the model service is asleep or was never deployed. */

import { Navigate } from 'react-router-dom';
import { useLumiData } from '../hooks/useLumiData.jsx';
import { InsightsSection } from '../components/insights/InsightsSection.jsx';
import { WeeklySummaryCard } from '../components/insights/WeeklySummaryCard.jsx';
import { TrajectoryChart } from '../components/insights/TrajectoryChart.jsx';
import { JournalSection } from '../components/insights/JournalSection.jsx';

export function Insights() {
  const { isOnboarded } = useLumiData();

  if (!isOnboarded) return <Navigate to="/onboarding" replace />;

  return (
    <div className="stack stack--loose">
      <header className="stack stack--tight">
        <h1>Insights</h1>
        <p className="text-muted text-sm">
          Patterns from your own check-ins. Nothing here is a diagnosis.
        </p>
      </header>

      <WeeklySummaryCard />
      <TrajectoryChart />
      <InsightsSection variant="full" />

      {/* Last: the secondary signal sits below the numbers it must never
          outrank. See SentimentCard. */}
      <JournalSection />
    </div>
  );
}
