/* Milestone celebration, on the dashboard.

   It lives here rather than only in DailyReport because DailyReport renders
   exactly once, immediately after a morning check-in - close the tab and the
   milestone is gone forever. On the dashboard it waits until it is seen and
   dismissed.

   ## No confetti

   The obvious celebration for a milestone is a burst of animated colour. This
   app is built for people with photophobia and cognitive fatigue, and the design
   system permits "one gentle scale/fade" and forbids flashing. A celebration
   that hurts to look at is not a celebration. So: one soft entrance, one warm
   gradient border, Lumi celebrating, and nothing that moves after it arrives.

   The whole thing is suppressed under prefers-reduced-motion by the global rule
   in base.css, and the card still reads correctly without the animation. */

import { Card } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { Lumi } from '../lumi/Lumi.jsx';
import { useMilestone } from '../../hooks/useMilestone.js';

export function MilestoneCard() {
  const { milestone, acknowledge } = useMilestone();
  if (!milestone) return null;

  return (
    <Card className="milestone" role="status">
      <div className="stack">
        <div className="lumi-row">
          <Lumi size={48} state="proud" />
          <div className="stack stack--tight">
            <strong className="milestone__title">{milestone.title}</strong>
            <p className="text-muted text-sm">{milestone.body}</p>
          </div>
        </div>
        <div>
          <Button variant="secondary" onClick={acknowledge}>
            Thanks
          </Button>
        </div>
      </div>
    </Card>
  );
}
