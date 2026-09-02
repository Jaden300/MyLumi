import { TextArea } from '../../ui/TextArea.jsx';

/* Both fields are optional. Requiring writing on a bad day is exactly when
   someone abandons the app - and a forced entry is poor data anyway. */

export function JournalStep({ values, setValue }) {
  return (
    <div className="stack stack--loose">
      <TextArea
        label="Describe your day."
        optional
        placeholder="Anything you want to remember about today."
        value={values.journal?.day}
        onChange={(value) => setValue('journal.day', value)}
      />
      <TextArea
        label="Anything that made your symptoms better or worse today?"
        optional
        hint="Screens, exercise, noise, rest, caffeine - whatever you noticed."
        placeholder="Optional."
        value={values.journal?.factors}
        onChange={(value) => setValue('journal.factors', value)}
      />
    </div>
  );
}
