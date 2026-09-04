/* The body mesh, and the tap-to-region handler.

   NOT UNIT TESTED, deliberately. jsdom has no WebGL context, so a react-three
   canvas cannot mount there at all, and reaching one would mean headless-gl or
   a mocked renderer - a large amount of infrastructure standing between the
   tests and a component whose actual decision making has been extracted out.
   Everything this file decides lives in lib/painPicking.js and lib/painRegions.js
   and is thoroughly covered in the node suite. What remains here is glue to
   three.js, and the manual checklist in docs/tasks.md covers it. */

import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { pickRegion } from '../../lib/painPicking.js';
import { normalizeBoneName, regionForBone } from '../../lib/painRegions.js';

export const MODEL_URL = '/models/body.glb';

/* How far a pointer may travel between down and up and still count as a tap.

   Without this, every orbit gesture ends by marking whatever region the finger
   happened to release over - which on a touch screen is most gestures. Touch
   gets a larger allowance than a mouse because fingers roll during a press. */
const TAP_SLOP_MOUSE = 8;
const TAP_SLOP_TOUCH = 12;

/** Collect every skinned mesh in the loaded scene. */
function findSkinnedMeshes(scene) {
  const meshes = [];
  scene.traverse((child) => {
    if (child.isSkinnedMesh && child.geometry?.attributes?.skinIndex) meshes.push(child);
  });
  return meshes;
}

export function PainBodyModel({ onPickRegion, onDiagnostics }) {
  const { scene } = useGLTF(MODEL_URL);
  const pointerStart = useRef(null);

  /* One material for the whole body rather than a tint per marked region.
     Colouring regions individually would mean walking bone weights for every
     vertex in the mesh and writing vertex colours - the same computation the
     picker does, but for hundreds of thousands of vertices instead of three.
     The region list below the canvas already carries which areas are marked and
     how badly, in words, so the model does not need to duplicate it.

     Built during the memo rather than mutated in an effect: the loaded scene is
     shared by useGLTF's cache, so assigning onto its materials would leak into
     every other mount of the same model. */
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (!child.isMesh && !child.isSkinnedMesh) return;
      if (!child.material) return;
      const material = child.material.clone();
      material.color = new THREE.Color('#B9AED6');
      material.roughness = 0.85;
      material.metalness = 0.02;
      child.material = material;
    });
    return clone;
  }, [scene]);

  const meshes = useMemo(() => findSkinnedMeshes(model), [model]);

  /* The only thing the pure picking code needs from three.js: bone names in
     skinIndex order, already stripped of exporter decoration. */
  const boneNames = useMemo(
    () => meshes.map((mesh) => (mesh.skeleton?.bones ?? []).map((b) => normalizeBoneName(b.name))),
    [meshes],
  );

  /* Report what the rig actually contains, once, so a model whose bones this
     app has never seen is a visible diagnostic rather than a body that silently
     ignores every tap. */
  useEffect(() => {
    if (!onDiagnostics) return;
    const all = boneNames.flat();
    onDiagnostics({
      meshCount: meshes.length,
      boneCount: all.length,
      unmapped: all.filter((name) => name && !regionForBone(name)),
      mapped: all.filter((name) => name && regionForBone(name)).length,
    });
  }, [boneNames, meshes, onDiagnostics]);

  function handlePointerDown(event) {
    pointerStart.current = {
      x: event.clientX,
      y: event.clientY,
      touch: event.pointerType === 'touch',
    };
  }

  function handlePointerUp(event) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;

    const slop = start.touch ? TAP_SLOP_TOUCH : TAP_SLOP_MOUSE;
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (moved > slop) return; // an orbit, not a tap

    if (!event.face) return;
    // Only the nearest surface should answer; without this a tap can also
    // register on the far side of the body behind it.
    event.stopPropagation();

    const index = meshes.indexOf(event.object);
    if (index === -1) return;
    const geometry = event.object.geometry;

    /* Front or back, which the skeleton cannot tell us. The hit normal is in
       the mesh's local space; the model faces +Z after the framing rotation
       applied by the canvas, so the sign of the normal's Z is the answer. */
    const facing = event.face.normal ? Math.sign(event.face.normal.z) : 0;

    const region = pickRegion(
      event.face,
      geometry.attributes.skinIndex,
      geometry.attributes.skinWeight,
      boneNames[index],
      facing,
    );

    // A null pick means no region was identified. Write nothing - never fall
    // back to a default region, which would record pain the user never marked.
    if (region) onPickRegion(region);
  }

  return (
    <primitive
      object={model}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    />
  );
}
