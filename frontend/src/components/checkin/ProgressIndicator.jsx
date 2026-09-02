/* Segment-grouped progress. Three symptom screens read as one "Symptoms"
   segment that fills gradually, rather than six equal dots — "step 3 of 6" when
   you've barely started is discouraging for an already-fatigued user. */

export function ProgressIndicator({ segments, stepIndex, stepCount }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={stepCount}
      aria-valuenow={stepIndex + 1}
      aria-valuetext={`Step ${stepIndex + 1} of ${stepCount}`}
    >
      {segments.map((segment) => (
        <div
          key={segment.label}
          className={`progress__segment${segment.active ? ' progress__segment--active' : ''}`}
        >
          <div className="progress__bar">
            <div
              className="progress__fill"
              style={{ width: `${(segment.done / segment.total) * 100}%` }}
            />
          </div>
          <span className="progress__label">{segment.label}</span>
        </div>
      ))}
    </div>
  );
}
