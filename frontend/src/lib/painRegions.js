/* Body regions for the pain map, and the rig-bone mapping that resolves a tap
   into one of them. See docs/data-schema.md.

   ## Why the rig is the segmentation

   Free rigged human models are ONE SkinnedMesh, not fifty per-part meshes, so
   attaching a click handler per body part is not available. Nor is there a
   pre-segmented body-REGION model to download: BodyParts3D and Z-Anatomy are
   segmented anatomically - individual femurs, muscles, organs - which is a
   different carving from the fleshy areas a person points at when asked where
   they ache.

   But a rigged model already carries a segmentation: every vertex is weighted
   to the bones that move it. A tap on the shin is a tap on vertices dominated
   by the shin bone. So the skeleton supplies the regions for free, and this
   file is the table that turns a bone name into something a person would say.

   ## The ID vocabulary is frozen

   Once a night is stored with `thigh_r`, that string is in the clinical record.
   Renaming it needs a migration. Adding a NEW id is free; changing an existing
   one is not. */

/* `<part>_<detail?>_<side>`, side always last and always present, so
   `id.split('_').at(-1)` is total - no undefined branch in a label formatter.
   `_c` is the midline (centre), used where left/right is not meaningful. */
export const PAIN_REGIONS = [
  { id: 'head_front_c', label: 'Forehead', group: 'Head and neck' },
  { id: 'head_back_c', label: 'Back of head', group: 'Head and neck' },
  { id: 'neck_c', label: 'Neck', group: 'Head and neck' },

  { id: 'shoulder_l', label: 'Left shoulder', group: 'Arms' },
  { id: 'shoulder_r', label: 'Right shoulder', group: 'Arms' },
  { id: 'upperarm_l', label: 'Left upper arm', group: 'Arms' },
  { id: 'upperarm_r', label: 'Right upper arm', group: 'Arms' },
  { id: 'elbow_l', label: 'Left elbow', group: 'Arms' },
  { id: 'elbow_r', label: 'Right elbow', group: 'Arms' },
  { id: 'forearm_l', label: 'Left forearm', group: 'Arms' },
  { id: 'forearm_r', label: 'Right forearm', group: 'Arms' },
  { id: 'hand_l', label: 'Left hand', group: 'Arms' },
  { id: 'hand_r', label: 'Right hand', group: 'Arms' },

  { id: 'chest_c', label: 'Chest', group: 'Torso' },
  { id: 'upperback_c', label: 'Upper back', group: 'Torso' },
  { id: 'abdomen_c', label: 'Abdomen', group: 'Torso' },
  { id: 'midback_c', label: 'Mid back', group: 'Torso' },
  { id: 'lowerback_c', label: 'Lower back', group: 'Torso' },
  { id: 'hip_l', label: 'Left hip', group: 'Torso' },
  { id: 'hip_r', label: 'Right hip', group: 'Torso' },

  { id: 'thigh_l', label: 'Left thigh', group: 'Legs' },
  { id: 'thigh_r', label: 'Right thigh', group: 'Legs' },
  { id: 'knee_l', label: 'Left knee', group: 'Legs' },
  { id: 'knee_r', label: 'Right knee', group: 'Legs' },
  { id: 'calf_l', label: 'Left calf', group: 'Legs' },
  { id: 'calf_r', label: 'Right calf', group: 'Legs' },
  { id: 'foot_l', label: 'Left foot', group: 'Legs' },
  { id: 'foot_r', label: 'Right foot', group: 'Legs' },
];

export const PAIN_REGION_IDS = PAIN_REGIONS.map((r) => r.id);

export const PAIN_REGION_BY_ID = Object.fromEntries(PAIN_REGIONS.map((r) => [r.id, r]));

/* Ordered, unique. The region list and the history card both iterate this so
   they group identically without either one owning the order. */
export const PAIN_REGION_GROUPS = [...new Set(PAIN_REGIONS.map((r) => r.group))];

export const PAIN_MIN = 0;
export const PAIN_MAX = 10;
/* Ratings move in half points. A person can tell 6 from 7; nobody can tell 6.2
   from 6.4, and storing that precision would claim a measurement we do not have.
   Half steps are the finest granularity a self-report can honestly carry. */
export const PAIN_STEP = 0.5;

/* --- bone mapping ----------------------------------------------------------

   Mixamo's standard humanoid rig. Two naming quirks to know:
     - `UpLeg` is the thigh and `Leg` is the shin. Not upper/lower leg.
     - `Spine`, `Spine1`, `Spine2` run bottom to top, so Spine2 is the chest. */

