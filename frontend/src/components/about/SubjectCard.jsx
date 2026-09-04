/* The five things MyLumi is about, each stated once.

   What the app does in each of these areas was previously only legible by
   reading the docs or the source. The commitments were real but scattered -
   a sentence under a chart here, a paragraph in docs/responsible-ai.md there -
   and nowhere did the product say plainly what it does about sleep, or mood, or
   what leaves the device.

   These are full cards rather than a caption layer, deliberately. The design
   system bans prose at --fs-xs and check-style.mjs enforces it; the answer to
   "this needs more explaining" is a card with a title, not smaller text.

   Warm gold rather than the brand gradient so the five read as one set. See
   .card--highlight - the colour is Lumi's own molten core, not the --caution
   amber, which already means "mild concern" to the red-flag banner.

   Every claim below is checkable against the code. If one of these stops being
   true, this file is wrong and should change with it. */

import { Card } from '../ui/Card.jsx';
import { Lumi } from '../lumi/Lumi.jsx';

const SUBJECTS = {
  mental: {
    title: 'Lumi & Mental Health',
    lumi: 'attentive',
    body: [
      'The mental side of a concussion usually goes untracked. Lumi records mood on a 0 to 100 '
        + 'scale each evening, mood and energy again on waking, stress before sleep, and '
        + 'irritability as one of the nine symptom ratings - then looks for what moves with what.',
      'Writing in the journal is always optional. Requiring it on a bad day is exactly when '
        + 'someone stops using an app. Lumi does not screen for risk, and a mood slider is not a '
        + 'risk assessment.',
    ],
  },

  physical: {
    title: 'Lumi & Physical Recovery',
    lumi: 'thinking',
    body: [
      'Nine concussion symptoms rated 0 to 6 each night, a body map with 28 areas on the '
        + 'standard 0 to 10 pain scale, and the shape of the night around them - bedtime, wake '
        + 'time, quality, and how often sleep broke.',
      'Sleep is one of the few things that can actually change during recovery, so Lumi is '
        + 'built to show what moves alongside it. Each area of the body is modelled separately, in '
        + 'this browser, and no area name ever leaves the device.',
    ],
  },

  concussion: {
    title: 'Living With a Concussion',
    lumi: 'concerned',
    body: [
      'Every screen assumes light sensitivity and cognitive fatigue. The nine symptom sliders '
        + 'arrive three at a time rather than as one wall of input, the morning check-in is shorter '
        + 'than the evening one because waking is the worst moment to ask for sustained attention, '
        + 'and nothing flashes or animates unless asked.',
      'The night rolls over at 4am rather than midnight, so a check-in at 1:15am files under '
        + 'the night it belongs to instead of breaking a streak. Lumi will not estimate a recovery '
        + 'date, and says so further down this page.',
    ],
  },

  ai: {
    title: "Lumi's Approach to AI",
    lumi: 'reading',
    body: [
      'Nothing is kept on a server. Check-ins live in this browser, the model service stores '
        + 'nothing and never logs what it receives, and the pain map\'s region names never cross the '
        + 'wire at all - only how many areas were marked, and how bad. Journal text is sent only '
        + 'after being switched on by hand, and only to the one endpoint that reads text.',
      'Under seven nights Lumi offers no prediction at all - not a hedged one, none. A question '
        + 'left unanswered stays unanswered rather than quietly becoming a zero, and a night '
        + 'missing a measurement is dropped from that model rather than filled in.',
    ],
  },

  ml: {
    title: "Lumi's ML Processes",
    lumi: 'presenting',
    body: [
      'A ridge regression forecasts tomorrow\'s symptom burden and reads its drivers straight '
        + 'off its own fitted coefficients, so the explanation and the number can never disagree. A '
        + 'Kalman filter tracks the underlying recovery trend and widens its own uncertainty across '
        + 'nights that were missed. Rank correlations, corrected for multiple comparisons, look for '
        + 'what tends to precede a harder day.',
      'Every forecast is scored against simply guessing that tomorrow looks like today - the '
        + 'thing a personal model has to beat to be worth running. Lumi reports that comparison '
        + 'whichever way it comes out.',
    ],
  },
};

export const SUBJECT_KEYS = Object.keys(SUBJECTS);

export function SubjectCard({ subject, className = '' }) {
  const s = SUBJECTS[subject];
  if (!s) return null;

  return (
    <Card variant={['feature', 'highlight']} className={className}>
      <Lumi size={190} state={s.lumi} className="lumi-deco lumi-deco--br" />
      <div className="stack stack--tight">
        <h2 className="card__title">{s.title}</h2>
        {s.body.map((paragraph) => (
          <p className="text-muted" key={paragraph.slice(0, 32)}>
            {paragraph}
          </p>
        ))}
      </div>
    </Card>
  );
}
