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
import { Lumi } from '../components/lumi/Lumi.jsx';

export function Insights() {
  const { isOnboarded } = useLumiData();

  if (!isOnboarded) return <Navigate to="/onboarding" replace />;

  return (
    <div className="stack stack--loose">
      <header className="page-head">
        <h1>Insights</h1>
        <div className="page-head__art hero__art">
          <Lumi size={84} state="presenting" />
        </div>
      </header>

      {/* The two full-measure pieces stay full width: a chart squeezed into a
          half-column loses the resolution that makes it worth showing. */}
      <WeeklySummaryCard />
      <TrajectoryChart />

      {/* The findings pack into columns. InsightsSection renders a fragment of
          sibling cards, so the grid wraps it rather than living inside it. */}
      <div className="grid grid--auto grid--loose">
        <InsightsSection variant="full" />
      </div>

      {/* Last: the secondary signal sits below the numbers it must never
          outrank. See SentimentCard. */}
      <JournalSection />
    </div>
  );
}
