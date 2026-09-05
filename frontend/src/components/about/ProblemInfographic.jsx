/* The case for the app, in published figures rather than in adjectives.

   Every number here carries its source on screen. That is not decoration: this
   page also tells the reader that MyLumi drops a row rather than impute one and
   says nothing under seven nights rather than guess. Stating unsourced
   population statistics two screens above that would undo it.

   The figures deliberately stop short of what would be rhetorically useful.
   There is no "X percent of concussions go undiagnosed" here, because the
   estimates for it vary too widely to state as one number. The CDC counts below
   are hospitalizations and deaths only - they exclude anyone treated in an
   emergency department and released, seen in primary care, or never seen at
   all, which is most concussions. Saying so is more persuasive than a bigger
   number would be, and it is the same move the app makes with its own
   uncertainty. */

import { Card } from '../ui/Card.jsx';
import { StatFigure } from './StatFigure.jsx';

/* The population curve, in the same abstract-viewBox idiom as
   insights/TrajectoryChart.jsx. Two lines: the average course most people
   follow, and the one the 15 to 30 percent with persisting symptoms do not.

   The divergence is the entire argument for a personal model, so it is the one
   thing the drawing has to make unmissable. A single averaged curve would
   illustrate the opposite point. */
const W = 320;
const H = 150;
const PAD = { top: 16, right: 12, bottom: 30, left: 40 };
const DAYS = 42;
const PEAK_DAY = 4;

const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

const sx = (day) => PAD.left + (day / DAYS) * plotW;
const sy = (v) => PAD.top + plotH - v * plotH;

/* Rise to the day 3 to 5 peak, then decay. The typical course uses the same
   10.5 day half life as lib/recoveryPrior.js, which is itself read off "most
   people improve substantially within about four weeks". The persisting course
   decays far more slowly. Neither is fitted to anything: this is a shape, and
   the caption says so. */
function course(day, halfLife, floor = 0) {
  const rise = day <= PEAK_DAY ? day / PEAK_DAY : 1;
  const decay = day <= PEAK_DAY ? 1 : Math.pow(0.5, (day - PEAK_DAY) / halfLife);
  return floor + (1 - floor) * rise * decay;
}

function path(halfLife, floor) {
  const points = [];
  for (let day = 0; day <= DAYS; day += 1) {
    points.push(`${sx(day)},${sy(course(day, halfLife, floor) * 0.86)}`);
  }
  return points.join(' ');
}

const TYPICAL = path(10.5, 0);
const PERSISTING = path(46, 0.34);

export function ProblemInfographic() {
  return (
    <Card variant={['feature', 'accent']}>
      <h2 className="card__title">Why this exists</h2>
      <p className="text-muted">
        A concussion is common, mostly invisible, and mostly counted only when it is severe
        enough to put someone in a hospital bed. Recovery is measured in weeks of symptoms
        nobody else can see.
      </p>

      <div className="stat-figure-grid">
        <StatFigure
          value="214,110"
          label="TBI hospitalizations in the US, 2020"
          source="CDC"
        />
        <StatFigure
          value="68,663"
          label="TBI-related deaths in the US, 2023"
          source="CDC"
        />
        <StatFigure
          value="~75%"
          label="of traumatic brain injuries are mild, the kind called a concussion"
          source="CDC, MMWR Surveill Summ 2017"
        />
        <StatFigure
          value="30-70%"
          label="of people report disturbed sleep after a brain injury"
          source="Sleep disorders following TBI, review"
        />
        <StatFigure
          value="15-30%"
          label="still have symptoms well past the window most people recover in"
          source="Persisting post-concussion symptoms literature"
        />
        <StatFigure
          value="3-4x"
          label="longer recovery when sleep is disturbed, in 417 adolescent patients"
          source="Bramley et al., Clin Pediatr 2017;56(14):1280-1285"
        />
      </div>

      <p className="text-muted stat-figure-grid__note">
        The two counts above are hospitalizations and deaths. They leave out everyone sent
        home from an emergency department, seen by a family doctor, or never seen at all,
        which is most concussions. The real denominator is not known.
      </p>

      <div className="problem-curve">
        <h3 className="limit__head">Recovery is not one curve</h3>
        <p className="text-muted">
          Symptoms tend to peak around days 3 to 5 and settle over about four weeks. That is
          the average. It is not a promise, and for a substantial minority it is not what
          happens.
        </p>
        <svg
          className="problem-curve__chart"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={
            'Two recovery courses over six weeks. Both rise to a peak around days 3 to 5. ' +
            'The typical course falls away to near nothing by about four weeks. The ' +
            'persisting course, which 15 to 30 percent of people follow, is still well ' +
            'above zero at six weeks.'
          }
        >
          <line
            x1={PAD.left}
            y1={sy(0)}
            x2={W - PAD.right}
            y2={sy(0)}
            className="trajectory__grid"
          />
          <line
            x1={sx(PEAK_DAY)}
            y1={PAD.top}
            x2={sx(PEAK_DAY)}
            y2={sy(0)}
            className="problem-curve__peak"
          />
          <text x={sx(PEAK_DAY) + 4} y={PAD.top + 8} className="trajectory__axis">
            days 3 to 5
          </text>

          <polyline className="problem-curve__persisting" points={PERSISTING}>
            <title>
              The persisting course: symptoms still present at six weeks, which is what
              happens for 15 to 30 percent of people.
            </title>
          </polyline>
          <polyline className="problem-curve__typical" points={TYPICAL}>
            <title>
              The typical course: symptoms peak around days 3 to 5 and settle substantially
              by about four weeks.
            </title>
          </polyline>

          <text
            className="trajectory__axis-title"
            textAnchor="middle"
            transform={`rotate(-90) translate(${-(PAD.top + plotH / 2)}, 11)`}
          >
            Symptoms
          </text>
          <text x={PAD.left} y={H - 8} className="trajectory__axis">
            injury
          </text>
          <text x={W - PAD.right} y={H - 8} textAnchor="end" className="trajectory__axis">
            6 weeks
          </text>
        </svg>

        <ul className="trajectory__legend">
          <li className="trajectory__key">
            <span className="problem-curve__key problem-curve__key--typical" aria-hidden="true" />
            The average course
          </li>
          <li className="trajectory__key">
            <span
              className="problem-curve__key problem-curve__key--persisting"
              aria-hidden="true"
            />
            Symptoms that persist
          </li>
        </ul>

        <p className="text-muted">
          An average curve cannot tell you which one you are on, and neither can MyLumi. What
          it can do is learn the pattern in your own entries, which is a smaller claim and a
          more useful one.
        </p>
      </div>
    </Card>
  );
}
