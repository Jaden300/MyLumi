/* The selected regions, and the way to select one without the 3D model.

   This list is not a fallback bolted on afterwards - it is the primary record
   of what the user has marked, and the 3D body is a faster way to reach it. It
   stays visible below the canvas for three reasons:

     - The body model is one skinned mesh with no keyboard interaction and no
       accessible names, so without this list a keyboard or screen reader user
       could not record pain at all.
     - It is what renders when the model fails to load, on a device with no
       WebGL, or on a connection that never finishes fetching it.
     - Reading back what you just marked, in words, is how you catch marking the
       wrong side - which is easy to do on a model you have rotated. */

import { useState } from 'react';
import { PainScale } from '../inputs/PainScale.jsx';
import { PAIN_REGIONS, PAIN_REGION_GROUPS, formatRegionLabel } from '../../lib/painRegions.js';

function RegionPicker({ selectedIds, onPick }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="btn btn--ghost btn--block" onClick={() => setOpen(true)}>
        Choose an area from a list
      </button>
    );
  }

  return (
    <div className="region-picker">
      <div className="row row--between">
        <span className="field__label">Choose an area</span>
        <button type="button" className="pain-scale__remove" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {PAIN_REGION_GROUPS.map((group) => (
        <fieldset key={group} className="region-picker__group">
          <legend className="region-picker__legend">{group}</legend>
          <div className="region-picker__options">
            {PAIN_REGIONS.filter((region) => region.group === group).map((region) => (
              <button
                key={region.id}
                type="button"
                className="region-picker__option"
                aria-pressed={selectedIds.includes(region.id)}
                onClick={() => onPick(region.id)}
              >
                {region.label}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export function PainRegionList({ selectedIds, scores, onPick, onRate, onRemove }) {
  return (
    <div className="stack">
      {selectedIds.length === 0 ? (
        <p className="text-muted text-sm">No areas marked yet.</p>
      ) : (
        <div className="stack">
          {selectedIds.map((id) => (
            <PainScale
              key={id}
              label={formatRegionLabel(id)}
              value={scores[id]}
              onChange={(value) => onRate(id, value)}
              onRemove={() => onRemove(id)}
            />
          ))}
        </div>
      )}

      <RegionPicker selectedIds={selectedIds} onPick={onPick} />
    </div>
  );
}
