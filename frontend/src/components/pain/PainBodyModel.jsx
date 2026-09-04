/* The body mesh, and the tap-to-region handler.

   NOT UNIT TESTED, deliberately. jsdom has no WebGL context, so a react-three
   canvas cannot mount there at all, and reaching one would mean headless-gl or
   a mocked renderer - a large amount of infrastructure standing between the
   tests and a component whose actual decision making has been extracted out.
   Everything this file decides lives in lib/painPicking.js and lib/painRegions.js
   and is thoroughly covered in the node suite. What remains here is glue to
   three.js, and the manual checklist in docs/tasks.md covers it. */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { NO_REGION, buildVertexRegions, pickRegion } from '../../lib/painPicking.js';
import {
  JOINT_MESH_PATTERN,
  PAIN_REGION_IDS,
  normalizeBoneName,
  regionForBone,
} from '../../lib/painRegions.js';

export const MODEL_URL = '/models/body.glb';

/* The body's flat base colour, and what a region becomes when the pointer is
   over it or it is already marked.

   Neither highlight is a severity colour. A region shaded red or amber would
   read as the app's own assessment of how bad it is - the model asserting
   something about a body part the user has only just pointed at, and possibly
   rated 1 - and this app does not colour-code clinical meaning it has not been
   told. Both states stay in the body's own violet.

   They differ in direction rather than degree, because they mean different
   things and are frequently on screen together. Hover is a pale lift: momentary,
   follows the pointer, says "this is what a tap would take". Marked is a deeper,
   more saturated violet: settled, persistent, says "this one is recorded". Two
   brightness steps in the same direction would read as a single thing at two
   strengths, which is exactly what they are not. */
const BODY_COLOR = new THREE.Color('#B9AED6');
const HOVER_COLOR = new THREE.Color('#F2EDFB');
const MARKED_COLOR = new THREE.Color('#7C5FD3');

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

