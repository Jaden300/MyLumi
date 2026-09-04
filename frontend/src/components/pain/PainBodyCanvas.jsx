/* The WebGL surface: camera, lights, controls.

   Only ever reached through PainBodySurface's dynamic import - importing this
   file statically from anywhere would pull three.js into the main bundle and
   undo the code split. See the note there.

   NOT UNIT TESTED for the same reason as PainBodyModel: jsdom has no WebGL. */

import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PainBodyModel } from './PainBodyModel.jsx';

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

export function PainBodyCanvas({ onPickRegion }) {
  const [diagnostics, setDiagnostics] = useState(null);

  /* A rig whose bones this app does not recognise produces a body that ignores
     every tap, with no error anywhere - the worst way for this to fail. In dev
     that becomes a visible warning naming the bones, which is what makes a new
     model debuggable in minutes rather than by guesswork. */
  const unmappedWarning =
    import.meta.env.DEV && diagnostics && diagnostics.mapped === 0 && diagnostics.boneCount > 0;

  return (
    <div className="pain-surface">
      <Canvas
        camera={{ position: [0, 0.2, 3.2], fov: 35 }}
        dpr={[1, 2]}
        /* The canvas is decorative to assistive tech: everything it can do is
           also reachable from the region list below it, which is labelled and
           keyboard navigable. Announcing an unlabelled WebGL surface would add
           noise without adding a capability. */
        aria-hidden="true"
        tabIndex={-1}
      >
        <Lights />
        <PainBodyModel onPickRegion={onPickRegion} onDiagnostics={setDiagnostics} />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
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

      {unmappedWarning && (
        <p className="pain-surface__diagnostic">
          None of this model's {diagnostics.boneCount} bones map to a body region. First few:{' '}
          {diagnostics.unmapped.slice(0, 6).join(', ')}. See BONE_TO_REGION in lib/painRegions.js.
        </p>
      )}
    </div>
  );
}
