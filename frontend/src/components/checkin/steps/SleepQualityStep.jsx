import { RatingScale } from '../../inputs/RatingScale.jsx';
import { Toggle } from '../../ui/Toggle.jsx';
import { SLEEP_QUALITY_ANCHORS } from '../../../lib/constants.js';

export function SleepQualityStep({ values, setValue }) {
  return (
    <div className="stack stack--loose">
      <RatingScale
        name="sleepQuality"
        label="How would you rate your sleep?"
        hint="How restful it felt, regardless of how long it was."
        anchors={SLEEP_QUALITY_ANCHORS}
        value={values.sleepQuality}
        onChange={(value) => setValue('sleepQuality', value)}
      />
      <Toggle
        label="Do you remember any dreams?"
        checked={values.dreamRecall === true}
        onChange={(value) => setValue('dreamRecall', value)}
      />
    </div>
  );
}
