/* The boundary between the app and the 3D body.

   This is the ONLY place in the app that code-splits, and the split is load
   bearing rather than decorative. three.js plus the R3F runtime is by a wide
   margin the largest dependency in the project, and the body model itself is
   several megabytes; pulling either into the main bundle would slow the
   dashboard, the history page and every check-in screen for a feature that
   appears on one step. The import below is what keeps that cost on the step
   that uses it.

   The chain has to stay unbroken to work: stepRegistry imports PainMapStep
   statically, PainMapStep imports this file statically, and this file is where
   the static chain stops. Anything that imports PainBodyCanvas directly from
   outside this file undoes the split silently - the app keeps working, the
   bundle just quietly doubles. There is a build assertion for exactly that.

   Failure here is expected rather than exceptional. A device with no WebGL, a
   model that 404s, a slow connection - all of them end up in one of the two
   fallbacks below, and none of them may block a check-in. The region list in
   PainMapStep remains fully usable in every one of those states, which is why
   this component can afford to fail quietly. */

import { Component, Suspense, lazy } from 'react';

const PainBodyCanvas = lazy(() =>
  import('./PainBodyCanvas.jsx').then((m) => ({ default: m.PainBodyCanvas })),
);

function SurfaceNotice({ children, hint }) {
  return (
    <div className="pain-surface pain-surface--notice">
      <p className="text-muted text-sm">{children}</p>
      {hint && <p className="pain-surface__hint">{hint}</p>}
    </div>
  );
}

/* A render error inside the canvas - a WebGL context that will not start, a
   malformed GLB, a driver that gives up - must degrade to the list, never take
   the check-in down with it. The app's own ErrorBoundary wraps whole routes;
   this one is deliberately narrow so only the model is lost. */
class CanvasBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <SurfaceNotice
          /* In dev the most likely cause by a distance is that the model file
             is simply not there yet. Vite serves the SPA shell for an unmatched
             path rather than a 404, so the loader gets HTML and fails to parse
             it - an error that says nothing useful about what to do next. */
          hint={
            import.meta.env.DEV
              ? 'In development this usually means public/models/body.glb is missing. See the README.'
              : null
          }
        >
          The 3D body could not load. Use the list below instead.
        </SurfaceNotice>
      );
    }
    return this.props.children;
  }
}

export function PainBodySurface(props) {
  return (
    <CanvasBoundary>
      <Suspense fallback={<SurfaceNotice>Loading the body model...</SurfaceNotice>}>
        <PainBodyCanvas {...props} />
      </Suspense>
    </CanvasBoundary>
  );
}
