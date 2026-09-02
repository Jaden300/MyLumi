/* Days that broke the user's own pattern.

   Tone is the whole design problem here. A statistical outlier in nine
   self-reported numbers is not a clinical event, and this card must not imply
   one - no alarm colour, no "setback", no urgency. It notes something and lets
   the user decide whether it means anything.

   Genuine red-flag escalation (worsening confusion, repeated vomiting) is a
   separate, rule-based, LOCAL feature in Phase 4. It must never depend on this
   card, or on the network. */

import { Card } from '../ui/Card.jsx';
import { formatNightLabel } from '../../lib/dates.js';

export function AnomalyCard({ anomaly }) {
  if (!anomaly?.available || !anomaly.anomalies?.length) return null;

  // Only surface heavier-than-usual days. A better-than-usual day flagged as
  // "unusual" reads as MyLumi doubting good news, which is a miserable thing to
  // do to someone in recovery.
  const notable = anomaly.anomalies.filter((a) => a.direction === 'worse');
  if (!notable.length) return null;

  return (
    <Card title="Worth noting">
      <div className="stack">
        <ul className="finding-list">
          {notable.map((point) => (
            <li key={point.nightOf} className="finding">
              <p className="finding__statement">{formatNightLabel(point.nightOf)}</p>
              <p className="text-sm">{point.note}</p>
            </li>
          ))}
        </ul>
        <p className="text-muted text-xs">
          Unusual compared with your own recent pattern. One heavier day is
          normal in recovery. If days like this keep repeating, or you feel
          worse overall, that's worth raising with a healthcare professional.
        </p>
      </div>
    </Card>
  );
}
