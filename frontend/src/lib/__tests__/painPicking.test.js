import { describe, it, expect } from 'vitest';
import {
  rankInfluences,
  resolveRegionFromBones,
  pickRegion,
  buildVertexRegions,
  NO_REGION,
} from '../painPicking.js';
import { JOINT_BLEND_MIN, PAIN_REGION_IDS } from '../painRegions.js';

/* Fabricated skin data - no three.js, no GLB, no WebGL.

   `perVertex` is one entry per vertex, each a list of [boneIndex, weight] pairs.
   Lists shorter than four lanes are padded exactly the way a glTF exporter pads
   them: (index 0, weight 0). That padding is the point of several tests below. */
function makeSkinData(perVertex, { ArrayType = Float32Array } = {}) {
  const lanes = 4;
  const skinIndex = new Uint16Array(perVertex.length * lanes);
  const skinWeight = new ArrayType(perVertex.length * lanes);

  perVertex.forEach((influences, vertex) => {
    for (let lane = 0; lane < lanes; lane += 1) {
      const [bone, weight] = influences[lane] ?? [0, 0];
      skinIndex[vertex * lanes + lane] = bone;
      skinWeight[vertex * lanes + lane] = weight;
    }
  });

  return {
    skinIndex: { array: skinIndex, itemSize: lanes, count: perVertex.length },
    skinWeight: { array: skinWeight, itemSize: lanes, count: perVertex.length },
  };
}

const FACE = { a: 0, b: 1, c: 2 };

// Index 0 is Hips deliberately: that is where a real Mixamo skeleton puts it,
// and it is what makes the zero-weight padding dangerous.
const BONES = ['Hips', 'LeftArm', 'LeftForeArm', 'LeftHand', 'LeftUpLeg', 'LeftLeg', 'Spine2'];

const rank = (perVertex, opts) => {
  const { skinIndex, skinWeight } = makeSkinData(perVertex, opts);
  return rankInfluences(FACE, skinIndex, skinWeight, BONES);
};

const pick = (perVertex, facing = 0, opts) => {
  const { skinIndex, skinWeight } = makeSkinData(perVertex, opts);
  return pickRegion(FACE, skinIndex, skinWeight, BONES, facing);
};

