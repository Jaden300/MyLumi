import { useState } from 'react';
import { Card } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { Lumi } from '../lumi/Lumi.jsx';
import { formatShortDate } from '../../lib/dates.js';

/* Offered only for last night, once a month. Recovery involves genuinely bad
   days; resetting someone's streak for one of them is both unkind and bad
   retention design. The rescue records nothing as data - the night stays
   honestly empty in history. */

export function StreakRescuePrompt({ nightOf, priorStreak, onRescue }) {
  const [used, setUsed] = useState(false);

  if (used) {
    return (
      <Card>
        <div className="lumi-row">
          <Lumi size={44} state="cheering" />
          <div className="stack stack--tight">
            <strong>Streak saved</strong>
            <span className="text-muted text-sm">
              {formatShortDate(nightOf)} stays blank in your history - only your streak was kept.
            </span>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="lumi-row" style={{ marginBottom: 'var(--space-4)' }}>
        <Lumi size={44} state="concerned" />
        <div className="stack stack--tight">
          <strong>You missed {formatShortDate(nightOf)}</strong>
          <span className="text-muted text-sm">
            That would end your {priorStreak}-night run. You have one streak rescue this month - bad
            days happen, and they shouldn't undo your progress.
          </span>
        </div>
      </div>
      <Button block variant="secondary" onClick={() => { onRescue(nightOf); setUsed(true); }}>
        Use my streak rescue
      </Button>
      <p className="text-muted text-xs text-center" style={{ marginTop: 'var(--space-3)' }}>
        This keeps your streak only. No symptom data is added for that night.
      </p>
    </Card>
  );
}
