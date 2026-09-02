import { Link } from 'react-router-dom';

/* Persistent, on every screen. MyLumi must never present itself as a diagnostic
   tool — see MyLumi_Plan.md §4. */

export function DisclaimerFooter() {
  return (
    <footer className="disclaimer">
      <p>
        MyLumi is not a diagnostic tool and cannot tell you whether you have a concussion or when you
        will recover. Talk to a healthcare professional about your symptoms.
      </p>
      <p style={{ marginTop: 'var(--space-2)' }}>
        <Link to="/about">How this works &amp; limitations</Link>
        {' · '}
        <Link to="/data">Your data</Link>
      </p>
    </footer>
  );
}
