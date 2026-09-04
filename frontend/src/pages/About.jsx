import { Card } from '../components/ui/Card.jsx';
import { Lumi } from '../components/lumi/Lumi.jsx';
import { SubjectCard } from '../components/about/SubjectCard.jsx';

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

      {/* What the app is about, before what it cannot do. The honesty cards
          below then read as this page qualifying its own claims, which is the
          order that makes both halves credible.

          Three of the five subjects, not all of them: `physical` lives on the
          pain page and `ml` on insights, each beside the thing it describes.
          Repeating them here would have shown a reader the identical card twice
          in one sitting. The last card spans, so three cards in a two-column
          grid resolve as a pair plus a full-width row rather than leaving an
          orphan. */}
      <div className="grid grid--2 grid--loose grid--even">
        <SubjectCard subject="mental" />
        <SubjectCard subject="concussion" />
        <SubjectCard subject="ai" className="grid__span" />
      </div>

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
        <div className="limit-grid">
          <div className="limit">
            <h3 className="limit__head">It is all self-reported</h3>
            <p className="limit__body">
              How you rate a symptom depends on your mood, memory, and what you compare it against.
            </p>
          </div>
          <div className="limit">
            <h3 className="limit__head">A pattern is not a cause</h3>
            <p className="limit__body">
              If poor sleep and bad days occur together, MyLumi cannot tell you which drove which.
            </p>
          </div>
          <div className="limit">
            <h3 className="limit__head">It is only your data</h3>
            <p className="limit__body">
              Findings come from your entries alone, not a population study. Estimates are estimates,
              not medical predictions.
            </p>
          </div>
          <div className="limit">
            <h3 className="limit__head">It waits before speaking</h3>
            <p className="limit__body">
              Under a week of entries it says nothing at all rather than guessing.
            </p>
          </div>
          <div className="limit">
            <h3 className="limit__head">It cannot see the rest</h3>
            <p className="limit__body">
              Medication, other injuries, and everything else in your life are invisible to it.
            </p>
          </div>
          {/* The pain page can show a projection, so the two things a reader
              could over-read there are named here with the other caveats,
              rather than repeated under the charts. */}
          <div className="limit">
            <h3 className="limit__head">It will not say how long</h3>
            <p className="limit__body">
              MyLumi does not know how long an area should hurt for, and it will not estimate a
              date when yours will stop. It shows which way things have been going, and nothing
              beyond that.
            </p>
          </div>
          <div className="limit">
            <h3 className="limit__head">A pain trend is a trend in what you marked</h3>
            <p className="limit__body">
              People mark what stands out. An area you stop marking has stopped being reported,
              which is not the same as having stopped hurting, and MyLumi cannot tell those apart.
            </p>
          </div>
          <div className="limit">
            <h3 className="limit__head">It stays on your device</h3>
            <p className="limit__body">
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
