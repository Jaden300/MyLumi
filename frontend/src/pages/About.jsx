import { Card } from '../components/ui/Card.jsx';
import { Lumi } from '../components/lumi/Lumi.jsx';

/* Limitations are stated plainly and in the product, not buried in a README.
   See MyLumi_Plan.md §4. */

export function About() {
  return (
    <div className="stack stack--loose">
      <header className="stack stack--tight">
        <div className="lumi-row">
          <Lumi size={56} />
          <h1>How MyLumi works</h1>
        </div>
      </header>

      <Card title="What this is">
        <div className="stack stack--tight text-sm text-muted">
          <p>
            MyLumi is a journal for concussion recovery. Twice a day you record your symptoms, mood,
            and sleep. Over time it looks for patterns between how you sleep and how you feel.
          </p>
          <p>
            Sleep is one of the few things you can actually change during recovery, and the mental
            side of a concussion - irritability, low mood, brain fog - often goes untracked. MyLumi
            sits at that intersection.
          </p>
        </div>
      </Card>

      <Card title="What this is not">
        <div className="stack stack--tight text-sm text-muted">
          <p>
            <strong style={{ color: 'var(--text)' }}>
              MyLumi cannot diagnose you, and it is not a medical device.
            </strong>{' '}
            It doesn't know anything about you beyond what you type in.
          </p>
          <p>
            It will never predict a recovery date. Concussion recovery varies enormously between
            people, and a confident-sounding date would be misleading.
          </p>
        </div>
      </Card>

      <Card title="Limitations worth knowing">
        <ul className="stack stack--tight text-sm text-muted" style={{ paddingLeft: '1.1rem' }}>
          <li>
            Everything here is <strong>self-reported</strong>. How you rate a symptom depends on your
            mood, memory, and what you're comparing against.
          </li>
          <li>
            Any pattern MyLumi finds is <strong>from your data alone</strong> - it is not a
            population study, and it can't tell you what's typical for other people.
          </li>
          <li>
            <strong>A pattern is not a cause.</strong> If poor sleep and bad days occur together,
            MyLumi can't tell you which drove which.
          </li>
          <li>
            It needs about a <strong>week of entries</strong> before it can say anything meaningful,
            and it will tell you when it doesn't have enough data rather than guessing.
          </li>
          <li>
            It can't see anything you don't log - medication, other injuries, or what's happening in
            the rest of your life.
          </li>
        </ul>
      </Card>

      {/* The anchor the red-flag banner links to. Someone arriving here from an
          alert is scanning, not reading, so the list is scannable - and it is
          always here regardless of whether any rule has fired. A rule that never
          fires must never read as an all-clear. */}
      <Card title="When to seek medical help" id="red-flags">
        <div className="stack stack--tight text-sm text-muted">
          <p>
            Talk to a healthcare professional about your recovery. Seek help promptly if you have any
            of these:
          </p>
          <ul className="stack stack--tight" style={{ paddingLeft: '1.1rem' }}>
            <li>A headache that keeps getting worse, or one that won't go away</li>
            <li>Repeated vomiting</li>
            <li>Seizures or convulsions</li>
            <li>Weakness, numbness, or loss of coordination</li>
            <li>Slurred speech, or trouble understanding people</li>
            <li>Unusual confusion, agitation, or drowsiness</li>
            <li>One pupil larger than the other</li>
            <li>Someone who can't be woken normally</li>
          </ul>
          <p style={{ color: 'var(--text)' }}>
            Don't wait for MyLumi to tell you something is wrong.{' '}
            <strong>It cannot detect an emergency.</strong> MyLumi only sees the numbers you type in
            twice a day - it can't see any of the signs above, and it never will. If something feels
            wrong, that's reason enough to get help.
          </p>
        </div>
      </Card>
    </div>
  );
}
