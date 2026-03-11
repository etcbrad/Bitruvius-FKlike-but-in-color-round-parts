
import { ANATOMY, BASE_ROTATIONS, RIGGING } from '../constants';
import { PartName, Pose, Vector2D, JointConstraint } from '../types';

export const lerp = (start: number, end: number, t: number): number => start * (1 - t) + end * t;

export const getShortestAngleDiffDeg = (currentDeg: number, startDeg: number): number => {
  let diff = currentDeg - startDeg;
  diff = ((diff % 360) + 360) % 360; 
  if (diff > 180) diff -= 360;
  return diff;
};

const rad = (deg: number): number => deg * Math.PI / 180;
const deg = (rad: number): number => rad * 180 / Math.PI;
const rotateVec = (x: number, y: number, angleDeg: number): Vector2D => {
  const r = rad(angleDeg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: x * c - y * s, y: x * s + y * c };
};
const addVec = (v1: Vector2D, v2: Vector2D): Vector2D => ({ x: v1.x + v2.x, y: v1.y + v2.y });

export const getTotalRotation = (key: string, pose: Pose): number => (BASE_ROTATIONS[key as keyof typeof BASE_ROTATIONS] || 0) + ((pose as any)[key] || 0);

const calculateBoneGlobalPositions = (
  parentGlobalPos: Vector2D,
  parentGlobalAngle: number,
  boneTotalLocalRotation: number,
  boneLength: number,
  boneOffset: Vector2D = { x: 0, y: 0 },
  isUpwardDrawing: boolean = false
): { globalStartPoint: Vector2D; globalEndPoint: Vector2D; childInheritedGlobalAngle: number } => {
  const rotatedOffset = rotateVec(boneOffset.x, boneOffset.y, parentGlobalAngle);
  const globalStartPoint = addVec(parentGlobalPos, rotatedOffset);
  const boneGlobalAngleForItsBody = parentGlobalAngle + boneTotalLocalRotation;
  const y_direction = isUpwardDrawing ? -1 : 1;
  const boneVector = rotateVec(0, boneLength * y_direction, boneGlobalAngleForItsBody);
  const globalEndPoint = addVec(globalStartPoint, boneVector);
  const childInheritedGlobalAngle = parentGlobalAngle + boneTotalLocalRotation;
  return { globalStartPoint, globalEndPoint, childInheritedGlobalAngle };
};

