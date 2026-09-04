/* Each of the nine PCSS items on its own, rather than as one burden number.

   Two things a single aggregate score cannot tell you, and this card can:

   1. WHICH symptoms are resolving and which are not. "You are improving" is
      much less useful than "your headache is easing but your brain fog has not
      moved in a month" - and the second is the sentence worth taking to a
      clinician.
   2. HOW a bad night changes the shape of a day, not just its size. After short
      sleep a larger share of the same burden shows up as particular symptoms.

   Three deliberate choices about honesty:

   - A symptom whose trend cannot be told apart from flat is drawn grey and
     labelled "not clear yet", never given a direction. The backend decides
     this (its confidence interval has to exclude zero AND survive correction
     for testing all nine at once); this component only renders the verdict.
   - Bar length encodes magnitude and colour encodes direction, so the chart is
     still readable if colour is lost - and there is a text label besides.
   - Improvement is green and worsening is amber, but "not clear" is deliberately
     neutral rather than a third alarming colour. Most symptoms sit there most
     of the time and that is normal. */

import { Card } from '../ui/Card.jsx';
import { Lumi } from '../lumi/Lumi.jsx';
import { SymptomHeatmap } from './SymptomHeatmap.jsx';

/* The widest weekly change the axis shows. Beyond this a bar is clamped and
   the number beside it carries the real value - one enormous bar would squash
   every other one into invisibility. */
const AXIS_MAX = 3;

const STATUS_TEXT = {
  easing: 'easing',
  worsening: 'rising',
  unclear: 'not clear yet',
};

function barWidth(weeklyChange) {
  const magnitude = Math.min(Math.abs(weeklyChange), AXIS_MAX);
  return (magnitude / AXIS_MAX) * 50; // percent of the full-width track
}

export function SymptomProfileCard({ symptoms }) {
  if (!symptoms?.available) return null;

  const { rates = [], shifts = [], grid, summary } = symptoms;
  if (!rates.length && !shifts.length) return null;

  // Decided trends first, then the rest - the actionable rows should not be
  // buried among the ones the model declined to call.
  const ordered = [...rates].sort((a, b) => {
    const decided = (r) => (r.status === 'unclear' ? 1 : 0);
    if (decided(a) !== decided(b)) return decided(a) - decided(b);
    return a.weeklyChange - b.weeklyChange;
  });

  return (
    <Card title="Symptom by symptom" variant="feature">
      <Lumi size={170} state="presenting" className="lumi-deco lumi-deco--tr" />
      <div className="stack">
        <span className="stat__label">How each one has been moving</span>

        {summary && <p className="finding__statement">{summary}</p>}

        {/* The evidence, before the summary of it. Every rating that produced
            the rates below, so a reader can check the sentence against the
            data instead of taking it on trust. */}
        <SymptomHeatmap grid={grid} />

        {ordered.length > 0 && (
          <ul className="symptom-rates">
            {ordered.map((rate) => {
              const width = barWidth(rate.weeklyChange);
              const improving = rate.status === 'easing';
              const unclear = rate.status === 'unclear';
              return (
                <li key={rate.key} className="symptom-rate">
                  <span className="symptom-rate__label">{rate.label}</span>
                  <span
                    className="symptom-rate__track"
                    role="img"
                    aria-label={`${rate.label}: ${
                      unclear
                        ? 'no clear trend yet'
                        : `${STATUS_TEXT[rate.status]} by ${Math.abs(
                            rate.weeklyChange,
                          ).toFixed(1)} points a week`
                    }`}
                  >
                    <span className="symptom-rate__axis" aria-hidden="true" />
                    {!unclear && (
                      <span
                        className={`symptom-rate__bar symptom-rate__bar--${
                          improving ? 'easing' : 'rising'
                        }`}
                        style={{
                          width: `${width}%`,
                          // Improving bars run left from the centre line,
                          // worsening ones run right. The centre is the "no
                          // change" position, so direction is a position on the
                          // axis rather than only a colour.
                          [improving ? 'right' : 'left']: '50%',
                        }}
                      />
                    )}
                  </span>
                  <span
                    className={`symptom-rate__value ${
                      unclear ? 'text-muted' : ''
                    }`}
                  >
                    {unclear
                      ? STATUS_TEXT.unclear
                      : `${rate.weeklyChange > 0 ? '+' : ''}${rate.weeklyChange.toFixed(
                          1,
                        )}/wk`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {shifts.length > 0 && (
          <div className="stack stack--tight">
            <span className="stat__label">After your shorter nights</span>
            <ul className="finding-list">
              {shifts.map((shift) => (
                <li key={shift.key} className="finding">
                  <p className="finding__statement">{shift.statement}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
