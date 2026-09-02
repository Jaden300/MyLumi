import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckInRunner } from '../components/checkin/CheckInRunner.jsx';
import { createMorningFlow } from '../lib/flows/morningFlow.js';
import { useLumiData } from '../hooks/useLumiData.jsx';
import { AlreadyCheckedIn } from '../components/checkin/AlreadyCheckedIn.jsx';
import { DailyReport } from '../components/dashboard/DailyReport.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Lumi } from '../components/lumi/Lumi.jsx';

export function MorningCheckIn() {
  const { status, saveMorning, getEntry, getAllEntries } = useLumiData();
  const navigate = useNavigate();
  const flow = useMemo(() => createMorningFlow(saveMorning), [saveMorning]);
  /* The report is a moment, not a destination - so it renders here rather than
     living at a route, where it would need an empty state for a day that has no
     data to report on. `AlreadyCheckedIn` sets the same precedent. */
  const [reportFor, setReportFor] = useState(null);

  // The morning check-in always describes the PREVIOUS night's sleep episode.
  const nightOf = status.morningTargetNightOf;

  if (reportFor) {
    return (
      <DailyReport
        entry={getEntry(reportFor)}
        entries={getAllEntries()}
        onDone={() => navigate('/', { replace: true })}
      />
    );
  }

  if (status.morningDone) {
    return <AlreadyCheckedIn kind="morning" />;
  }

  /* Without a night check-in there is no sleep episode to report on - the
     bedtime half of sleep duration is missing, so a morning entry would be
     orphaned data. */
  if (!status.morningDue) {
    return (
      <Card>
        <div className="lumi-row">
          <Lumi size={56} state="waking" />
          <div className="stack stack--tight">
            <h1 className="h-size-h3">Nothing to log yet</h1>
            <p className="text-muted text-sm">
              The morning check-in follows a night check-in. Start with tonight's, and you can log how
              you slept in the morning.
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

  return (
    <CheckInRunner
      flow={flow}
      nightOf={nightOf}
      onComplete={() => setReportFor(nightOf)}
      onCancel={() => navigate('/')}
    />
  );
}
