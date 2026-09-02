import { MoodScale } from '../../inputs/MoodScale.jsx';

export function MoodStep({ values, setValue }) {
  return (
    <div className="stack stack--loose">
      <MoodScale
        label="How has your mood been today?"
        hint="Think about the day as a whole, not just this moment."
        value={values.mood}
        onChange={(value) => setValue('mood', value)}
      />
    </div>
  );
}
