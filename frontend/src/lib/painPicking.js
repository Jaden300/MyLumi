/* Turning a raycast hit on a skinned body model into a body region.

   Deliberately free of any three.js import. Everything here operates on plain
   numbers and typed arrays, which is what lets the whole algorithm be tested in
   the node suite against fabricated skin data - no WebGL, no GLB, no canvas.
   The renderer's job is to pull `face`, the two geometry attributes and the
   bone-name array out of three.js and hand them over; the decision is here.

   ## The mechanism

   A skinned mesh weights every vertex to up to four bones (glTF JOINTS_0 /
   WEIGHTS_0). Verified against three.js 0.185.1:

     - `SkinnedMesh.raycast` exists (src/objects/SkinnedMesh.js:178) and applies
       bone transforms via an overridden `getVertexPosition`, so hits land where
       the model is actually posed.
     - The intersection carries `face: {a, b, c}` - the three vertex indices of
       the triangle that was hit (src/objects/Mesh.js:478).
     - `geometry.attributes.skinIndex` and `.skinWeight` are ordinary
       BufferAttributes (SkinnedMesh.js:324-325).

   So: sum each bone's influence across the hit triangle's three vertices, rank,
   and map the winner to a region. */

import {
  JOINT_BLEND_MIN,
  JOINT_MESH_BONES,
  JOINT_PAIRS,
  TORSO_FRONT_BACK,
  regionForBone,
} from './painRegions.js';

/**
 * Total each bone's influence across the three vertices of a hit triangle.
 *
 * Returns `[{ name, weight }]` sorted by descending weight, with weights
 * normalized to sum to 1.
 *
 * @param {{a: number, b: number, c: number}} face vertex indices of the hit triangle
 * @param {{array: ArrayLike<number>, itemSize: number}} skinIndex bone indices, 4 per vertex
 * @param {{array: ArrayLike<number>, itemSize: number}} skinWeight bone weights, 4 per vertex
 * @param {string[]} boneNames normalized bone names, indexed as skinIndex refers to them
 */