describe('rankInfluences', () => {
  it('sums one dominant bone across the hit triangle', () => {
    const ranked = rank([[[3, 1]], [[3, 1]], [[3, 1]]]);
    expect(ranked[0].name).toBe('LeftHand');
    expect(ranked[0].weight).toBeCloseTo(1);
  });

  /* The single most likely silent bug in the whole feature.

     glTF pads unused influence lanes with (index 0, weight 0), and bone index 0
     is a real bone - Hips. If padding were counted, Hips would collect a vote
     from every vertex in the model and a tap on the hand would resolve to the
     lower back. It would fail plausibly and everywhere at once, which is the
     worst kind of failure, so it gets an explicit adversarial test. */
  it('ignores zero-weight padding lanes pointing at bone index 0', () => {
    const ranked = rank([[[3, 1]], [[3, 1]], [[3, 1]]]);
    expect(ranked.map((r) => r.name)).not.toContain('Hips');
    expect(ranked).toHaveLength(1);
  });

  it('normalizes weights to sum to 1', () => {
    const ranked = rank([
      [
        [1, 3],
        [2, 1],
      ],
      [
        [1, 3],
        [2, 1],
      ],
      [
        [1, 3],
        [2, 1],
      ],
    ]);
    const total = ranked.reduce((sum, r) => sum + r.weight, 0);
    expect(total).toBeCloseTo(1);
    expect(ranked[0].name).toBe('LeftArm');
    expect(ranked[0].weight).toBeCloseTo(0.75);
  });

  /* Exporters may write weights as normalized integers rather than 0-1 floats.
     Normalizing by the observed total is what makes JOINT_BLEND_MIN a real
     proportion instead of a number that means something different per file. */
  it('ranks unnormalized integer weights identically to floats', () => {
    const asFloats = rank([
      [
        [1, 0.5],
        [2, 0.5],
      ],
      [
        [1, 0.5],
        [2, 0.5],
      ],
      [
        [1, 0.5],
        [2, 0.5],
      ],
    ]);
    const asIntegers = rank(
      [
        [
          [1, 128],
          [2, 127],
        ],
        [
          [1, 128],
          [2, 127],
        ],
        [
          [1, 128],
          [2, 127],
        ],
      ],
      { ArrayType: Uint16Array },
    );
    expect(asIntegers[0].name).toBe(asFloats[0].name);
    expect(asIntegers[0].weight).toBeCloseTo(asFloats[0].weight, 2);
  });

  it('lets the majority of the triangle win when vertices differ', () => {
    const ranked = rank([[[1, 1]], [[1, 1]], [[5, 1]]]);
    expect(ranked[0].name).toBe('LeftArm');
    expect(ranked[0].weight).toBeCloseTo(2 / 3);
  });

  it('returns nothing on malformed input rather than throwing', () => {
    const { skinIndex, skinWeight } = makeSkinData([[[1, 1]]]);
    expect(rankInfluences(null, skinIndex, skinWeight, BONES)).toEqual([]);
    expect(rankInfluences(FACE, null, skinWeight, BONES)).toEqual([]);
    expect(rankInfluences(FACE, skinIndex, null, BONES)).toEqual([]);
    expect(rankInfluences(FACE, skinIndex, skinWeight, [])).toEqual([]);
    expect(rankInfluences({ a: -1, b: -1, c: -1 }, skinIndex, skinWeight, BONES)).toEqual([]);
  });

  it('skips bone indices the name array does not cover', () => {
    const ranked = rank([[[99, 1], [1, 1]], [[1, 1]], [[1, 1]]]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].name).toBe('LeftArm');
  });
});

describe('resolveRegionFromBones', () => {
  it('maps a single dominant bone to its region', () => {
    expect(resolveRegionFromBones([{ name: 'LeftUpLeg', weight: 1 }])).toBe('thigh_l');
  });

  it('reads an even blend of two bones as the joint between them', () => {
    expect(
      resolveRegionFromBones([
        { name: 'LeftArm', weight: 0.5 },
        { name: 'LeftForeArm', weight: 0.5 },
      ]),
    ).toBe('elbow_l');
  });

  it('reads a lopsided blend as the limb, not the joint', () => {
    expect(
      resolveRegionFromBones([
        { name: 'LeftArm', weight: 0.8 },
        { name: 'LeftForeArm', weight: 0.2 },
      ]),
    ).toBe('upperarm_l');
  });

  it('treats JOINT_BLEND_MIN as the boundary', () => {
    const atThreshold = resolveRegionFromBones([
      { name: 'LeftUpLeg', weight: 1 - JOINT_BLEND_MIN },
      { name: 'LeftLeg', weight: JOINT_BLEND_MIN },
    ]);
    const belowThreshold = resolveRegionFromBones([
      { name: 'LeftUpLeg', weight: 1 - JOINT_BLEND_MIN + 0.01 },
      { name: 'LeftLeg', weight: JOINT_BLEND_MIN - 0.01 },
    ]);
    expect(atThreshold).toBe('knee_l');
    expect(belowThreshold).toBe('thigh_l');
  });

  /* A rig may carry twist, helper or IK bones that hold real weight but name no
     region a person would point at. Ignoring the tap would be worse than using
     the next genuine influence. */
  it('falls through an unmapped top influence to the next real one', () => {
    expect(
      resolveRegionFromBones([
        { name: 'LeftForeArmTwist', weight: 0.6 },
        { name: 'LeftForeArm', weight: 0.4 },
      ]),
    ).toBe('forearm_l');
  });

  it('returns null when nothing in the ranking maps', () => {
    expect(
      resolveRegionFromBones([
        { name: 'LeftEye', weight: 0.7 },
        { name: 'RightEye', weight: 0.3 },
      ]),
    ).toBeNull();
    expect(resolveRegionFromBones([])).toBeNull();
    expect(resolveRegionFromBones(null)).toBeNull();
  });

  describe('front and back of the torso', () => {
    it('separates chest from upper back on the same bone', () => {
      const ranked = [{ name: 'Spine2', weight: 1 }];
      expect(resolveRegionFromBones(ranked, 1)).toBe('chest_c');
      expect(resolveRegionFromBones(ranked, -1)).toBe('upperback_c');
    });

    it('separates abdomen from lower back', () => {
      const ranked = [{ name: 'Hips', weight: 1 }];
      expect(resolveRegionFromBones(ranked, 1)).toBe('abdomen_c');
      expect(resolveRegionFromBones(ranked, -1)).toBe('lowerback_c');
    });

    it('falls back to the bone default when facing is unknown', () => {
      expect(resolveRegionFromBones([{ name: 'Spine2', weight: 1 }], 0)).toBe('chest_c');
    });

    it('ignores facing for a limb, where it means nothing', () => {
      const ranked = [{ name: 'LeftUpLeg', weight: 1 }];
      expect(resolveRegionFromBones(ranked, 1)).toBe('thigh_l');
      expect(resolveRegionFromBones(ranked, -1)).toBe('thigh_l');
    });

    it('lets a joint outrank a front/back split', () => {
      // Hip and thigh blending is a hip, whichever way the surface faces.
      expect(
        resolveRegionFromBones(
          [
            { name: 'Hips', weight: 0.55 },
            { name: 'LeftUpLeg', weight: 0.45 },
          ],
          1,
        ),
      ).toBe('hip_l');
    });
  });
});

