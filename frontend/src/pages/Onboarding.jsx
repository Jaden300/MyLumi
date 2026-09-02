import { useState, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Lumi } from '../components/lumi/Lumi.jsx';
import { useLumiData } from '../hooks/useLumiData.jsx';
import { toLocalISODate, isValidISODate, daysBetween } from '../lib/dates.js';

export function Onboarding() {
  const { updateProfile } = useLumiData();
  const navigate = useNavigate();
  const dateId = useId();
  const today = toLocalISODate(new Date());
  const [injuryDate, setInjuryDate] = useState('');
  const [error, setError] = useState(null);

  function handleStart() {
    if (!isValidISODate(injuryDate)) {
      setError('Please enter the date of your injury.');
      return;
    }
    if (daysBetween(injuryDate, today) < 0) {
      setError("That date is in the future - please check it.");
      return;
    }
    updateProfile({ injuryDate });
    navigate('/', { replace: true });
  }

  return (
    <div className="stack stack--loose">
      <div className="text-center stack">
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Lumi size={96} state="waving" title="Lumi, your recovery guide" />
        </div>
        <h1>Hi, I'm Lumi</h1>
        <p className="text-muted">
          I'll help you track how you're recovering - twice a day, about two minutes each time.
        </p>
      </div>

      <Card>
        <div className="field">
          <label className="field__label" htmlFor={dateId}>
            When did your concussion happen?
          </label>
          <span className="field__hint">
            An approximate date is fine. This helps put your symptoms in context against typical
            recovery patterns.
          </span>
          <input
            id={dateId}
            type="date"
            className="date-input"
            max={today}
            value={injuryDate}
            onChange={(event) => {
              setInjuryDate(event.target.value);
              setError(null);
            }}
          />
          {error && (
            <span className="text-sm" style={{ color: 'var(--alert)' }} role="alert">
              {error}
            </span>
          )}
        </div>

        <div style={{ marginTop: 'var(--space-5)' }}>
          <Button block onClick={handleStart}>
            Get started
          </Button>
        </div>
      </Card>

      <Card title="Before you start">
        <ul className="stack stack--tight text-sm text-muted" style={{ paddingLeft: '1.1rem' }}>
          <li>
            <strong style={{ color: 'var(--text)' }}>Your data stays on this device.</strong> There's
            no account, and nothing is uploaded for you to use MyLumi.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>MyLumi is not a diagnostic tool.</strong> It can
            show you patterns, but it can't diagnose you or tell you when you'll recover.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>See a healthcare professional</strong> about your
            symptoms - especially if they're getting worse.
          </li>
        </ul>
      </Card>
    </div>
  );
}
