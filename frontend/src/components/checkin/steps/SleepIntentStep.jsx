import { TimePicker } from '../../ui/TimePicker.jsx';
import { Toggle } from '../../ui/Toggle.jsx';
import { SegmentedControl } from '../../ui/SegmentedControl.jsx';
import { STRESS_ANCHORS } from '../../../lib/constants.js';

const STRESS_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }));

export function SleepIntentStep({ values, setValue }) {
  return (
    <div className="stack stack--loose">
      <TimePicker
        label="What time do you plan to go to sleep?"
        hint="An estimate is fine."
        value={values.sleep?.plannedBedtime}
        onChange={(value) => setValue('sleep.plannedBedtime', value)}
      />

      <div className="stack stack--tight">
        <SegmentedControl
          name="stress"
          label="How stressed do you feel right now?"
          options={STRESS_OPTIONS}
          value={values.sleep?.preSleepStress}
          onChange={(value) => setValue('sleep.preSleepStress', value)}
        />
        <div className="scale__anchors" aria-hidden="true">
          <span>{STRESS_ANCHORS.min}</span>
          <span>{STRESS_ANCHORS.max}</span>
        </div>
      </div>

      <Toggle
        label="Using a sleep aid tonight?"
        hint="Medication, melatonin, or anything else to help you sleep."
        checked={values.sleep?.sleepAidUsed === true}
        onChange={(value) => setValue('sleep.sleepAidUsed', value)}
      />
    </div>
  );
}
