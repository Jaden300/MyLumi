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

import { Component, Suspense, lazy, useEffect, useState } from 'react';

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

/**
 * Load the model BEFORE the canvas mounts, then mount the canvas.
 *
 * This ordering is not an optimisation, it is what makes the canvas render at
 * all in development.
 *
 * `useGLTF` suspends while the model downloads. A suspending child causes the
 * Suspense boundary to unmount and remount its subtree - the Canvas included -
 * and R3F's unmount path calls `gl.forceContextLoss()` to avoid leaking a WebGL
 * context. It schedules that teardown in a setTimeout, so it lands after the
 * remount and destroys the context belonging to the canvas that is now live.
 * StrictMode's deliberate double-mount makes this happen every time. The result
 * is a blank canvas, a halted render loop, and a single console line reading
 * "THREE.WebGLRenderer: Context Lost" - no error, no failed request, and a
 * scene graph that inspects as completely correct.
 *
 * Warming drei's cache first means `useGLTF` resolves immediately, so the
 * Canvas never suspends, is never torn down, and keeps the context it made.
 *
 * The preload lives here rather than at module scope on purpose: at module
 * scope it would fetch several megabytes for every user who never opens this
 * step, which is exactly what the code split above exists to prevent.
 */
function useModelReady() {
  const [state, setState] = useState('loading');

  useEffect(() => {
    let alive = true;
    import('./PainBodyCanvas.jsx')
      .then((mod) => Promise.resolve(mod.preloadBodyModel()))
      .then(() => alive && setState('ready'))
      .catch(() => alive && setState('failed'));
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

export function PainBodySurface(props) {
  const state = useModelReady();

  if (state === 'failed') {
    return (
      <SurfaceNotice
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

  if (state === 'loading') {
    return <SurfaceNotice>Loading the body model...</SurfaceNotice>;
  }

  return (
    <CanvasBoundary>
      <Suspense fallback={<SurfaceNotice>Loading the body model...</SurfaceNotice>}>
        <PainBodyCanvas {...props} />
      </Suspense>
    </CanvasBoundary>
  );
}
