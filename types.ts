
import React from 'react';

export enum PartName {
  Torso = 'torso',
  Waist = 'waist',
  Collar = 'collar',
  Head = 'head',
  RShoulder = 'rShoulder',
  RElbow = 'rElbow',
  RWrist = 'rWrist',
  LShoulder = 'lShoulder',
  LElbow = 'lElbow',
  LWrist = 'lWrist',
  RThigh = 'rThigh',
  RSkin = 'rSkin',
  RAnkle = 'rAnkle',
  LThigh = 'lThigh',
  LSkin = 'lCalf', // Note: mapped to calf in pose key
  LAnkle = 'lAnkle',
}

export const PART_NAMES: PartName[] = Object.values(PartName);

export const partNameToPoseKey: { [key in PartName]: string } = {
  [PartName.Torso]: 'torso',
  [PartName.Waist]: 'waist',
  [PartName.Collar]: 'collar',
  [PartName.Head]: 'head',
  [PartName.RShoulder]: 'rShoulder',
  [PartName.RElbow]: 'rForearm',
  [PartName.RWrist]: 'rWrist',
  [PartName.LShoulder]: 'lShoulder',
  [PartName.LElbow]: 'lForearm',
  [PartName.LWrist]: 'lWrist',
  [PartName.RThigh]: 'rThigh',
  [PartName.RSkin]: 'rCalf',
  [PartName.RAnkle]: 'rAnkle',
  [PartName.LThigh]: 'lThigh',
  [PartName.LSkin]: 'lCalf',
  [PartName.LAnkle]: 'lAnkle',
};

export const PARENT_MAP: { [key in PartName]?: PartName } = {
  [PartName.Torso]: PartName.Waist,
  [PartName.Collar]: PartName.Torso,
  [PartName.Head]: PartName.Collar,
  [PartName.RShoulder]: PartName.Collar,
  [PartName.LShoulder]: PartName.Collar,
  [PartName.RThigh]: PartName.Waist,
  [PartName.LThigh]: PartName.Waist,
  [PartName.RElbow]: PartName.RShoulder,
  [PartName.LElbow]: PartName.LShoulder,
  [PartName.RWrist]: PartName.RElbow,
  [PartName.LWrist]: PartName.LElbow,
  [PartName.RSkin]: PartName.RThigh,
  [PartName.LSkin]: PartName.LThigh,
  [PartName.RAnkle]: PartName.RSkin,
  [PartName.LAnkle]: PartName.LSkin,
};

export const CHILD_MAP: { [key in PartName]?: PartName[] } = (() => {
  const map: { [key in PartName]?: PartName[] } = {};
  PART_NAMES.forEach(child => {
    const parent = PARENT_MAP[child];
    if (parent) {
      if (!map[parent]) map[parent] = [];
      map[parent]!.push(child);
    }
  });
  return map;
})();

export const LIMB_SEQUENCES: { [key: string]: PartName[] } = {
  rArm: [PartName.RShoulder, PartName.RElbow, PartName.RWrist],
  lArm: [PartName.LShoulder, PartName.LElbow, PartName.LWrist],
  rLeg: [PartName.RThigh, PartName.RSkin, PartName.RAnkle],
  lLeg: [PartName.LThigh, PartName.LSkin, PartName.LAnkle],
  core: [PartName.Waist, PartName.Torso, PartName.Collar],
};

export type Vector2D = { x: number; y: number; };
export type Pose = {
  root: Vector2D;
  bodyRotation: number;
  torso: number;
  waist: number;
  collar: number;
  head: number;
  lShoulder: number;
  lForearm: number;
  lWrist: number;
  rShoulder: number;
  rForearm: number;
  rWrist: number;
  lThigh: number;
  lCalf: number;
  lAnkle: number;
  rThigh: number;
  rCalf: number;
  rAnkle: number;
  offsets?: { [key: string]: Vector2D };
};

export type PartVisibility = { [key in PartName]: boolean };
export type PartSelection = { [key in PartName]: boolean };
export type AnchorName = PartName | 'root' | 'lFootTip' | 'rFootTip';

export type JointConstraint = 'fk' | 'stretch' | 'curl' | 'pure-ik' | 'loose' | 'pure';

export type RenderMode = 'default' | 'wireframe' | 'silhouette' | 'grayscale';

export type JointLimits = {
  [key: string]: { min: number; max: number };
};