export function PainBodyModel({
  onPickRegion,
  onHoverRegion,
  onDiagnostics,
  hoveredRegion,
  markedRegions,
  regionColors,
  readOnly = false,
}) {
  const { scene } = useGLTF(MODEL_URL);
  const pointerStart = useRef(null);

  /* Regions are shaded with per-vertex colours on one material, rather than by
     splitting the body into per-region meshes.

     Splitting would mean rebuilding the geometry - and the model is a single
     skinned mesh whose regions are defined by bone weights, so the split would
     have to be computed anyway. Writing a colour buffer instead keeps one draw
     call and one material, and turns "highlight this region" into a write over
     an array that was resolved once at load.

     Built during the memo rather than mutated in an effect: the loaded scene is
     shared by useGLTF's cache, so assigning onto its materials would leak into
     every other mount of the same model.

     SkeletonUtils.clone, NOT scene.clone(). A plain Object3D clone copies the
     skinned meshes but leaves them bound to the ORIGINAL skeleton's bones, so
     the copy has no working skeleton and renders nothing at all - a blank
     canvas with no error, no warning, and a scene graph that looks correct
     under inspection. SkeletonUtils re-associates each cloned mesh with its
     cloned bones, which is the entire reason that helper exists. */
  const model = useMemo(() => {
    const clone = cloneSkinned(scene);
    clone.traverse((child) => {
      if (!child.isMesh && !child.isSkinnedMesh) return;
      if (!child.material) return;
      const material = child.material.clone();
      material.color = new THREE.Color(0xffffff); // vertex colours carry the hue
      material.vertexColors = true;
      material.roughness = 0.85;
      material.metalness = 0.02;
      child.material = material;

      /* One colour per vertex, initialised to the base body colour. Allocated
         here so it exists before the first frame - adding the attribute later
         forces a shader recompile mid-interaction. */
      const count = child.geometry?.attributes?.position?.count ?? 0;
      if (count > 0 && !child.geometry.attributes.color) {
        const colors = new Float32Array(count * 3);
        for (let i = 0; i < count; i += 1) {
          colors[i * 3] = BODY_COLOR.r;
          colors[i * 3 + 1] = BODY_COLOR.g;
          colors[i * 3 + 2] = BODY_COLOR.b;
        }
        child.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      }
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

  /* Which region each vertex belongs to, resolved once per mesh.

     This is the expensive step - it walks every vertex in the body - and it is
     why hovering is cheap. The result cannot change while the model is
     mounted, so it is computed here and only here. On the shipped mannequin
     this takes a few tens of milliseconds at load, hidden behind the model
     download that already happened. */
  const vertexRegions = useMemo(
    () =>
      meshes.map((mesh, index) =>
        buildVertexRegions(
          mesh.geometry.attributes.skinIndex,
          mesh.geometry.attributes.skinWeight,
          boneNames[index],
          PAIN_REGION_IDS,
          JOINT_MESH_PATTERN.test(mesh.name || ''),
        ),
      ),
    [meshes, boneNames],
  );

  /* Per-region severity colours, when a caller supplies them.

     `regionColors` is `{ regionId: { hex, intensity } }` from lib/painShading.js
     and is what the timeline drives. It takes precedence over the marked violet
     because on the timeline every region shown IS a marked region - painting
     them all one violet would throw away the rating, which is the entire point
     of that screen. Hover still wins over both, so pointing at the body during
     playback keeps naming what is under the pointer.

     Resolved into three.js Colors once per change rather than per vertex; the
     body has enough vertices that parsing a hex string inside the loop is felt. */
  const shading = useMemo(() => {
    if (!regionColors) return null;
    const byIndex = new Map();
    for (const [id, spec] of Object.entries(regionColors)) {
      const index = PAIN_REGION_IDS.indexOf(id);
      if (index < 0 || !spec?.hex) continue;
      byIndex.set(index, {
        color: new THREE.Color(spec.hex),
        intensity: Number.isFinite(spec.intensity) ? spec.intensity : 1,
      });
    }
    return byIndex;
  }, [regionColors]);

  /* Repaint the colour buffer when the hovered, marked or shaded set changes.

     Writes only the vertices whose colour actually differs, then flags the
     attribute for upload. A full rewrite would be correct too, but this runs on
     every pointer-move across a region boundary - and, during timeline
     playback, on every frame - and the body has enough vertices for that to be
     felt on a low-end phone, which is precisely the device this app's users are
     most likely to be holding. */
  useEffect(() => {
    const marked = markedRegions ?? [];
    const hoverIndex = hoveredRegion ? PAIN_REGION_IDS.indexOf(hoveredRegion) : -1;
    const markedIndices = new Set(
      marked.map((id) => PAIN_REGION_IDS.indexOf(id)).filter((i) => i >= 0),
    );
    const scratch = new THREE.Color();

    meshes.forEach((mesh, meshIndex) => {
      const colorAttr = mesh.geometry?.attributes?.color;
      const regions = vertexRegions[meshIndex];
      if (!colorAttr || !regions) return;

      let changed = false;
      for (let vertex = 0; vertex < regions.length; vertex += 1) {
        const region = regions[vertex];
        let target = BODY_COLOR;
        if (region !== NO_REGION) {
          const shade = shading?.get(region);
          if (region === hoverIndex) {
            target = HOVER_COLOR;
          } else if (shade) {
            /* Intensity as a blend from the unlit body toward the severity
               colour, so severity is carried by more than hue alone - a
               requirement of docs/design-system.md, and the thing that keeps
               the timeline readable at minimum brightness. */
            target = scratch.copy(BODY_COLOR).lerp(shade.color, shade.intensity);
          } else if (markedIndices.has(region)) {
            target = MARKED_COLOR;
          }
        }

        const offset = vertex * 3;
        if (
          colorAttr.array[offset] === target.r &&
          colorAttr.array[offset + 1] === target.g &&
          colorAttr.array[offset + 2] === target.b
        ) {
          continue;
        }
        colorAttr.array[offset] = target.r;
        colorAttr.array[offset + 1] = target.g;
        colorAttr.array[offset + 2] = target.b;
        changed = true;
      }

      if (changed) colorAttr.needsUpdate = true;
    });
  }, [meshes, vertexRegions, hoveredRegion, markedRegions, shading]);

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

  /* Resolve a raycast hit to a region. Shared by hover and tap so the thing
     that lights up under the pointer is guaranteed to be the thing a tap
     records - if these drifted apart the highlight would become a lie. */
  const regionForEvent = useCallback(
    (event) => {
      if (!event.face) return null;
      const index = meshes.indexOf(event.object);
      if (index === -1) return null;

      /* Front or back, which the skeleton cannot tell us: one spine bone drives
         both faces of the torso. The surface normal can, and its sign along the
         model's forward axis is the whole answer.

         A Mixamo export faces +Z. Confirmed against the geometry rather than
         assumed - the head is too near-spherical to tell (0.123 vs 0.126 either
         side of the midline), but the feet are not: toes reach +0.172 while the
         heel stops at -0.078. If a future model faces the other way, this sign
         is the one thing to flip. */
      const facing = event.face.normal ? Math.sign(event.face.normal.z) : 0;

      /* Whether this hit landed on the model's joint geometry, for a model that
         has any. On the shipped mannequin the ball joints sit inside the outer
         skin, so a tap always reaches Beta_Surface first and this is always
         false - which is the correct visual behaviour, since you can only tap
         what you can see. It is kept for models that expose joint geometry on
         the surface, where it is the only signal that distinguishes a knee from
         the shin below it. */
      const onJointMesh = JOINT_MESH_PATTERN.test(event.object.name || '');

      return pickRegion(
        event.face,
        event.object.geometry.attributes.skinIndex,
        event.object.geometry.attributes.skinWeight,
        boneNames[index],
        facing,
        onJointMesh,
      );
    },
    [meshes, boneNames],
  );

  function handlePointerMove(event) {
    if (!onHoverRegion) return;
    /* Suppress the highlight mid-orbit. Chasing the pointer across the body
       while the model spins under it is visual noise during a gesture that is
       not about selecting anything, and this app is used by people for whom
       unnecessary motion is a symptom trigger. */
    if (pointerStart.current) return;
    event.stopPropagation();
    onHoverRegion(regionForEvent(event));
  }

  function handlePointerOut() {
    if (onHoverRegion) onHoverRegion(null);
  }

  function handlePointerDown(event) {
    pointerStart.current = {
      x: event.clientX,
      y: event.clientY,
      touch: event.pointerType === 'touch',
    };
    // An orbit starts here; drop the highlight so it does not sit stale on a
    // region the pointer has long since left.
    if (onHoverRegion) onHoverRegion(null);
  }

  function handlePointerUp(event) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;

    /* Read-only mode still orbits and still hovers - it is the timeline, and
       turning the body to see the back of the head is the point of it. What it
       must not do is record pain: a tap on a playback view is someone looking,
       not someone reporting, and writing a rating from it would put a number in
       the clinical record that nobody entered. */
    if (readOnly) return;

    const slop = start.touch ? TAP_SLOP_TOUCH : TAP_SLOP_MOUSE;
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (moved > slop) return; // an orbit, not a tap

    if (!event.face) return;
    // Only the nearest surface should answer; without this a tap can also
    // register on the far side of the body behind it.
    event.stopPropagation();

    const region = regionForEvent(event);

    // A null pick means no region was identified. Write nothing - never fall
    // back to a default region, which would record pain the user never marked.
    if (region) onPickRegion(region);

    /* Show what was just selected. On a touch screen there is no pointer to
       hover, so without this a tap would mark a region with no confirmation on
       the model at all. */
    if (onHoverRegion) onHoverRegion(region);
  }

  return (
    <primitive
      object={model}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
    />
  );
}
