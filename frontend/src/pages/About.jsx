import { Card } from '../components/ui/Card.jsx';
import { Lumi } from '../components/lumi/Lumi.jsx';

/* Limitations are stated plainly and in the product, not buried in a README.
   See MyLumi_Plan.md section 4.

   This page is now the single home for that honesty. The per-card caveats that
   used to repeat across the insights screens were consolidated here, so the
   commitment is kept in one findable place rather than as fine print nobody
   reads on every card. */

export function About() {
  return (
    <div className="stack stack--loose">
      <header className="hero">
        <div className="hero__art">
          <Lumi size={140} state="presenting" title="Lumi, your recovery guide" />
        </div>
        <h1 className="hero__title">A journal that notices things</h1>
        <p className="hero__lede">
          Twice a day you log how you slept and how you feel. MyLumi looks for the patterns
          between the two.
        </p>
      </header>

      <div className="grid grid--2 grid--loose">
        <Card variant="feature">
          <Lumi size={190} state="thinking" className="lumi-deco lumi-deco--br" />
          <div className="stack stack--tight">
            <h2 className="card__title">What it does</h2>
            <p className="text-muted">
              Sleep is one of the few things you can change during recovery, and the mental side of
              a concussion often goes untracked. MyLumi sits at that intersection.
            </p>
          </div>
        </Card>

        <Card variant="feature">
          <Lumi size={190} state="concerned" className="lumi-deco lumi-deco--br" />
          <div className="stack stack--tight">
            <h2 className="card__title">What it is not</h2>
            <p className="text-muted">
              Not a medical device, and never a diagnosis. It will not predict a recovery date -
              recovery varies enormously between people, and a confident date would mislead you.
            </p>
          </div>
        </Card>
      </div>

      <Card variant={['feature', 'accent']}>
        <Lumi size={240} state="reading" className="lumi-deco lumi-deco--tr" />
        <h2 className="card__title">What it can and cannot tell you</h2>
        <div className="grid grid--3" style={{ marginTop: 'var(--space-4)' }}>
          <div className="stack stack--tight">
            <h3 className="limit__head">It is all self-reported</h3>
            <p className="text-muted text-sm">
              How you rate a symptom depends on your mood, memory, and what you compare it against.
            </p>
          </div>
          <div className="stack stack--tight">
            <h3 className="limit__head">A pattern is not a cause</h3>
            <p className="text-muted text-sm">
              If poor sleep and bad days occur together, MyLumi cannot tell you which drove which.
            </p>
          </div>
          <div className="stack stack--tight">
            <h3 className="limit__head">It is only your data</h3>
            <p className="text-muted text-sm">
              Findings come from your entries alone, not a population study. Estimates are estimates,
              not medical predictions.
            </p>
          </div>
          <div className="stack stack--tight">
            <h3 className="limit__head">It waits before speaking</h3>
            <p className="text-muted text-sm">
              Under a week of entries it says nothing at all rather than guessing.
            </p>
          </div>
          <div className="stack stack--tight">
            <h3 className="limit__head">It cannot see the rest</h3>
            <p className="text-muted text-sm">
              Medication, other injuries, and everything else in your life are invisible to it.
            </p>
          </div>
          <div className="stack stack--tight">
            <h3 className="limit__head">It stays on your device</h3>
            <p className="text-muted text-sm">
              No account, no analytics, no trackers. Your journal text is only ever sent if you
              switch that on yourself.
            </p>
          </div>
        </div>
      </Card>

      {/* The anchor the red-flag banner links to. Someone arriving here from an
          alert is scanning, not reading, so the list is scannable - and it is
          always here regardless of whether any rule has fired. A rule that never
          fires must never read as an all-clear. */}
      <Card title="When to seek medical help" id="red-flags" variant="feature">
        <Lumi size={200} state="attentive" className="lumi-deco lumi-deco--br" />
        <div className="stack">
          <p className="text-muted">
            Talk to a healthcare professional about your recovery. Seek help promptly if you have
            any of these:
          </p>
          <ul className="red-flag-list">
            <li>A headache that keeps getting worse, or one that won't go away</li>
            <li>Repeated vomiting</li>
            <li>Seizures or convulsions</li>
            <li>Weakness, numbness, or loss of coordination</li>
            <li>Slurred speech, or trouble understanding people</li>
            <li>Unusual confusion, agitation, or drowsiness</li>
            <li>One pupil larger than the other</li>
            <li>Someone who can't be woken normally</li>
          </ul>
          <p>
            Don't wait for MyLumi to tell you something is wrong.{' '}
            <strong>It cannot detect an emergency.</strong> It only sees the numbers you type in
            twice a day. If something feels wrong, that's reason enough to get help.
          </p>
        </div>
      </Card>
    </div>
  );
}
