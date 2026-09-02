import { RatingScale } from '../../inputs/RatingScale.jsx';
import { SYMPTOMS, SEVERITY_ANCHORS } from '../../../lib/constants.js';

const byKey = Object.fromEntries(SYMPTOMS.map((s) => [s.key, s]));

export function SymptomStep({ keys, values, setValue }) {
  return (
    <div className="stack stack--loose">
      <p className="text-muted text-sm">
        Rate each from 0 (none) to 6 (severe), based on how today has been overall.
      </p>
      {keys.map((key) => {
        const symptom = byKey[key];
        return (
          <RatingScale
            key={key}
            name={key}
            label={symptom.label}
            clinical={symptom.clinical}
            hint={symptom.hint}
            anchors={SEVERITY_ANCHORS}
            value={values.symptoms?.[key]}
            onChange={(value) => setValue(`symptoms.${key}`, value)}
          />
        );
      })}
    </div>
  );
}
