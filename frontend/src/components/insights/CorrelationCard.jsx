/* Personal sleep-symptom patterns - the headline feature.

   This card must never imply causation. The statements come from the server
   already phrased as association ("on days following"), and there is a backend
   test asserting the causal vocabulary never appears. Nothing here re-words
   them.

   Sample sizes and the correlation strength used to be printed under each
   finding. They are not any more - see docs/design-system.md, "No caption
   layer". The server still reports `n` and `rho`, and the refusal rules that
   decide whether a finding renders at all are unchanged; what went is the
   small print, not the statistics behind it. */

import { Card } from '../ui/Card.jsx';
import { Lumi } from '../lumi/Lumi.jsx';

export function CorrelationCard({ correlation }) {
  if (!correlation?.available || !correlation.findings?.length) return null;

  return (
    <Card title="Your patterns" variant="feature">
      <Lumi size={170} state="presenting" className="lumi-deco lumi-deco--tl" />
      <div className="stack">
        <span className="stat__label">Found in your own check-ins</span>

        <ul className="finding-list">
          {correlation.findings.map((finding) => (
            <li key={finding.feature} className="finding">
              <p className="finding__statement">{finding.statement}</p>
              {finding.thresholdStatement && (
                <p className="finding__threshold">{finding.thresholdStatement}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
