import { useState } from 'react';
import { useLumiData } from '../../hooks/useLumiData.jsx';
import { Button } from '../ui/Button.jsx';
import { Banner } from '../ui/Banner.jsx';

/* Moved here from the old Your data page so a judge can seed the app from the
   first screen instead of hunting for it.

   Loading demo data REPLACES the record, so the confirmation gate came with it.
   Someone with real entries must never lose them to a mis-tapped demo button. */

export function DemoDataControl() {
  const { data, loadDemo, deleteAll, isDemoData } = useLumiData();
  const [confirming, setConfirming] = useState(false);
  const entryCount = Object.keys(data.entries).length;

  if (isDemoData) {
    return (
      <div className="demo-bar">
        <span className="text-sm text-muted">Demo data loaded - {entryCount} generated nights.</span>
        <Button variant="secondary" onClick={deleteAll}>
          Clear demo data
        </Button>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="stack">
        <Banner tone="caution" title="This would replace your entries">
          You have {entryCount} real {entryCount === 1 ? 'night' : 'nights'} recorded. Loading demo
          data erases them.
        </Banner>
        <div className="row">
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              loadDemo();
              setConfirming(false);
            }}
          >
            Replace my data with the demo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="demo-bar">
      <span className="text-sm text-muted">Want to see it with data in it?</span>
      {/* Wrapped rather than passed directly: loadDemo now forwards its first
          argument to the generator, and a bare handler reference would hand it
          a click event to destructure. */}
      <Button
        variant="secondary"
        onClick={entryCount > 0 ? () => setConfirming(true) : () => loadDemo()}
      >
        Load demo data
      </Button>
    </div>
  );
}
