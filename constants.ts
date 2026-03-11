
import { PartName, Pose, Vector2D, JointLimits } from './types';

export const SCALE_FACTOR = 3.5;

export const HEAD_UNIT = 50 * SCALE_FACTOR;

export const ANATOMY = {
  HEAD: 0.9 * HEAD_UNIT,
  HEAD_WIDTH: 0.7 * HEAD_UNIT,
  HEAD_NECK_GAP_OFFSET: 0.1 * HEAD_UNIT,
  COLLAR: 0.45 * HEAD_UNIT, 
  COLLAR_WIDTH: 0.8 * HEAD_UNIT, // Matches Torso Width
  TORSO: 1.3 * HEAD_UNIT,
  TORSO_WIDTH: 0.8 * HEAD_UNIT, 
  WAIST: 0.9 * HEAD_UNIT,
  WAIST_WIDTH: 1.0 * HEAD_UNIT,
  UPPER_ARM: 1.8 * HEAD_UNIT,
  LOWER_ARM: 1.5 * HEAD_UNIT,
  HAND: 0.7 * HEAD_UNIT,
  LEG_UPPER: 2.3 * HEAD_UNIT,
  LEG_LOWER: 1.9 * HEAD_UNIT,
  FOOT: 0.8 * HEAD_UNIT,
  SHOULDER_WIDTH: 1.2 * HEAD_UNIT,
  HIP_WIDTH: 1.0 * HEAD_UNIT,
  ROOT_SIZE: 0.25 * HEAD_UNIT,
  LIMB_WIDTH_ARM: 0.22 * HEAD_UNIT,
  LIMB_WIDTH_FOREARM: 0.18 * HEAD_UNIT,
  LIMB_WIDTH_THIGH: 0.38 * HEAD_UNIT,
  LIMB_WIDTH_CALF: 0.30 * HEAD_UNIT,
  HAND_WIDTH: 0.2 * HEAD_UNIT,
  FOOT_WIDTH: 0.3 * HEAD_UNIT,
  EFFECTOR_WIDTH: 0.15 * HEAD_UNIT,
};

export const RIGGING = {
  L_SHOULDER_X_OFFSET: -ANATOMY.COLLAR_WIDTH / 2, // Exactly at the corner
  R_SHOULDER_X_OFFSET: ANATOMY.COLLAR_WIDTH / 2,  // Exactly at the corner
  SHOULDER_Y_OFFSET_FROM_BASE: 0, // Bottom of the collar
  COLLAR_OFFSET_Y: 0, 
};

export const BEHAVIOR = {
  SMART_PIN_THRESHOLD: 15 * SCALE_FACTOR,
  KINETIC_SNAP_THRESHOLD: 5,
  FLOOR_MAGNETISM: 10 * SCALE_FACTOR,
};

export const FLOOR_HEIGHT = 1000 * SCALE_FACTOR;

export const GROUND_STRIP_HEIGHT = 2 * SCALE_FACTOR;
export const GROUND_STRIP_COLOR = 'rgba(106, 92, 145, 0.5)';

export const T_POSE_ROOT_Y = FLOOR_HEIGHT - (ANATOMY.LEG_UPPER + ANATOMY.LEG_LOWER + ANATOMY.FOOT);

type RotationValues = Omit<Pose, 'root' | 'offsets'>;

export const BASE_ROTATIONS: RotationValues = {
  bodyRotation: 0,
  torso: 0,
  waist: 0,
  collar: 0,
  head: 0,
  lShoulder: 0, 
  lForearm: 0,
  lWrist: 0,
  rShoulder: 0, 
  rForearm: 0,
  rWrist: 0,
  lThigh: 0,
  lCalf: 0,
  lAnkle: 0,
  rThigh: 0,
  rCalf: 0,
  rAnkle: 0,
};

export const RESET_POSE: Pose = {
  root: { x: 0, y: T_POSE_ROOT_Y },
  ...BASE_ROTATIONS,
  offsets: {},
};

// Widened limits to allow full 360 rotation without hard clamping
export const JOINT_LIMITS: JointLimits = {
  [PartName.Waist]: { min: -360, max: 360 }, 
  [PartName.Torso]: { min: -360, max: 360 },
  [PartName.Collar]: { min: -360, max: 360 },
  [PartName.Head]: { min: -360, max: 360 },
  [PartName.RShoulder]: { min: -360, max: 360 }, 
  rForearm: { min: -360, max: 360 },         
  [PartName.RWrist]: { min: -360, max: 360 }, 
  [PartName.LShoulder]: { min: -360, max: 360 }, 
  lForearm: { min: -360, max: 360 },          
  [PartName.LWrist]: { min: -360, max: 360 }, 
  [PartName.RThigh]: { min: -360, max: 360 }, 
  rCalf: { min: -360, max: 360 },           
  [PartName.RAnkle]: { min: -360, max: 360 }, 
  [PartName.LThigh]: { min: -360, max: 360 },
  lCalf: { min: -360, max: 360 },
  [PartName.LAnkle]: { min: -360, max: 360 },
};
