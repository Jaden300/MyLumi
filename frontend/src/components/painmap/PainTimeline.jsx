/* Pain over time, played back on the body.

   Press play and the body re-colours night by night; scrub to land on any one
   night. The 3D surface is reached through PainBodySurface, never by importing
   the canvas directly - that component owns the code split and the model
   preload, and going around it silently doubles the entry bundle. There is a
   build assertion for exactly that.

   ## Why this is cheap

   The expensive part of the 3D body - resolving which region every vertex
   belongs to - already happens once at load, for hover highlighting. Playback
   reuses that table and only rewrites a colour buffer, so a frame costs one
   pass over an array rather than a re-resolve of a hundred thousand bone
   weights.

   ## Three states, kept distinct on screen

   A night with ratings, a night where the user said nothing hurt, and a night
   that was never logged are three different facts, and the body looks the same
   for the last two. So the caption carries the difference. Rendering "nothing
   hurt" for a night nobody logged would be inventing an answer - the same
   fabrication this app refuses at every other layer, wearing a caption.

   ## Motion

   Autoplay is off under prefers-reduced-motion. Idle motion is a symptom
   trigger for exactly the people this app is for, and a timeline that starts
   moving on its own is worse than one they press play on. The scrubber remains
   fully usable in that state - nothing is gated behind the animation. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PainBodySurface } from '../pain/PainBodySurface.jsx';
import { shadeFrame } from '../../lib/painShading.js';
import { formatShortDate } from '../../lib/dates.js';
import { formatRegionLabel } from '../../lib/painRegions.js';

/* Milliseconds per night at 1x. Slow enough to read the body, fast enough that
   six weeks does not outlast the viewer's patience. */
const FRAME_MS = 700;
const SPEEDS = [0.5, 1, 2];

/* Total, and false when matchMedia is missing. A jsdom test environment has no
   matchMedia by default, and throwing here would take the whole page down over
   a preference lookup. */
function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function PainTimeline({ frames }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timer = useRef(null);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);

  const count = frames?.length ?? 0;
  const safeIndex = Math.min(index, Math.max(0, count - 1));
  const frame = count > 0 ? frames[safeIndex] : null;

  const regionColors = useMemo(() => (frame ? shadeFrame(frame.regions) : {}), [frame]);

  const stop = useCallback(() => {
    setPlaying(false);
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    if (!playing || count === 0) return undefined;
    timer.current = setInterval(() => {
      setIndex((current) => {
        // Stop at the end rather than looping. A loop makes it easy to lose
        // track of where the record actually ends.
        if (current >= count - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, FRAME_MS / speed);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [playing, speed, count]);

  useEffect(() => () => stop(), [stop]);

  if (count === 0) {
    return (
      <p className="text-muted text-sm">
        Once you have marked pain on a few nights, you can play them back here.
      </p>
    );
  }

  const atEnd = safeIndex >= count - 1;
  const rated = Object.entries(frame.regions ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="stack">
      <PainBodySurface regionColors={regionColors} readOnly />

      <div className="timeline">
        <div className="timeline__transport">
          {/* Under prefers-reduced-motion the animation is replaced by a step
              control rather than removed. The user still reaches every night,
              one press at a time, and nothing on this screen is gated behind
              motion they have asked not to see. */}
          {reducedMotion ? (
            <button
              type="button"
              className="btn btn--secondary"
              disabled={atEnd}
              onClick={() => setIndex((current) => Math.min(count - 1, current + 1))}
            >
              Next night
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                if (playing) {
                  stop();
                  return;
                }
                // Replaying from the end should start over rather than doing
                // nothing, which is what a play button at the end appears to do.
                if (atEnd) setIndex(0);
                setPlaying(true);
              }}
            >
              {playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
            </button>
          )}

          {!reducedMotion && (
            <label className="timeline__speed">
              <span className="sr-only">Playback speed</span>
              <select
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
              >
                {SPEEDS.map((value) => (
                  <option key={value} value={value}>
                    {value}x
                  </option>
                ))}
              </select>
            </label>
          )}

          <p className="timeline__date">{formatShortDate(frame.nightOf)}</p>
        </div>

        <label className="timeline__scrub">
          <span className="sr-only">Night</span>
          <input
            type="range"
            min={0}
            max={count - 1}
            step={1}
            value={safeIndex}
            onChange={(event) => {
              stop();
              setIndex(Number(event.target.value));
            }}
            aria-valuetext={`${formatShortDate(frame.nightOf)}, night ${safeIndex + 1} of ${count}`}
          />
        </label>

        {/* The caption is the accessible record of what the body is showing,
            since the canvas itself is aria-hidden. It is also the only thing
            that distinguishes a night nobody logged from one where nothing
            hurt - the body looks identical for both. */}
        <p className="timeline__caption" role="status">
          {!frame.answered ? (
            <span className="text-muted">Not logged</span>
          ) : rated.length === 0 ? (
            <span className="text-muted">Nothing hurt</span>
          ) : (
            rated
              .map(([id, score]) => `${formatRegionLabel(id)} ${score}`)
              .join(', ')
          )}
        </p>
      </div>
    </div>
  );
}
