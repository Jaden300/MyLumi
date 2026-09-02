import { useNavigate } from 'react-router-dom';
import { Card } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { Lumi } from '../lumi/Lumi.jsx';

/* One primary action, never two. If both check-ins are outstanding the
   secondary one is offered as a quiet link — asking a fatigued user to choose
   between two equally-weighted buttons is a decision they shouldn't have to
   make. */

const COPY = {
  morning: {
    title: 'How did you sleep?',
    body: 'A couple of quick questions about last night.',
    cta: 'Start morning check-in',
    to: '/checkin/morning',
    lumi: 'idle',
  },
  night: {
    title: 'How was today?',
    body: "Let's log your symptoms before bed. It takes about two minutes.",
    cta: 'Start night check-in',
    to: '/checkin/night',
    lumi: 'idle',
  },
  none: {
    title: "You're all caught up",
    body: 'Both check-ins are done. Come back tonight for the next one.',
    cta: null,
    lumi: 'celebrating',
  },
};

export function TodayCard({ status }) {
  const navigate = useNavigate();
  const copy = COPY[status.primary] ?? COPY.none;

  const secondary =
    status.primary === 'morning' && status.nightDue
      ? { label: 'Or do tonight’s check-in', to: '/checkin/night' }
      : status.primary === 'night' && status.morningDue
        ? { label: 'Or log how you slept last night', to: '/checkin/morning' }
        : null;

  return (
    <Card>
      <div className="lumi-row" style={{ marginBottom: 'var(--space-5)' }}>
        <Lumi size={64} state={copy.lumi} />
        <div className="stack stack--tight">
          <h2 style={{ fontSize: 'var(--fs-h3)' }}>{copy.title}</h2>
          <p className="text-muted text-sm">{copy.body}</p>
        </div>
      </div>

      {copy.cta && (
        <Button block onClick={() => navigate(copy.to)}>
          {copy.cta}
        </Button>
      )}

      {secondary && (
        <div style={{ marginTop: 'var(--space-3)', textAlign: 'center' }}>
          <Button variant="ghost" onClick={() => navigate(secondary.to)}>
            {secondary.label}
          </Button>
        </div>
      )}
    </Card>
  );
}