export const BONE_TO_REGION = {
  Head: 'head_front_c',
  HeadTop_End: 'head_front_c',
  Neck: 'neck_c',

  Spine2: 'chest_c',
  Spine1: 'midback_c',
  Spine: 'abdomen_c',
  Hips: 'lowerback_c',

  LeftShoulder: 'shoulder_l',
  RightShoulder: 'shoulder_r',
  LeftArm: 'upperarm_l',
  RightArm: 'upperarm_r',
  LeftForeArm: 'forearm_l',
  RightForeArm: 'forearm_r',
  LeftHand: 'hand_l',
  RightHand: 'hand_r',

  LeftUpLeg: 'thigh_l',
  RightUpLeg: 'thigh_r',
  LeftLeg: 'calf_l',
  RightLeg: 'calf_r',
  LeftFoot: 'foot_l',
  RightFoot: 'foot_r',
};

/* Checked only after an exact match misses, longest prefix first.

   A Mixamo hand carries around twenty bones (LeftHandThumb1 .. LeftHandPinky4)
   and nobody rating post-concussion pain needs to distinguish a middle finger
   from a ring finger. One rule collapses the lot. Toe bones likewise fold into
   the foot. */
export const BONE_PREFIX_RULES = [
  ['LeftHand', 'hand_l'],
  ['RightHand', 'hand_r'],
  ['LeftToe', 'foot_l'],
  ['RightToe', 'foot_r'],
  ['LeftFoot', 'foot_l'],
  ['RightFoot', 'foot_r'],
];

/* Joints have no bone of their own - a knee IS the boundary between two bones,
   and the vertices there are weighted between both. So a hit with two strong
   influences is a hit on the joint between them, and the pair identifies which.

   Keyed by the two bone names sorted and joined, so lookup does not depend on
   which of the two happened to rank first. */
export const JOINT_PAIRS = {
  'LeftArm|LeftForeArm': 'elbow_l',
  'RightArm|RightForeArm': 'elbow_r',
  'LeftForeArm|LeftHand': 'forearm_l',
  'RightForeArm|RightHand': 'forearm_r',
  'LeftLeg|LeftUpLeg': 'knee_l',
  'RightLeg|RightUpLeg': 'knee_r',
  'Hips|LeftUpLeg': 'hip_l',
  'Hips|RightUpLeg': 'hip_r',
};

/* How much weight the second-ranked bone needs before a hit counts as being on
   the joint rather than on the limb.

   PROVISIONAL - this is the one constant here set by reasoning rather than by
   measurement, because it depends on how the model's weights were painted.
   Tight weighting may never reach it, putting knees and elbows out of reach;
   soft weighting may fire it halfway up the forearm. Tune against the real
   model, then delete this paragraph and say what it was measured at. */
export const JOINT_BLEND_MIN = 0.35;

/* Front and back cannot come from the rig: one spine bone drives both faces of
   the torso, so a tap on the chest and a tap between the shoulder blades reach
   the identical bone. The head has the same problem - forehead and occiput are
   one bone. Geometry answers what the skeleton cannot: the surface normal at
   the hit points forward or backward, and that is unambiguous.

   Only the midline needs this. A forearm is a forearm from either side.

   Note the head entry is what makes `head_back_c` reachable at all. Without it
   the app would offer "Back of head" and then have no way to select it - a gap
   the reachability test in painRegions.test.js exists to catch, and did. */
export const TORSO_FRONT_BACK = {
  Head: { front: 'head_front_c', back: 'head_back_c' },
  HeadTop_End: { front: 'head_front_c', back: 'head_back_c' },
  Spine2: { front: 'chest_c', back: 'upperback_c' },
  Spine1: { front: 'abdomen_c', back: 'midback_c' },
  Spine: { front: 'abdomen_c', back: 'midback_c' },
  Hips: { front: 'abdomen_c', back: 'lowerback_c' },
};

/**
 * Strip exporter decoration from a bone name so the tables above can stay
 * written in plain Mixamo names.
 *
 * This is the highest-risk function in the feature. Every downstream lookup is
 * an exact string match, so an unrecognised decoration means zero regions map
 * and every tap silently does nothing - no error, no crash, just a body that
 * ignores you. The variants handled:
 *
 *   `mixamorig:LeftArm`   the standard Mixamo export
 *   `mixamorig1:LeftArm`  Blender's numbering when a rig is imported twice
 *   `mixamorig_LeftArm`   pipelines that avoid ':' in glTF node names
 *   `LeftArm.001`         Blender's duplicate-name suffix
 */
export function normalizeBoneName(name) {
  if (typeof name !== 'string') return '';
  return name
    .replace(/^mixamorig\d*[:_]?/i, '')
    .replace(/\.\d{3}$/, '')
    .trim();
}

/** Region id for a normalized bone name, or null if the bone maps to nothing. */
export function regionForBone(name) {
  if (!name) return null;
  if (BONE_TO_REGION[name]) return BONE_TO_REGION[name];
  for (const [prefix, region] of BONE_PREFIX_RULES) {
    if (name.startsWith(prefix)) return region;
  }
  return null;
}

/** Human label for a region id. Falls back to the id so a stray value is visible. */
export function formatRegionLabel(id) {
  return PAIN_REGION_BY_ID[id]?.label ?? id;
}