/* The path for models whose joints are separate geometry rather than blended
   weights. The shipped mannequin is one of those - 94% of its vertices bind to
   a single bone, and nothing anywhere blends an upper and lower limb bone - so
   weight inspection alone can never find its knees and elbows. */
describe('joint geometry', () => {
  it('reads a hit on joint geometry as the joint, not the limb', () => {
    const ranked = [{ name: 'LeftForeArm', weight: 1 }];
    expect(resolveRegionFromBones(ranked, 0, true)).toBe('elbow_l');
    expect(resolveRegionFromBones(ranked, 0, false)).toBe('forearm_l');
  });

  it('maps each limb bone that owns a joint sphere', () => {
    expect(resolveRegionFromBones([{ name: 'RightLeg', weight: 1 }], 0, true)).toBe('knee_r');
    expect(resolveRegionFromBones([{ name: 'LeftUpLeg', weight: 1 }], 0, true)).toBe('hip_l');
  });

  it('falls through for a joint-mesh bone that names no joint', () => {
    // A sphere at the wrist or ankle is still just the hand or the foot.
    expect(resolveRegionFromBones([{ name: 'LeftHand', weight: 1 }], 0, true)).toBe('hand_l');
    expect(resolveRegionFromBones([{ name: 'Spine2', weight: 1 }], 0, true)).toBe('chest_c');
  });

  it('lets joint geometry outrank a front/back split', () => {
    expect(resolveRegionFromBones([{ name: 'LeftUpLeg', weight: 1 }], -1, true)).toBe('hip_l');
  });
});

/* The table that drives the hover highlight. Its correctness matters in a
   quieter way than the tap path: a wrong entry does not record wrong data, it
   shades the wrong part of the body while the user is deciding - which is
   arguably worse, since it invites them to record something they did not mean. */