export const getJointPositions = (pose: Pose, jointModes: Record<PartName, JointConstraint> = {} as any) => {
  const { root } = pose;
  const offsets = pose.offsets || {};
  const bodyRotation = getTotalRotation('bodyRotation', pose);

  // CORE HIERARCHY: Waist -> Torso -> Collar -> Head
  const waistCalc = calculateBoneGlobalPositions(root, bodyRotation, getTotalRotation(PartName.Waist, pose), ANATOMY.WAIST, offsets[PartName.Waist], true);
  const torsoCalc = calculateBoneGlobalPositions(waistCalc.globalEndPoint, waistCalc.childInheritedGlobalAngle, getTotalRotation(PartName.Torso, pose), ANATOMY.TORSO, offsets[PartName.Torso], true);
  const collarCalc = calculateBoneGlobalPositions(torsoCalc.globalEndPoint, torsoCalc.childInheritedGlobalAngle, getTotalRotation(PartName.Collar, pose), ANATOMY.COLLAR, offsets[PartName.Collar], true);
  
  const collarChildAngle = collarCalc.childInheritedGlobalAngle;
  const collarBase = collarCalc.globalStartPoint; 
  const collarEnd = collarCalc.globalEndPoint;     

  // HEAD attaches to collar end (tip)
  const headGapOffset = rotateVec(0, -ANATOMY.HEAD_NECK_GAP_OFFSET, collarChildAngle);
  const headPivot = addVec(collarEnd, headGapOffset);
  const headGlobalAngle = collarChildAngle + getTotalRotation(PartName.Head, pose);
  const headTip = addVec(headPivot, rotateVec(0, -ANATOMY.HEAD, headGlobalAngle));

  const getArmJoints = (isRight: boolean) => {
    const sKey = isRight ? PartName.RShoulder : PartName.LShoulder;
    const shoulderAttachX = isRight ? RIGGING.R_SHOULDER_X_OFFSET : RIGGING.L_SHOULDER_X_OFFSET;
    
    // In Pure mode, turn off collar offsetting (shoulders move with collar rotation)
    const mode = jointModes[sKey] || 'fk';
    const parentAngle = mode === 'pure' ? collarChildAngle : torsoCalc.childInheritedGlobalAngle;
    
    const shoulderAttach = addVec(collarBase, rotateVec(shoulderAttachX, RIGGING.SHOULDER_Y_OFFSET_FROM_BASE, parentAngle));
    
    const upperArmCalc = calculateBoneGlobalPositions(shoulderAttach, collarChildAngle, getTotalRotation(sKey, pose), ANATOMY.UPPER_ARM, offsets[sKey], false);
    const forearmCalc = calculateBoneGlobalPositions(upperArmCalc.globalEndPoint, upperArmCalc.childInheritedGlobalAngle, getTotalRotation(isRight ? 'rForearm' : 'lForearm', pose), ANATOMY.LOWER_ARM, offsets[isRight ? PartName.RElbow : PartName.LElbow], false);
    const handGlobalAngle = forearmCalc.childInheritedGlobalAngle + getTotalRotation(isRight ? PartName.RWrist : PartName.LWrist, pose);
    const handTip = addVec(forearmCalc.globalEndPoint, rotateVec(0, ANATOMY.HAND, handGlobalAngle));
    return { shoulder: shoulderAttach, elbow: upperArmCalc.globalEndPoint, wrist: forearmCalc.globalEndPoint, hand: handTip };
  };

  const getLegJoints = (isRight: boolean) => {
    const tKey = isRight ? PartName.RThigh : PartName.LThigh;
    // PARENTING FIX: Legs now start from root but inherit the bodyRotation and potentially waist movement 
    // Actually, legs attach to the hips/waist base. 
    const thighCalc = calculateBoneGlobalPositions(root, bodyRotation, getTotalRotation(tKey, pose), ANATOMY.LEG_UPPER, offsets[tKey], false);
    const calfCalc = calculateBoneGlobalPositions(thighCalc.globalEndPoint, thighCalc.childInheritedGlobalAngle, getTotalRotation(isRight ? 'rCalf' : 'lCalf', pose), ANATOMY.LEG_LOWER, offsets[isRight ? PartName.RSkin : PartName.LSkin], false);
    const ankleGlobalAngle = calfCalc.childInheritedGlobalAngle + getTotalRotation(isRight ? PartName.RAnkle : PartName.LAnkle, pose);
    const footTip = addVec(calfCalc.globalEndPoint, rotateVec(0, ANATOMY.FOOT, ankleGlobalAngle));
    return { hip: root, knee: thighCalc.globalEndPoint, ankle: calfCalc.globalEndPoint, footTip };
  };

  const rArm = getArmJoints(true);
  const lArm = getArmJoints(false);
  const rLeg = getLegJoints(true);
  const lLeg = getLegJoints(false);

  return {
    root,
    waist: root,
    torso: waistCalc.globalEndPoint,
    collar: torsoCalc.globalEndPoint,
    head: headPivot,
    rShoulder: rArm.shoulder,
    rElbow: rArm.elbow,
    rWrist: rArm.wrist,
    lShoulder: lArm.shoulder,
    lElbow: lArm.elbow,
    lWrist: lArm.wrist,
    rThigh: root,
    [PartName.RSkin]: rLeg.knee,
    rAnkle: rLeg.ankle,
    lThigh: root,
    [PartName.LSkin]: lLeg.knee,
    lAnkle: lLeg.ankle,
    headTip,
    rFootTip: rLeg.footTip,
    lFootTip: lLeg.footTip,
    rHandTip: rArm.hand,
    lHandTip: lArm.hand,
  };
};

