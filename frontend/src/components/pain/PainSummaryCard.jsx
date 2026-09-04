/* Where a past night's pain was, on the entry detail page.

   Renders nothing at all when the night predates the pain step or the user was
   never asked. That absence is meaningful: a card reading "no pain recorded"
   would assert something about a night on which the question was never put. */

import { Card } from '../ui/Card.jsx';
import { formatRegionLabel, PAIN_MAX } from '../../lib/painRegions.js';
import { painSeverityToken } from '../../lib/severity.js';

/** Marked regions, worst first, unrated ones last. */
export function sortedPainRegions(regions) {
  return Object.entries(regions ?? {}).sort(([, a], [, b]) => {
    const aRated = Number.isFinite(a);
    const bRated = Number.isFinite(b);
    if (aRated && bRated) return b - a;
    if (aRated !== bRated) return aRated ? -1 : 1;
    return 0;
  });
}

export function PainSummaryCard({ pain }) {
  if (!pain?.answered) return null;

  const regions = sortedPainRegions(pain.regions);

  return (
    <Card title="Where it ached">
      {regions.length === 0 ? (
        <p className="text-muted text-sm">No aching areas reported.</p>
      ) : (
        regions.map(([id, score]) => (
          <div key={id} className="row row--between pain-row">
            <span className="row pain-row__name">
              <span
                className="pain-row__swatch"
                style={{ background: painSeverityToken(score) }}
                aria-hidden="true"
              />
              <span className="text-muted text-sm">{formatRegionLabel(id)}</span>
            </span>
            <strong className="text-sm">
              {Number.isFinite(score) ? `${score} / ${PAIN_MAX}` : 'Not rated'}
            </strong>
          </div>
        ))
      )}
    </Card>
  );
}
