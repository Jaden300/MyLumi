import { useNavigate } from 'react-router-dom';
import { Card } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { Lumi } from '../lumi/Lumi.jsx';

/* Reached when a check-in already exists for the target night — including the
   case of a wrong device clock pointing at a night already logged. Saving
   refuses to overwrite silently, so this screen is the honest dead end. */

export function AlreadyCheckedIn({ kind }) {
  const navigate = useNavigate();
  const label = kind === 'morning' ? 'morning' : 'night';

  return (
    <Card>
      <div className="lumi-row">
        <Lumi size={56} state="encouraging" />
        <div className="stack stack--tight">
          <h1 style={{ fontSize: 'var(--fs-h3)' }}>That's done</h1>
          <p className="text-muted text-sm">
            You've already completed your {label} check-in. Entries can't be edited once saved —
            looking back and re-rating symptoms tends to be unreliable, so MyLumi keeps what you
            recorded at the time.
          </p>
        </div>
      </div>
      <div style={{ marginTop: 'var(--space-5)' }}>
        <Button block onClick={() => navigate('/')}>
          Back to today
        </Button>
      </div>
    </Card>
  );
}
