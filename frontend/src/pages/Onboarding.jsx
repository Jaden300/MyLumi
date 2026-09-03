import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { DatePicker } from '../components/ui/DatePicker.jsx';
import { Lumi } from '../components/lumi/Lumi.jsx';
import { useLumiData } from '../hooks/useLumiData.jsx';
import { toLocalISODate, isValidISODate, daysBetween } from '../lib/dates.js';

export function Onboarding() {
  const { updateProfile } = useLumiData();
  const navigate = useNavigate();
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
      <header className="hero">
        <div className="hero__art">
          <Lumi size={128} state="waving" title="Lumi, your recovery guide" />
        </div>
        <h1 className="hero__title">Hi, I'm Lumi</h1>
        <p className="hero__lede">
          I'll help you track how you're recovering - twice a day, about two minutes each time.
        </p>
      </header>

      <Card variant={['feature', 'accent']}>
        <Lumi size={190} state="thinking" className="lumi-deco lumi-deco--br" />
        <div className="stack stack--tight">
          <DatePicker
            label="When did your concussion happen?"
            hint="An approximate date is fine."
            max={today}
            value={injuryDate}
            invalid={Boolean(error)}
            onChange={(next) => {
              setInjuryDate(next);
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

      <div className="grid grid--2">
        <Card variant="feature">
          <Lumi size={150} state="resting" className="lumi-deco lumi-deco--br" />
          <div className="stack stack--tight">
            <h2 className="card__title">Stays on this device</h2>
            <p className="text-muted text-sm">
              No account, and nothing is uploaded for you to use MyLumi.
            </p>
          </div>
        </Card>
        <Card variant="feature">
          <Lumi size={150} state="attentive" className="lumi-deco lumi-deco--br" />
          <div className="stack stack--tight">
            <h2 className="card__title">See a professional</h2>
            <p className="text-muted text-sm">
              Talk to someone about your symptoms, especially if they're getting worse.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