describe('buildVertexRegions', () => {
  const build = (perVertex, onJointMesh = false) => {
    const { skinIndex, skinWeight } = makeSkinData(perVertex);
    return buildVertexRegions(skinIndex, skinWeight, BONES, PAIN_REGION_IDS, onJointMesh);
  };

  const regionAt = (table, vertex) =>
    table[vertex] === NO_REGION ? null : PAIN_REGION_IDS[table[vertex]];

  it('resolves each vertex independently of its neighbours', () => {
    const table = build([[[3, 1]], [[4, 1]], [[5, 1]]]);
    expect(regionAt(table, 0)).toBe('hand_l');
    expect(regionAt(table, 1)).toBe('thigh_l');
    expect(regionAt(table, 2)).toBe('calf_l');
  });

  it('returns one entry per vertex', () => {
    expect(build([[[3, 1]], [[3, 1]], [[3, 1]], [[3, 1]]])).toHaveLength(4);
  });

  /* The same padding trap as the tap path, in the form that would tint the
     entire body as lower back. */
  it('ignores zero-weight padding rather than marking everything lower back', () => {
    const table = build([[[3, 1]], [[1, 1]]]);
    expect(regionAt(table, 0)).toBe('hand_l');
    expect(regionAt(table, 1)).toBe('upperarm_l');
  });

  it('marks a vertex that maps to nothing as NO_REGION rather than guessing', () => {
    const { skinIndex, skinWeight } = makeSkinData([[[3, 1]], [[3, 1]]]);
    // A bone-name array that covers no mapped region at all.
    const table = buildVertexRegions(
      skinIndex,
      skinWeight,
      ['LeftEye', 'RightEye', 'Jaw', 'Tongue'],
      PAIN_REGION_IDS,
    );
    expect([...table]).toEqual([NO_REGION, NO_REGION]);
  });

  it('reads a blended vertex as the joint, matching the tap path', () => {
    const blend = [
      [4, 0.5],
      [5, 0.5],
    ];
    expect(regionAt(build([blend]), 0)).toBe('knee_l');
  });

  it('honours joint geometry when the mesh is joint geometry', () => {
    expect(regionAt(build([[[5, 1]]], true), 0)).toBe('knee_l');
    expect(regionAt(build([[[5, 1]]], false), 0)).toBe('calf_l');
  });

  /* Every index this writes is used to look up PAIN_REGION_IDS, so one out of
     range would read undefined and shade nothing, silently. */
  it('only ever emits valid region indices or the sentinel', () => {
    const table = build([[[1, 1]], [[3, 1]], [[6, 1]], [[99, 1]]]);
    for (const value of table) {
      expect(value === NO_REGION || PAIN_REGION_IDS[value] !== undefined).toBe(true);
    }
  });

  it('survives missing attributes without throwing', () => {
    expect(buildVertexRegions(null, null, BONES, PAIN_REGION_IDS)).toHaveLength(0);
    const { skinIndex, skinWeight } = makeSkinData([[[3, 1]]]);
    expect([...buildVertexRegions(skinIndex, skinWeight, [], PAIN_REGION_IDS)]).toEqual([
      NO_REGION,
    ]);
  });

  /* The memo is the reason this is affordable at load time. If it ever keyed
     on something unstable, vertices with identical influences would resolve
     separately and the cost would return without any test noticing. */
  it('gives identical influences identical results', () => {
    const table = build([[[3, 1]], [[3, 1]], [[3, 1]]]);
    expect(new Set(table).size).toBe(1);
  });
});

describe('pickRegion', () => {
  it('resolves a hand tap through the full path', () => {
    expect(pick([[[3, 1]], [[3, 1]], [[3, 1]]])).toBe('hand_l');
  });

  it('does not resolve a hand tap to the lower back', () => {
    // The end-to-end form of the zero-weight padding guard.
    expect(pick([[[3, 1]], [[3, 1]], [[3, 1]]])).not.toBe('lowerback_c');
  });

  it('resolves a knee tap from a genuine blend', () => {
    const blend = [
      [4, 0.5],
      [5, 0.5],
    ];
    expect(pick([blend, blend, blend])).toBe('knee_l');
  });

  it('returns null when the model maps nothing, so the caller writes nothing', () => {
    expect(pickRegion(FACE, null, null, [], 0)).toBeNull();
  });
});
