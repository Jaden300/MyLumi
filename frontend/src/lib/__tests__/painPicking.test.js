import { describe, it, expect } from 'vitest';
import { rankInfluences, resolveRegionFromBones, pickRegion } from '../painPicking.js';
import { JOINT_BLEND_MIN } from '../painRegions.js';

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
    skinIndex: { array: skinIndex, itemSize: lanes },
    skinWeight: { array: skinWeight, itemSize: lanes },
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