export const getPartGlobalAngles = (pose: Pose) => {
  const angles: { [key: string]: number } = {};
  const bodyRotation = getTotalRotation('bodyRotation', pose);
  const waistGlobal = bodyRotation + getTotalRotation(PartName.Waist, pose);
  const torsoGlobal = waistGlobal + getTotalRotation(PartName.Torso, pose);
  const collarGlobal = torsoGlobal + getTotalRotation(PartName.Collar, pose);
  angles[PartName.Waist] = waistGlobal;
  angles[PartName.Torso] = torsoGlobal;
  angles[PartName.Collar] = collarGlobal;
  angles[PartName.Head] = collarGlobal + getTotalRotation(PartName.Head, pose);

  const processArm = (isRight: boolean) => {
    const sKey = isRight ? PartName.RShoulder : PartName.LShoulder;
    const fKey = isRight ? 'rForearm' : 'lForearm';
    const wKey = isRight ? PartName.RWrist : PartName.LWrist;
    const sAngle = collarGlobal + getTotalRotation(sKey, pose);
    const fAngle = sAngle + getTotalRotation(fKey, pose);
    const wAngle = fAngle + getTotalRotation(wKey, pose);
    angles[sKey] = sAngle;
    angles[isRight ? PartName.RElbow : PartName.LElbow] = fAngle;
    angles[wKey] = wAngle;
  };
  processArm(true);
  processArm(false);

  const processLeg = (isRight: boolean) => {
    const tKey = isRight ? PartName.RThigh : PartName.LThigh;
    const cKey = isRight ? 'rCalf' : 'lCalf';
    const aKey = isRight ? PartName.RAnkle : PartName.LAnkle;
    // Leg rotation is relative to bodyRotation (root)
    const tAngle = bodyRotation + getTotalRotation(tKey, pose);
    const cAngle = tAngle + getTotalRotation(cKey, pose);
    const aAngle = cAngle + getTotalRotation(aKey, pose);
    angles[tKey] = tAngle;
    angles[isRight ? PartName.RSkin : PartName.LSkin] = cAngle;
    angles[aKey] = aAngle;
  };
  processLeg(true);
  processLeg(false);

  return angles;
};

export const solveArmIK = (target: Vector2D, isRight: boolean, pose: Pose, jointModes: Record<PartName, JointConstraint> = {} as any) => {
  const joints = getJointPositions(pose, jointModes);
  const sPos = isRight ? joints.rShoulder : joints.lShoulder;
  const l1 = ANATOMY.UPPER_ARM;
  const l2 = ANATOMY.LOWER_ARM;
  const dx = target.x - sPos.x;
  const dy = target.y - sPos.y;
  const distSq = dx * dx + dy * dy;
  const dist = Math.sqrt(distSq);
  const MAX_ARM_DIST = l1 + l2 + 5;
  if (dist > MAX_ARM_DIST || dist < Math.abs(l1 - l2)) return null; 

  const angleToTarget = Math.atan2(dy, dx);
  const sAngleTri = Math.acos((l1 * l1 + distSq - l2 * l2) / (2 * l1 * dist));
  const eAngleTri = Math.acos((l1 * l1 + l2 * l2 - distSq) / (2 * l1 * l2));

  const sGlobal = angleToTarget - sAngleTri;
  const fLocal = Math.PI - eAngleTri; 

  const collarAngle = getPartGlobalAngles(pose)[PartName.Collar];
  return {
    shoulder: deg(sGlobal) - collarAngle - BASE_ROTATIONS[isRight ? PartName.RShoulder : PartName.LShoulder],
    forearm: deg(fLocal) - BASE_ROTATIONS[isRight ? 'rForearm' : 'lForearm']
  };
};

export const solveLegIK = (target: Vector2D, isRight: boolean, pose: Pose, jointModes: Record<PartName, JointConstraint> = {} as any) => {
  const joints = getJointPositions(pose, jointModes);
  const hPos = isRight ? joints.rThigh : joints.lThigh;
  const l1 = ANATOMY.LEG_UPPER;
  const l2 = ANATOMY.LEG_LOWER;
  const dx = target.x - hPos.x;
  const dy = target.y - hPos.y;
  const distSq = dx * dx + dy * dy;
  const dist = Math.sqrt(distSq);
  const MAX_LEG_DIST = l1 + l2 + 5;
  if (dist > MAX_LEG_DIST || dist < Math.abs(l1 - l2)) return null; 

  const angleToTarget = Math.atan2(dy, dx);
  const tAngleTri = Math.acos((l1 * l1 + distSq - l2 * l2) / (2 * l1 * dist));
  const kAngleTri = Math.acos((l1 * l1 + l2 * l2 - distSq) / (2 * l1 * l2));

  const tGlobal = angleToTarget - tAngleTri;
  const cLocal = Math.PI - kAngleTri; 

  const bodyRot = getTotalRotation('bodyRotation', pose);
  return {
    thigh: deg(tGlobal) - bodyRot - BASE_ROTATIONS[isRight ? PartName.RThigh : PartName.LThigh],
    calf: deg(cLocal) - BASE_ROTATIONS[isRight ? 'rCalf' : 'lCalf']
  };
};