export function rankInfluences(face, skinIndex, skinWeight, boneNames) {
  if (!face || !skinIndex?.array || !skinWeight?.array || !boneNames?.length) return [];

  const vertices = [face.a, face.b, face.c].filter((v) => Number.isInteger(v) && v >= 0);
  if (vertices.length === 0) return [];

  const indexStride = skinIndex.itemSize ?? 4;
  const weightStride = skinWeight.itemSize ?? 4;
  const totals = new Map();

  for (const vertex of vertices) {
    for (let lane = 0; lane < weightStride; lane += 1) {
      const weight = skinWeight.array[vertex * weightStride + lane];

      /* Zero-weight lanes MUST be skipped, and this is the single most likely
         silent bug in the feature.

         glTF always stores four influences per vertex and pads the unused ones
         with (index: 0, weight: 0). Bone index 0 is a real bone - on a Mixamo
         rig it is Hips, which maps to the lower back. Counting padding lanes
         would give Hips a vote on every vertex in the model, and a tap on the
         hand would resolve to the lower back. It fails quietly, plausibly, and
         everywhere at once. */
      if (!Number.isFinite(weight) || weight <= 0) continue;

      const bone = skinIndex.array[vertex * indexStride + lane];
      const name = boneNames[bone];
      if (!name) continue;

      totals.set(name, (totals.get(name) ?? 0) + weight);
    }
  }

  if (totals.size === 0) return [];

  /* Normalize. glTF says weights sum to 1 per vertex, but exporters round, and
     the attribute may be a normalized integer type carrying 0-255 or 0-65535
     rather than 0-1. Dividing by the observed total makes JOINT_BLEND_MIN mean
     the same thing regardless, so the threshold is a real proportion rather
     than an artefact of how the file was written. */
  let sum = 0;
  for (const weight of totals.values()) sum += weight;
  if (!(sum > 0)) return [];

  return [...totals.entries()]
    .map(([name, weight]) => ({ name, weight: weight / sum }))
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Resolve ranked bone influences to a region id, or null.
 *
 * @param {{name: string, weight: number}[]} ranked descending, normalized
 * @param {number} [facing] sign of the hit normal along the model's forward
 *   axis: positive is the front of the body, negative the back. Omit when
 *   unknown - the torso then falls back to its bone's default region.
 */
export function resolveRegionFromBones(ranked, facing = 0, onJointMesh = false) {
  if (!ranked?.length) return null;

  const [top, second] = ranked;

  /* A hit on the model's joint geometry, where the model has any. Checked first
     because it is the most specific evidence available: the mesh was authored
     as a joint, so a sphere rigidly bound to the forearm is the elbow, and no
     amount of weight inspection would ever say so. */
  if (onJointMesh) {
    const joint = JOINT_MESH_BONES[top.name];
    if (joint) return joint;
  }

  /* Two bones both strongly influencing the hit means it landed on the joint
     between them, which has no bone of its own. Sorted key so the lookup does
     not care which of the pair ranked first. */
  if (second && second.weight >= JOINT_BLEND_MIN) {
    const joint = JOINT_PAIRS[[top.name, second.name].sort().join('|')];
    if (joint) return joint;
  }

  /* Front/back for the torso only, where one bone drives both faces. */
  if (facing !== 0) {
    const faces = TORSO_FRONT_BACK[top.name];
    if (faces) return facing > 0 ? faces.front : faces.back;
  }

  /* Walk the ranking rather than taking only the winner. A rig may carry twist,
     helper or IK bones that hold real weight but describe no region a person
     would name; falling through to the next genuine influence beats returning
     null and ignoring the tap. */
  for (const candidate of ranked) {
    const region = regionForBone(candidate.name);
    if (region) return region;
  }

  return null;
}

/**
 * Full path from a hit to a region id, or null if nothing maps.
 *
 * Null is a legitimate outcome - a tap on an eyelash bone, or on a model whose
 * bones this app has never heard of. The caller must treat it as "no region was
 * identified" and write nothing, never as a default region.
 */
export function pickRegion(face, skinIndex, skinWeight, boneNames, facing = 0, onJointMesh = false) {
  return resolveRegionFromBones(
    rankInfluences(face, skinIndex, skinWeight, boneNames),
    facing,
    onJointMesh,
  );
}

/* --- per-vertex regions, for highlighting ----------------------------------

   Shading the region under the cursor means knowing, for every vertex, which
   region it belongs to. That is the same resolution `pickRegion` does, but run
   over the whole mesh instead of one triangle.

   Computed ONCE per mesh at load and cached, never per frame. The mapping is a
   property of the model and cannot change while it is on screen, so hovering
   is then a buffer write over a precomputed table rather than a hundred
   thousand bone lookups per pointer-move.

   Two deliberate divergences from the tap path, both because a vertex is not a
   tap:

   - No `facing`. A vertex has a normal, but front and back of the torso are one
     continuous surface with vertices all around it, and shading only the front
     half of the chest would draw a hard seam down the model's side where no
     anatomical boundary exists. So the torso highlights as a whole ring and the
     TAP still resolves front from back. The highlight is a pointer, not the
     answer; the region name in the list is the answer.
   - No joint-mesh path. That depends on which mesh was hit, which is decided
     per mesh here rather than per vertex, so the caller passes it in. */

/** Sentinel for a vertex belonging to no region. Never a valid region index. */
export const NO_REGION = 255;

/**
 * Resolve every vertex in a skinned mesh to an index into `regionIds`.
 *
 * @param {{array: ArrayLike<number>, itemSize: number, count: number}} skinIndex
 * @param {{array: ArrayLike<number>, itemSize: number, count: number}} skinWeight
 * @param {string[]} boneNames normalized, in skinIndex order
 * @param {string[]} regionIds the region vocabulary; results index into this
 * @param {boolean} [onJointMesh] whether this mesh is joint geometry
 * @returns {Uint8Array} one entry per vertex, `NO_REGION` where nothing maps
 */
export function buildVertexRegions(
  skinIndex,
  skinWeight,
  boneNames,
  regionIds,
  onJointMesh = false,
) {
  const count = skinWeight?.count ?? 0;
  const out = new Uint8Array(count).fill(NO_REGION);
  if (!count || !skinIndex?.array || !skinWeight?.array || !boneNames?.length) return out;

  const regionIndex = new Map(regionIds.map((id, i) => [id, i]));

  /* Most vertices in a rigged body share an influence pattern with their
     neighbours - a whole limb binds to one bone at full weight. Keying the
     memo on the raw lanes collapses that to a handful of distinct lookups for
     a mesh with a hundred thousand vertices. */
  const memo = new Map();

  for (let vertex = 0; vertex < count; vertex += 1) {
    // Reuse rankInfluences by presenting the single vertex as a degenerate
    // triangle, so the zero-weight padding guard and the normalization are the
    // same code the tap path uses rather than a second copy of them.
    const face = { a: vertex, b: vertex, c: vertex };
    const key = laneKey(vertex, skinIndex, skinWeight);

    let resolved = memo.get(key);
    if (resolved === undefined) {
      const region = resolveRegionFromBones(
        rankInfluences(face, skinIndex, skinWeight, boneNames),
        0,
        onJointMesh,
      );
      resolved = region !== null && regionIndex.has(region) ? regionIndex.get(region) : NO_REGION;
      memo.set(key, resolved);
    }

    out[vertex] = resolved;
  }

  return out;
}

/** Stable key for one vertex's four influence lanes, for the memo above. */
function laneKey(vertex, skinIndex, skinWeight) {
  const indexStride = skinIndex.itemSize ?? 4;
  const weightStride = skinWeight.itemSize ?? 4;
  let key = '';
  for (let lane = 0; lane < weightStride; lane += 1) {
    const weight = skinWeight.array[vertex * weightStride + lane];
    if (!Number.isFinite(weight) || weight <= 0) continue;
    key += `${skinIndex.array[vertex * indexStride + lane]}:${weight};`;
  }
  return key;
}
