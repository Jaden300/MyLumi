import { Card } from '../ui/Card.jsx';

export function StreakCard({ streak, nightDone, morningDue }) {
  const { current, longest } = streak;

  /* The streak counts completed sleep episodes up to LAST night - tonight can't
     be complete yet. Saying what extends it next is more motivating than a bare
     number, and it explains why tonight's check-in didn't move it. */
  let hint;
  if (current === 0) {
    hint = nightDone
      ? 'Log how you slept in the morning to start your streak.'
      : 'Complete both check-ins for a night to start your streak.';
  } else if (morningDue) {
    hint = `Finish your morning check-in to reach ${current + 1}.`;
  } else {
    hint = `Complete tonight and tomorrow morning to reach ${current + 1}.`;
  }

  return (
    <Card>
      <div className="streak">
        <span className="streak__count">{current}</span>
        <div className="stack stack--tight">
          <strong>{current === 1 ? 'night logged' : 'nights logged'} in a row</strong>
          <span className="text-muted text-sm">{hint}</span>
          {longest > current && (
            <span className="text-muted text-xs">Your best run so far is {longest}.</span>
          )}
        </div>
      </div>
    </Card>
  );
}
