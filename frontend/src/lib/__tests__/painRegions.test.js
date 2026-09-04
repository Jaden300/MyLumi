import { describe, it, expect } from 'vitest';
import {
  PAIN_REGIONS,
  PAIN_REGION_IDS,
  PAIN_REGION_BY_ID,
  PAIN_REGION_GROUPS,
  BONE_TO_REGION,
  BONE_PREFIX_RULES,
  JOINT_PAIRS,
  TORSO_FRONT_BACK,
  normalizeBoneName,
  regionForBone,
  formatRegionLabel,
} from '../painRegions.js';

describe('normalizeBoneName', () => {
  it('strips the standard mixamorig prefix', () => {
    expect(normalizeBoneName('mixamorig:LeftForeArm')).toBe('LeftForeArm');
  });

  it('strips numbered prefixes, which Blender emits on a re-import', () => {
    expect(normalizeBoneName('mixamorig1:Spine2')).toBe('Spine2');
    expect(normalizeBoneName('mixamorig7:Hips')).toBe('Hips');
  });

  it('strips the underscore variant used where colons are avoided', () => {
    expect(normalizeBoneName('mixamorig_RightUpLeg')).toBe('RightUpLeg');
  });

  it("strips Blender's duplicate suffix", () => {
    expect(normalizeBoneName('LeftHand.001')).toBe('LeftHand');
  });

  it('strips a prefix and a suffix together', () => {
    expect(normalizeBoneName('mixamorig2:RightLeg.003')).toBe('RightLeg');
  });

  it('leaves an already clean name alone', () => {
    expect(normalizeBoneName('Neck')).toBe('Neck');
  });

  it('is total on junk rather than throwing', () => {
    // A model with a malformed skeleton must not crash a check-in.
    expect(normalizeBoneName('')).toBe('');
    expect(normalizeBoneName(null)).toBe('');
    expect(normalizeBoneName(undefined)).toBe('');
    expect(normalizeBoneName(42)).toBe('');
    expect(normalizeBoneName({})).toBe('');
  });

  it('does not strip a bone that merely starts with similar letters', () => {
    expect(normalizeBoneName('mixamorigami')).toBe('ami');
    expect(normalizeBoneName('Mixed:Thing')).toBe('Mixed:Thing');
  });
});

describe('region vocabulary', () => {
  it('has unique ids', () => {
    expect(new Set(PAIN_REGION_IDS).size).toBe(PAIN_REGION_IDS.length);
  });

  it('ends every id with a side marker, so parsing the side is total', () => {
    for (const id of PAIN_REGION_IDS) {
      expect(id).toMatch(/_(l|r|c)$/);
    }
  });

  it('gives every region a label and a group', () => {
    for (const region of PAIN_REGIONS) {
      expect(region.label.length).toBeGreaterThan(0);
      expect(PAIN_REGION_GROUPS).toContain(region.group);
    }
  });

  it('indexes every region by id', () => {
    expect(Object.keys(PAIN_REGION_BY_ID)).toHaveLength(PAIN_REGIONS.length);
  });

  /* Pinned because the count is quoted in prose - the About page copy, the
     docs, and several source comments all state a number. It had already
     drifted once: the taxonomy went to 28 while four places still said 29.
     A number repeated in prose needs one assertion holding it, or the prose
     silently becomes wrong. Changing the taxonomy should fail here and send
     you to update the copy with it. */
  it('has exactly 28 regions, the number the copy and docs quote', () => {
    expect(PAIN_REGIONS).toHaveLength(28);
  });

  it('formats a known id and falls back visibly on an unknown one', () => {
    expect(formatRegionLabel('thigh_r')).toBe('Right thigh');
    expect(formatRegionLabel('nonsense')).toBe('nonsense');
  });
});

/* The highest-value tests in this file.

   Every lookup table points at a region id by hand-written string. A typo puts
   an id into storage that sanitizePain does not recognise and therefore drops -
   so the user rates a region, presses next, and their answer vanishes with no
   error anywhere. These assertions turn that into a failing test instead. */
describe('mapping tables point only at real regions', () => {
  it('BONE_TO_REGION', () => {
    for (const [bone, region] of Object.entries(BONE_TO_REGION)) {
      expect(PAIN_REGION_IDS, `${bone} maps to an unknown region`).toContain(region);
    }
  });

  it('BONE_PREFIX_RULES', () => {
    for (const [prefix, region] of BONE_PREFIX_RULES) {
      expect(PAIN_REGION_IDS, `${prefix} maps to an unknown region`).toContain(region);
    }
  });

  it('JOINT_PAIRS', () => {
    for (const [pair, region] of Object.entries(JOINT_PAIRS)) {
      expect(PAIN_REGION_IDS, `${pair} maps to an unknown region`).toContain(region);
    }
  });

  it('TORSO_FRONT_BACK', () => {
    for (const [bone, faces] of Object.entries(TORSO_FRONT_BACK)) {
      expect(PAIN_REGION_IDS, `${bone} front maps to an unknown region`).toContain(faces.front);
      expect(PAIN_REGION_IDS, `${bone} back maps to an unknown region`).toContain(faces.back);
    }
  });

  it('keys JOINT_PAIRS by a sorted bone pair, so lookup is order independent', () => {
    for (const key of Object.keys(JOINT_PAIRS)) {
      const parts = key.split('|');
      expect(parts).toHaveLength(2);
      expect(parts).toEqual([...parts].sort());
    }
  });
});

describe('every region is reachable', () => {
  it('leaves no region the user can never select', () => {
    const reachable = new Set([
      ...Object.values(BONE_TO_REGION),
      ...BONE_PREFIX_RULES.map(([, region]) => region),
      ...Object.values(JOINT_PAIRS),
      ...Object.values(TORSO_FRONT_BACK).flatMap((f) => [f.front, f.back]),
    ]);
    const orphans = PAIN_REGION_IDS.filter((id) => !reachable.has(id));
    expect(orphans, 'regions offered but unreachable by any bone').toEqual([]);
  });
});

describe('regionForBone', () => {
  it('resolves exact bone names', () => {
    expect(regionForBone('LeftUpLeg')).toBe('thigh_l');
    expect(regionForBone('RightLeg')).toBe('calf_r');
    expect(regionForBone('Spine2')).toBe('chest_c');
  });

  it('collapses the twenty-odd finger bones onto the hand', () => {
    expect(regionForBone('LeftHandThumb1')).toBe('hand_l');
    expect(regionForBone('LeftHandPinky4')).toBe('hand_l');
    expect(regionForBone('RightHandIndex2')).toBe('hand_r');
  });

  it('collapses toe bones onto the foot', () => {
    expect(regionForBone('LeftToeBase')).toBe('foot_l');
    expect(regionForBone('RightToe_End')).toBe('foot_r');
  });

  it('returns null for a bone that describes no region', () => {
    expect(regionForBone('LeftEye')).toBeNull();
    expect(regionForBone('IKTarget')).toBeNull();
    expect(regionForBone('')).toBeNull();
    expect(regionForBone(null)).toBeNull();
  });

  it('does not confuse thigh and shin, which Mixamo names counterintuitively', () => {
    // UpLeg is the thigh; Leg is the shin. Getting this backwards would put
    // every knee complaint on the wrong half of the leg.
    expect(regionForBone('LeftUpLeg')).toBe('thigh_l');
    expect(regionForBone('LeftLeg')).toBe('calf_l');
  });
});
