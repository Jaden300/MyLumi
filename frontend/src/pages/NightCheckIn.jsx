import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckInRunner } from '../components/checkin/CheckInRunner.jsx';
import { createNightFlow } from '../lib/flows/nightFlow.js';
import { useLumiData } from '../hooks/useLumiData.jsx';
import { AlreadyCheckedIn } from '../components/checkin/AlreadyCheckedIn.jsx';

export function NightCheckIn() {
  const { status, saveNight } = useLumiData();
  const navigate = useNavigate();
  const flow = useMemo(() => createNightFlow(saveNight), [saveNight]);

  // Target is always derived, never taken from the URL — a date parameter would
  // be a backfill vector, and retrospective symptom recall is unreliable.
  const nightOf = status.nightOf;

  if (status.nightDone) {
    return <AlreadyCheckedIn kind="night" />;
  }

  return (
    <CheckInRunner
      flow={flow}
      nightOf={nightOf}
      onComplete={() => navigate('/', { replace: true })}
      onCancel={() => navigate('/')}
    />
  );
}
