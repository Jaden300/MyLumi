import { TimePicker } from '../../ui/TimePicker.jsx';
import { SegmentedControl } from '../../ui/SegmentedControl.jsx';
import { AWAKENING_OPTIONS } from '../../../lib/constants.js';

export function WakeStep({ values, setValue }) {
  return (
    <div className="stack stack--loose">
      <TimePicker
        label="What time did you wake up?"
        value={values.wakeTime}
        onChange={(value) => setValue('wakeTime', value)}
      />
      <SegmentedControl
        name="awakenings"
        label="How many times did you wake during the night?"
        options={AWAKENING_OPTIONS}
        value={values.awakenings}
        onChange={(value) => setValue('awakenings', value)}
      />
    </div>
  );
}
