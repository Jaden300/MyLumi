/* The pain map check-in step.

   Deliberately imports no three.js. It owns the pain state and knows about
   regions; the 3D body arrives through PainBodySurface, whose entire contract
   is "call onPickRegion with a region id". That seam is what lets this step be
   tested without WebGL, and what would let a different body picker replace the
   3D one without touching anything here.

   ## Why there is an explicit "nothing hurts" control

   Three states have to stay distinguishable in the record: the step never ran,
   the user was asked and reported nothing, and the user marked regions. Pressing
   Next with nothing selected cannot be read as the second of those, because it
   is also exactly what an accidental Next looks like. So saying "nothing hurts"
   is an action the user takes, and the step is not complete until they have
   either taken it or marked somewhere. */

import { PainBodySurface } from '../../pain/PainBodySurface.jsx';
import { PainRegionList } from '../../pain/PainRegionList.jsx';
import { PAIN_REGION_IDS, formatRegionLabel } from '../../../lib/painRegions.js';

/* A marked-but-unrated region needs a value that is neither a score nor
   "absent". `undefined` cannot be it - writing undefined through the setter is
   indistinguishable from never having written, so the region would not appear
   in the list. NaN cannot be it either: it survives the object but JSON turns
   it into null on a draft round trip, silently unmarking the region.

   So a marked region starts at null and the LIST of ids is what records the
   marking. Reading it back is `id in regions`, which is true for a null value
   and false for an absent key - and null is exactly what the sanitizer drops on
   save, so an unrated region correctly never reaches storage. */
export const MARKED_UNRATED = null;

/** Region ids currently marked, in the taxonomy's order rather than tap order. */
export function selectedRegionIds(regions) {
  if (!regions) return [];
  return PAIN_REGION_IDS.filter((id) => id in regions);
}

export function PainMapStep({ values, setValue }) {
  const regions = values.pain?.regions ?? {};
  const answered = values.pain?.answered === true;
  // Cheap enough to derive every render: at most 29 keys, and memoising it
  // would key off an object rebuilt on each change anyway.
  const selectedIds = selectedRegionIds(regions);
  const noneReported = answered && selectedIds.length === 0;

  /* Marking anywhere answers the question implicitly - you cannot point at your
     knee without having been asked where it hurts. */
  function pick(regionId) {
    if (!regionId) return;
    setValue('pain.answered', true);
    // Re-tapping a marked region leaves its rating alone rather than resetting
    // it, so a stray second tap cannot silently wipe a number.
    if (!(regionId in regions)) setValue(`pain.regions.${regionId}`, MARKED_UNRATED);
  }

  function rate(regionId, score) {
    setValue(`pain.regions.${regionId}`, score);
  }

  /* Removing has to drop the key, not null it - a null value still counts as
     marked, and the region would stay in the list. The setter cannot delete, so
     the map is rebuilt without it. */
  function remove(regionId) {
    const next = { ...regions };
    delete next[regionId];
    setValue('pain.regions', next);
  }

  function reportNone() {
    setValue('pain.answered', true);
    setValue('pain.regions', {});
  }

  return (
    <div className="stack stack--loose">
      <p className="text-muted text-sm">
        Tap anywhere on the body that aches, then rate it. Drag to turn the model, pinch or
        scroll to zoom.
      </p>

      <PainBodySurface onPickRegion={pick} />

      <PainRegionList
        selectedIds={selectedIds}
        scores={regions}
        onPick={pick}
        onRate={rate}
        onRemove={remove}
      />

      {selectedIds.length > 0 && (
        <p className="text-muted text-sm">
          Marked: {selectedIds.map(formatRegionLabel).join(', ')}.
        </p>
      )}

      {/* Secondary rather than ghost: this is a real answer to the question,
          not a way out of it, and a borderless control reads as a heading. */}
      <button
        type="button"
        className="btn btn--secondary btn--block"
        aria-pressed={noneReported}
        onClick={reportNone}
      >
        {noneReported ? 'Nothing hurt today - selected' : 'Nothing hurt today'}
      </button>
    </div>
  );
}
