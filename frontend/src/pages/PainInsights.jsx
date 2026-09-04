/* Where the pain map says something back.

   The check-in step records where it hurts; this page is the other half - what
   each area has been doing, and how the model's own projections compared to
   what the user went on to report.

   ## Why this is its own route

   Two reasons, both practical. The insights page is already dense, and this is
   the only screen besides the check-in step that loads three.js - keeping it
   here means the 3D chunk stays off every other route, which npm run
   check:bundle asserts.

   ## Everything here is computed on this device

   No part of this page calls the network. The wire contract sends three pain
   aggregates and no region names, and it still does; the per-region models run
   in the browser because the data is already here. See the header of
   lib/painTrajectory.js. */

import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useLumiData } from '../hooks/useLumiData.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Lumi } from '../components/lumi/Lumi.jsx';
import { PainTimeline } from '../components/painmap/PainTimeline.jsx';
import { RegionTrendChart } from '../components/painmap/RegionTrendChart.jsx';
import { ProjectedVsActualChart } from '../components/painmap/ProjectedVsActualChart.jsx';
import { RegionTable } from '../components/painmap/RegionTable.jsx';
import {
  MIN_NIGHTS_FOR_REGION,
  buildRegionModels,
  buildTimelineFrames,
} from '../lib/painTrajectory.js';
import { toLocalISODate, prevDay } from '../lib/dates.js';

const RANGE_DAYS = 60;

export function PainInsights() {
  const { isOnboarded, getEntryRange, profile } = useLumiData();
  const [openRegion, setOpenRegion] = useState(null);

  const end = toLocalISODate(new Date());
  let start = end;
  for (let i = 0; i < RANGE_DAYS - 1; i += 1) start = prevDay(start);

  const entries = getEntryRange(start, end);

  const models = useMemo(
    () => buildRegionModels(entries, { injuryDate: profile?.injuryDate ?? null }),
    [entries, profile?.injuryDate],
  );

  /* Trimmed to the span that actually has answers, at BOTH ends.

     The window is a fixed 60 days back, but a user's record starts when they
     started. Leading empties open the timeline on an unlit body captioned "not
     logged" - the headline feature's first impression being a blank - and
     trailing empties end it on the same thing, which reads as "the pain
     stopped" rather than "the record stops".

     Gaps in the MIDDLE are kept, deliberately. Those are real missed nights and
     the timeline has to show them as such; collapsing them would close up the
     calendar and quietly assert the record is denser than it is. */
  const frames = useMemo(() => {
    const all = buildTimelineFrames(entries);
    let first = -1;
    let last = -1;
    for (let i = 0; i < all.length; i += 1) {
      if (!all[i].answered) continue;
      if (first === -1) first = i;
      last = i;
    }
    return first === -1 ? [] : all.slice(first, last + 1);
  }, [entries]);

  if (!isOnboarded) return <Navigate to="/onboarding" replace />;

  const withTrend = models.filter((m) => m.trend !== null);
  const belowFloor = models.filter((m) => m.trend === null);
  const selected = models.find((m) => m.regionId === openRegion) ?? null;

  return (
    <div className="stack stack--loose">
      <header className="page-head">
        <h1>Pain over time</h1>
        <div className="page-head__art hero__art">
          <Lumi size={84} state="thinking" />
        </div>
      </header>

      {models.length === 0 ? (
        <Card title="Nothing marked yet">
          <p className="text-muted text-sm">
            When you mark where it hurts during a night check-in, this page will show
            how each area has been changing.
          </p>
        </Card>
      ) : (
        <>
          <Card title="Play it back" variant="feature">
            <PainTimeline frames={frames} />
          </Card>

          <Card title="Each area">
            <div className="stack">
              {withTrend.length === 0 && (
                <p className="text-muted text-sm">
                  No area has been rated on {MIN_NIGHTS_FOR_REGION} nights yet, which is
                  the fewest MyLumi will look at a trend from.
                </p>
              )}

              <div className="grid grid--auto">
                {withTrend.map((model) => (
                  <button
                    key={model.regionId}
                    type="button"
                    className="region-card"
                    aria-pressed={openRegion === model.regionId}
                    onClick={() =>
                      setOpenRegion(openRegion === model.regionId ? null : model.regionId)
                    }
                  >
                    <span className="region-card__head">
                      <span className="region-card__label">{model.label}</span>
                      <span className={`region-card__status region-card__status--${model.trend.status}`}>
                        {statusWord(model.trend.status)}
                      </span>
                    </span>
                    <RegionTrendChart label={model.label} series={model.series} />
                    <span className="region-card__meta text-muted text-sm">
                      {model.n} nights rated, most recently {model.latest} of 10
                    </span>
                  </button>
                ))}
              </div>

              {/* Named rather than hidden. An area rated three times is a real
                  part of the record, and silently omitting it would make the
                  page look like a complete picture when it is not. */}
              {belowFloor.length > 0 && (
                <p className="text-muted text-sm">
                  Also marked, but not on enough nights for a trend yet:{' '}
                  {belowFloor.map((m) => `${m.label} (${m.n})`).join(', ')}.
                </p>
              )}
            </div>
          </Card>

          {selected && (
            <Card title={`${selected.label}: projected against actual`}>
              <div className="stack">
                {selected.backtest.n === 0 ? (
                  <p className="text-muted text-sm">
                    MyLumi needs more nights with this area rated before it can check
                    its own projections against what you went on to report.
                  </p>
                ) : (
                  <>
                    <ProjectedVsActualChart
                      label={selected.label}
                      points={selected.backtest.points}
                    />
                    <RegionTable backtest={selected.backtest} />
                  </>
                )}
              </div>
            </Card>
          )}

          <Card title="What this is, and is not">
            <div className="stack">
              <p className="text-sm">
                These trends come from your own ratings alone. MyLumi does not know how
                long an area &quot;should&quot; hurt for, and it will not estimate a date
                when yours will stop.
              </p>
              <p className="text-muted text-sm">
                Where an area has few ratings, the projection leans on a general
                population recovery shape - symptoms often peak around days 3 to 5 and
                most people improve substantially within about four weeks. That shape is
                the same for every part of the body, because published data at
                body-area resolution does not exist. It is general population data, not
                a prediction about you, and it fades as your own ratings accumulate.
              </p>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function statusWord(status) {
  if (status === 'easing') return 'easing';
  if (status === 'worsening') return 'worsening';
  return 'not clear yet';
}
