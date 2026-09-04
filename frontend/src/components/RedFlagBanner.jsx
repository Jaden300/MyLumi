/* The one place a red-flag finding is shown.

   Copy rules, which matter more here than anywhere else in the app:

   - Never "you may have", "this indicates", "warning", "danger", "relapse",
     "setback". None of those are things this app is in a position to say.
   - Name the observed data, not a conclusion: "your headache ratings have been
     high", never "your headache is worsening".
   - State the app's blindness IN the banner. A user who reads this must not come
     away thinking MyLumi is watching for emergencies, because it cannot.
   - The action is always "talk to someone", never "go to the ER". The app has no
     basis to triage anyone.

   `severity: 'prompt'` means raise it promptly. It does NOT mean emergency, and
   the copy must never drift in that direction. */

import { Link } from 'react-router-dom';
import { Banner } from './ui/Banner.jsx';
import { Button } from './ui/Button.jsx';
import { useRedFlags } from '../hooks/useRedFlags.js';

export function RedFlagBanner() {
  const { finding, othersCount, dismiss } = useRedFlags();
  if (!finding) return null;

  const isPrompt = finding.severity === 'prompt';

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <Banner
        tone={isPrompt ? 'alert' : 'caution'}
        role={isPrompt ? 'alert' : 'status'}
        title={finding.title}
        action={
          <Button variant="ghost" onClick={dismiss} aria-label="Dismiss this notice">
            Dismiss
          </Button>
        }
      >
        <div className="stack stack--tight">
          <p className="text-sm">{finding.detail}</p>
          {/* caption-ok: safety copy. The app stating its own blindness is the
              point of this banner - a rule that never fires must never read as
              an all-clear - and it appears where it is relevant rather than
              being consolidated onto the About page. */}
          <p className="text-xs">
            MyLumi can't tell whether this is serious - it only sees what you type in.{' '}
            <Link to="/about#red-flags">What to watch for</Link>
          </p>
          {/* caption-ok: safety copy. Says how many other rules fired, which
              must not be silently dropped just because one banner shows. */}
          {othersCount > 0 && (
            <p className="text-xs">
              There{othersCount === 1 ? ' is' : ' are'} also {othersCount} other{' '}
              {othersCount === 1 ? 'thing' : 'things'} worth mentioning.{' '}
              <Link to="/insights">See your insights</Link>
            </p>
          )}
        </div>
      </Banner>
    </div>
  );
}
