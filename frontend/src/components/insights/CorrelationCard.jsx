/* Personal sleep-symptom patterns - the headline feature.

   Two things this card must never do:
   - imply causation. The statements come from the server already phrased as
     association ("on days following"), and there is a backend test asserting the
     causal vocabulary never appears. Nothing here re-words them.
   - hide its sample size. `n` is shown next to every finding, because "based on
     11 nights" is what lets a reader judge the claim for themselves. */

import { Card } from '../ui/Card.jsx';
import { Lumi } from '../lumi/Lumi.jsx';
import { ConfidenceBadge } from './ConfidenceBadge.jsx';

export function CorrelationCard({ correlation }) {
  if (!correlation?.available || !correlation.findings?.length) return null;

  return (
    <Card title="Your patterns" variant="feature">
      <Lumi size={170} state="presenting" className="lumi-deco lumi-deco--tl" />
      <div className="stack">
        <div className="row row--between" style={{ alignItems: 'flex-start' }}>
          <span className="stat__label">Found in your own check-ins</span>
          <ConfidenceBadge confidence={correlation.confidence} nDays={correlation.nDays} />
        </div>

        <ul className="finding-list">
          {correlation.findings.map((finding) => (
            <li key={finding.feature} className="finding">
              <p className="finding__statement">{finding.statement}</p>
              {finding.thresholdStatement && (
                <p className="finding__threshold">{finding.thresholdStatement}</p>
              )}
              <p className="text-muted text-xs finding__stats">
                Based on {finding.n} nights · strength {Math.abs(finding.rho).toFixed(2)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
