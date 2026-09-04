/* The WebGL surface: camera, lights, controls.

   Only ever reached through PainBodySurface's dynamic import - importing this
   file statically from anywhere would pull three.js into the main bundle and
   undo the code split. See the note there.

   NOT UNIT TESTED for the same reason as PainBodyModel: jsdom has no WebGL. */

import { useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { MODEL_URL, PainBodyModel } from './PainBodyModel.jsx';
import { formatRegionLabel } from '../../lib/painRegions.js';

/**
 * Fetch and parse the model, resolving when it is in drei's cache.
 *
 * Called by PainBodySurface before it mounts the Canvas - see the long note
 * there for why that ordering is what makes the canvas render at all. Rejects
 * if the file is missing or unparseable, which the caller turns into the same
 * fallback notice as any other failure.
 */
export function preloadBodyModel() {
  return Promise.resolve(useGLTF.preload(MODEL_URL));
}

/* Lighting is flat and soft on purpose. Hard speculars and strong contrast are
   exactly what a light-sensitive user does not want, and the model is a
   diagram to point at rather than a scene to admire. */
function Lights() {
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[2, 4, 3]} intensity={0.6} />
      <directionalLight position={[-2, 1, -3]} intensity={0.3} />
    </>
  );
}

/* Recover from a lost WebGL context.

   A browser can take the context away at any time - the tab is backgrounded,
   the GPU resets, another page claims too many contexts - and the canvas then
   goes blank and stays blank, because the render loop is drawing into nothing.
   The default behaviour on `webglcontextlost` is to make the loss permanent,
   so preventDefault() is what allows a restore to ever arrive.

   In development this fires reliably for a second reason. StrictMode mounts,
   unmounts and remounts every component to surface side effects that are not
   cleaned up, and R3F's unmount path calls `gl.forceContextLoss()` - correctly,
   since a leaked context is a real leak - from inside a setTimeout. Under the
   double-mount that teardown lands AFTER the remount and kills the context the
   live canvas is drawing with. Production never double-mounts, so this is a
   dev-only trigger for a failure mode that is nonetheless real in production
   for its own reasons, which is why it is fixed rather than papered over by
   turning StrictMode off. */
function ContextRecovery({ onLost }) {
  const { gl, invalidate } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;

    const handleLost = (event) => {
      // Without this the loss is final and no restore event ever comes.
      event.preventDefault();
      onLost(true);
    };

    const handleRestored = () => {
      onLost(false);
      // The scene survived; only the GPU-side resources went away. Ask for a
      // frame so the canvas repaints immediately rather than on next input.
      invalidate();
    };

    canvas.addEventListener('webglcontextlost', handleLost);
    canvas.addEventListener('webglcontextrestored', handleRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost);
      canvas.removeEventListener('webglcontextrestored', handleRestored);
    };
  }, [gl, invalidate, onLost]);

  return null;
}

export function PainBodyCanvas({ onPickRegion, markedRegions, regionColors, readOnly = false }) {
  const [diagnostics, setDiagnostics] = useState(null);
  const [hovered, setHovered] = useState(null);

  /* Nothing renders from this. Recovery is handled entirely inside
     ContextRecovery - preventDefault on the loss so a restore event can arrive,
     then invalidate to repaint - and by the time a lost context could be shown,
     it is usually already back. Kept as a setter without a reader because the
     listeners need somewhere to report to, and named so the next person does
     not go looking for the UI that consumes it. */
  const [, setContextLost] = useState(false);

  /* A rig whose bones this app does not recognise produces a body that ignores
     every tap, with no error anywhere - the worst way for this to fail. In dev
     that becomes a visible warning naming the bones, which is what makes a new
     model debuggable in minutes rather than by guesswork. */
  const unmappedWarning =
    import.meta.env.DEV && diagnostics && diagnostics.mapped === 0 && diagnostics.boneCount > 0;

  return (
    <div className="pain-surface" data-hovering={hovered ? 'true' : undefined}>
      <Canvas
        /* A Mixamo export stands on the ground plane, so its origin is between
           the feet rather than at its centre. Aiming at 0.95 puts the camera on
           the chest of a roughly 1.8 unit figure; aiming at the origin would
           frame the floor. The distance clears a T-pose's full arm span. */
        camera={{ position: [0, 0.95, 3.4], fov: 35 }}
        dpr={[1, 2]}
        /* The canvas is decorative to assistive tech: everything it can do is
           also reachable from the region list below it, which is labelled and
           keyboard navigable. Announcing an unlabelled WebGL surface would add
           noise without adding a capability. */
        aria-hidden="true"
        tabIndex={-1}
      >
        <ContextRecovery onLost={setContextLost} />
        <Lights />
        <PainBodyModel
          onPickRegion={onPickRegion}
          onHoverRegion={setHovered}
          onDiagnostics={setDiagnostics}
          hoveredRegion={hovered}
          markedRegions={markedRegions}
          regionColors={regionColors}
          readOnly={readOnly}
        />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          /* Orbit around the chest, not the origin. The default target is
             [0,0,0], which for a figure standing on the ground plane means the
             body swings around its own feet - disorienting, and it throws the
             head out of frame as soon as you drag. */
          target={[0, 0.95, 0]}
          // No panning: the body should stay centred, and a user who drags it
          // off screen has no obvious way to recover it.
          enablePan={false}
          minDistance={1.6}
          maxDistance={5}
          // Stop short of the poles. Looking at the model from directly
          // overhead is disorienting and shows nothing useful.
          minPolarAngle={Math.PI * 0.1}
          maxPolarAngle={Math.PI * 0.9}
          // No autoRotate. Idle motion on a screen belongs nowhere in an app
          // for people with dizziness and light sensitivity.
          autoRotate={false}
        />
      </Canvas>

      {/* Name the highlighted region. The shading alone says "this area" but
          not which area it is called, and the boundary between a calf and a
          knee is not something a person can read off a tint. Naming it before
          the tap is also what makes a mis-picked region correctable without
          having to mark it and undo it. */}
      {hovered && <p className="pain-surface__hovered">{formatRegionLabel(hovered)}</p>}

      {unmappedWarning && (
        <p className="pain-surface__diagnostic">
          None of this model's {diagnostics.boneCount} bones map to a body region. First few:{' '}
          {diagnostics.unmapped.slice(0, 6).join(', ')}. See BONE_TO_REGION in lib/painRegions.js.
        </p>
      )}
    </div>
  );
}
