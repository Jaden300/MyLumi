import { useState } from 'react';
import { useLumiData } from '../hooks/useLumiData.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Banner } from '../components/ui/Banner.jsx';
import { Toggle } from '../components/ui/Toggle.jsx';
import { useJournalConsent } from '../hooks/useJournalConsent.js';
import { isConfigured } from '../lib/api.js';
import { toLocalISODate, formatShortDate } from '../lib/dates.js';

export function YourData() {
  const { data, exportJSON, deleteAll, loadDemo, storageAvailable, isDemoData } = useLumiData();
  const { consented, grantedAt, setConsent } = useJournalConsent();
  const [confirming, setConfirming] = useState(false);
  const [confirmingDemo, setConfirmingDemo] = useState(false);
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
            your journal - plus the date of your injury.
          </p>
        </div>
      </Card>

      <Card title="Where it's stored">
        <div className="stack stack--tight text-sm text-muted">
          <p>
            <strong style={{ color: 'var(--text)' }}>On this device, in this browser.</strong> There's
            no account and no server copy. If you clear your browser data, your entries go with it -
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

      {/* The canonical control. The insights page can turn this ON, but this is
          where it can always be found again to turn OFF - a consent switch the
          user cannot locate later is not a revocable one. */}
      <Card title="Journal analysis">
        <div className="stack text-sm">
          <p className="text-muted">
            Everything above stays on this device. This is the one exception, and it's off unless
            you turn it on.
          </p>
          <p className="text-muted">
            If you turn this on, the text you wrote in your journal is sent to MyLumi's model
            service to be scored for sentiment - whether your entries read as more positive or more
            negative over time. It's scored in memory and thrown away with the request: never
            stored, never logged, never used to train anything.
          </p>
          <p className="text-muted">
            Your symptom scores and sleep data are already sent for the other insights. Your journal
            text is not, unless you turn this on.
          </p>

          <Toggle
            label="Send my journal text for sentiment analysis"
            hint={
              isConfigured()
                ? 'Off by default. You can turn this off at any time.'
                : 'This build has no model service configured, so nothing can be sent either way.'
            }
            checked={consented}
            onChange={setConsent}
          />

          {consented && (
            <p className="text-muted text-xs">
              On since {grantedAt ? formatShortDate(grantedAt.slice(0, 10)) : 'recently'}. Turning
              it off stops any further sending and clears the results from this device. Nothing was
              kept on the server to delete.
            </p>
          )}
        </div>
      </Card>

      <Card title="Export">
        <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-4)' }}>
          Download everything as a JSON file - the same structure MyLumi stores, nothing removed.
        </p>
        <Button variant="secondary" onClick={handleExport} disabled={entryCount === 0}>
          Export my data
        </Button>
      </Card>

      {/* Loading demo data REPLACES the record, so it is guarded the same way
          deletion is. Someone with real entries must never lose them to a
          mis-tapped demo button. */}
      <Card title="Demo data">
        <div className="stack text-sm">
          {isDemoData ? (
            <>
              <p className="text-muted">
                You're currently looking at generated demo data - {entryCount} nights built to show
                what MyLumi looks like after a few weeks of use. None of it is real.
              </p>
              <div>
                <Button variant="secondary" onClick={deleteAll}>
                  Clear demo data
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted">
                Load a few weeks of generated check-ins to see the insights, trajectory chart and
                history with data in them. Useful for a demo or a look around.
              </p>
              {entryCount > 0 && !confirmingDemo ? (
                <>
                  <Banner tone="caution" title="This would replace your entries">
                    You have {entryCount} real {entryCount === 1 ? 'night' : 'nights'} recorded.
                    Loading demo data erases them. Export first if you want to keep them.
                  </Banner>
                  <div>
                    <Button variant="secondary" onClick={() => setConfirmingDemo(true)}>
                      Load demo data anyway
                    </Button>
                  </div>
                </>
              ) : confirmingDemo ? (
                <div className="row">
                  <Button variant="secondary" onClick={() => setConfirmingDemo(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      loadDemo();
                      setConfirmingDemo(false);
                    }}
                  >
                    Replace my data with the demo
                  </Button>
                </div>
              ) : (
                <div>
                  <Button variant="secondary" onClick={loadDemo}>
                    Load demo data
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
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
