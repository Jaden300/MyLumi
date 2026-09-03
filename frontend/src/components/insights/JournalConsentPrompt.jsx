/* The off state for journal analysis, and the only place it can be turned on
   from the insights page.

   Two decisions worth keeping:

   1. It explains what would be sent in the copy the user is looking at, not
      behind a link. A consent step that requires reading another page to
      understand is a consent step designed not to be read.

   2. There is no dismiss button. The card IS the off state - nothing is
      happening while it shows, so there is nothing to dismiss. A "no thanks"
      would need a second piece of stored state to remember a decision the
      consent flag already encodes, and it would hide the only affordance for
      changing your mind later. */

import { Card } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';

export function JournalConsentPrompt({ onGrant }) {
  return (
    <Card title="Journal tone">
      <div className="stack">
        <p className="text-sm">
          MyLumi can read what you write in your journal and track whether it reads as more
          positive or more negative over the weeks. It's a rough, secondary signal - it can't
          read sarcasm or context, and it never replaces the numbers above.
        </p>
        <p className="text-sm">
          This is the only part of MyLumi that would send what you wrote off this device. Your
          text would be scored and immediately discarded - never stored, never logged, never
          used to train anything. It's off unless you turn it on.
        </p>
        <div className="row" style={{ gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={onGrant}>
            Turn on journal analysis
          </Button>
        </div>
      </div>
    </Card>
  );
}
