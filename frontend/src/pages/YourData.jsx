import { useState } from 'react';
import { useLumiData } from '../hooks/useLumiData.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Banner } from '../components/ui/Banner.jsx';
import { toLocalISODate } from '../lib/dates.js';

export function YourData() {
  const { data, exportJSON, deleteAll, storageAvailable } = useLumiData();
  const [confirming, setConfirming] = useState(false);
  const entryCount = Object.keys(data.entries).length;

  function handleExport() {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // No identifying information in the filename.
    link.download = `mylumi-export-${toLocalISODate(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="stack stack--loose">
      <header className="stack stack--tight">
        <h1>Your data</h1>
        <p className="text-muted text-sm">
          Everything MyLumi knows about you, and what you can do with it.
        </p>
      </header>

      <Card title="What's stored">
        <div className="stack stack--tight text-sm">
          <p>
            You have <strong>{entryCount}</strong> {entryCount === 1 ? 'night' : 'nights'} recorded.
          </p>
          <p className="text-muted">
            That's your symptom ratings, mood, sleep times and quality, and anything you wrote in
            your journal — plus the date of your injury.
          </p>
        </div>
      </Card>

      <Card title="Where it's stored">
        <div className="stack stack--tight text-sm text-muted">
          <p>
            <strong style={{ color: 'var(--text)' }}>On this device, in this browser.</strong> There's
            no account and no server copy. If you clear your browser data, your entries go with it —
            so export a copy if you want to keep them.
          </p>
          <p>
            MyLumi has no analytics, no trackers, and no advertising code. Nothing about your use of
            the app is sent anywhere.
          </p>
          {!storageAvailable && (
            <p style={{ color: 'var(--caution)' }}>
              Right now your browser isn't allowing storage, so this session won't be saved at all.
            </p>
          )}
        </div>
      </Card>

      <Card title="Export">
        <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-4)' }}>
          Download everything as a JSON file — the same structure MyLumi stores, nothing removed.
        </p>
        <Button variant="secondary" onClick={handleExport} disabled={entryCount === 0}>
          Export my data
        </Button>
      </Card>

      <Card title="Delete">
        <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-4)' }}>
          Permanently erase every entry, your injury date, and your streak from this browser. This
          cannot be undone.
        </p>

        {confirming ? (
          <div className="stack">
            <Banner tone="alert" title="Delete everything?" role="alert">
              This removes all {entryCount} {entryCount === 1 ? 'entry' : 'entries'} permanently.
              Consider exporting first.
            </Banner>
            <div className="row">
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  deleteAll();
                  setConfirming(false);
                }}
              >
                Yes, delete everything
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirming(true)}>
            Delete all my data
          </Button>
        )}
      </Card>
    </div>
  );
}
