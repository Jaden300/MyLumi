import { RatingScale } from '../../inputs/RatingScale.jsx';
import { TextArea } from '../../ui/TextArea.jsx';
import {
  MORNING_MOOD_ANCHORS,
  ENERGY_ANCHORS,
  READINESS_ANCHORS,
} from '../../../lib/constants.js';

export function MorningStateStep({ values, setValue }) {
  return (
    <div className="stack stack--loose">
      <RatingScale
        name="moodMorning"
        label="How is your mood this morning?"
        anchors={MORNING_MOOD_ANCHORS}
        value={values.moodMorning}
        onChange={(value) => setValue('moodMorning', value)}
      />
      <RatingScale
        name="energy"
        label="How is your energy?"
        anchors={ENERGY_ANCHORS}
        value={values.energy}
        onChange={(value) => setValue('energy', value)}
      />
      <RatingScale
        name="readiness"
        label="How ready do you feel for the day?"
        anchors={READINESS_ANCHORS}
        value={values.readiness}
        onChange={(value) => setValue('readiness', value)}
      />
      <TextArea
        label="How do you feel waking up?"
        optional
        placeholder="Optional."
        value={values.journal?.wakeFeeling}
        onChange={(value) => setValue('journal.wakeFeeling', value)}
      />
    </div>
  );
}
