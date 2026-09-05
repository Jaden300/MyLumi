/* What MyLumi does with the problem stated above, and what it measurably
   refuses to do.

   The figures in the second half are the app's own, not a population's, and
   they are labelled that way. They are also the only numbers in the product
   that flatter it, so they are the ones most worth being careful about: the 87
   percent is measured against a target of 80, and the honest half of that story
   is the 51 percent it replaced. Showing the failure next to the fix is the
   reason this card is convincing rather than a claim. */

import { Card } from '../ui/Card.jsx';
import { Lumi } from '../lumi/Lumi.jsx';
import { MIN_NIGHTS_FOR_INSIGHT } from '../../lib/constants.js';

const STEPS = [
  {
    head: 'Twice a day',
    body:
      'A short check-in before bed and after waking. Nine symptoms, sleep, mood, and where ' +
      'it hurts.',
  },
  {
    head: 'Numbers only, briefly',
    body:
      'A de-identified numeric snapshot goes to the model service. No name, no account, no ' +
      'journal text, and never which parts of your body you marked.',
  },
  {
    head: 'Six models, fit fresh',
    body:
      'Ridge regression, rank correlation, robust outlier detection, per-symptom trend ' +
      'estimation, a walk-forward backtest and a Kalman filter. Fit on your data, per ' +
      'request, then discarded.',
  },
  {
    head: 'An answer, or silence',
    body:
      'A finding, a forecast with an interval that has been checked, or nothing at all. ' +
      'Nothing is stored on the server, because there is no database to store it in.',
  },
];

export function SolutionInfographic() {
  return (
    <Card variant="feature">
      <Lumi size={200} state="presenting" className="lumi-deco lumi-deco--tr" />
      <h2 className="card__title">How MyLumi answers that</h2>
      <p className="text-muted">
        Sleep is one of the few things in concussion recovery you can actually change. MyLumi
        watches the relationship between your sleep and your symptoms, in your own data, and
        holds itself to what that data can support.
      </p>

      <ol className="pipeline">
        {STEPS.map((step, i) => (
          <li className="pipeline__step" key={step.head}>
            <span className="pipeline__n" aria-hidden="true">
              {i + 1}
            </span>
            <div className="stack stack--tight">
              <h3 className="pipeline__head">{step.head}</h3>
              <p className="limit__body">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="refusal">
        <h3 className="limit__head">What it refuses to do, in numbers</h3>
        <p className="text-muted">
          These are MyLumi's own measurements of MyLumi, taken from its test suite rather
          than from any published study.
        </p>

        <div className="refusal-grid">
          <div className="refusal__item">
            <strong className="refusal__value">{MIN_NIGHTS_FOR_INSIGHT} nights</strong>
            <span className="refusal__label">
              before any forecast at all. Under that it says nothing, rather than saying
              something hedged that would look just as confident.
            </span>
          </div>
          <div className="refusal__item">
            <strong className="refusal__value">51% to 87%</strong>
            <span className="refusal__label">
              real coverage of the forecast interval, against a target of 80. The first
              version claimed 80 and delivered 51. Backtesting caught it, and a conformal
              interval built from the model's own out-of-sample errors replaced it.
            </span>
          </div>
          <div className="refusal__item">
            <strong className="refusal__value">50% to 20%</strong>
            <span className="refusal__label">
              rate of finding a pattern in pure noise, before and after correcting for
              multiple comparisons. Uncorrected, roughly half of random datasets produced a
              confident finding.
            </span>
          </div>
          <div className="refusal__item">
            <strong className="refusal__value">0</strong>
            <span className="refusal__label">
              values invented to fill a gap, recovery dates predicted, and bytes of your
              record kept on a server.
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
