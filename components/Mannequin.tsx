
import React from 'react';
import { Bone, type BoneProps } from './Bone'; 
import { ANATOMY, RIGGING } from '../constants';
import { getJointPositions, getTotalRotation } from '../utils/kinematics';
import { PartName, PartSelection, PartVisibility, AnchorName, Pose, JointConstraint, RenderMode, PARENT_MAP, partNameToPoseKey } from '../types';
import { COLORS_BY_CATEGORY } from './Bone'; 

interface MannequinProps {
  pose: Pose;
  showOverlay?: boolean;
  selectedParts: PartSelection;
  visibility: PartVisibility;
  pin: AnchorName;
  className?: string;
  onMouseDownOnPart?: (part: PartName, event: React.MouseEvent<SVGGElement>) => void;
  onHoverOnPart?: (part: PartName) => void;
  onDoubleClickOnPart?: (part: PartName, event: React.MouseEvent<SVGGElement>) => void; 
  onTripleClickOnPart?: (part: PartName) => void;
  onMouseDownOnRoot?: (event: React.MouseEvent<SVGCircleElement>) => void;
  isAirMode: boolean;
  showHighlights?: boolean;
  onToggleCrane: () => void;
  isCraneActive: boolean;
  jointModes: Record<PartName, JointConstraint>; 
  renderMode?: RenderMode; 
  bodyRotation: number; 
}

export const getPartCategory = (part: PartName): string => { 
  switch (part) {
    case PartName.RWrist:
    case PartName.LWrist: return 'hand';
    case PartName.RElbow: 
    case PartName.LElbow: return 'forearm';
    case PartName.RShoulder: 
    case PartName.LShoulder: return 'bicep';
    case PartName.Collar: return 'collar';
    case PartName.Torso: return 'torso';
    case PartName.Waist: return 'waist';
    case PartName.RThigh:
    case PartName.LThigh: return 'thigh';
    case PartName.RSkin: 
    case PartName.LSkin: return 'shin';
    case PartName.RAnkle: 
    case PartName.LAnkle: return 'foot';
    case PartName.Head: return 'head';
    default: return 'default';
  }
};

export const Mannequin: React.FC<MannequinProps> = ({
  pose,
  showOverlay = true,
  selectedParts,
  visibility,
  pin,
  className = "text-ink",
  onMouseDownOnPart,
  onHoverOnPart,
  onDoubleClickOnPart,
  onTripleClickOnPart,
  onMouseDownOnRoot,
  showHighlights = true,
  onToggleCrane,
  isCraneActive,
  jointModes, 
  renderMode = 'default', 
  bodyRotation, 
}) => {
  const joints = getJointPositions(pose, jointModes);
  const offsets = pose.offsets || {};

  const isRightLimb = (part: PartName) => ['rShoulder', 'rElbow', 'rWrist', 'rThigh', 'rSkin', 'rAnkle'].includes(part);
  const isLeftLimb = (part: PartName) => ['lShoulder', 'lElbow', 'lWrist', 'lThigh', 'lSkin', 'lAnkle'].includes(part);

  const PartWrapper = ({ part, children }: { part: PartName; children?: React.ReactNode }) => {
    const isSelected = selectedParts[part];
    const selectionClass = isSelected && showHighlights ? 'text-selection' : '';

    const handleMouseDown = (e: React.MouseEvent<SVGGElement>) => { 
      e.stopPropagation(); 
      if (e.detail === 3) onTripleClickOnPart?.(part);
      else onMouseDownOnPart?.(part, e); 
    };
    
    const handleMouseEnter = (e: React.MouseEvent<SVGGElement>) => { e.stopPropagation(); onHoverOnPart?.(part); };
    const handleDoubleClick = (e: React.MouseEvent<SVGGElement>) => { e.stopPropagation(); onDoubleClickOnPart?.(part, e); }; 

    let darken20Percent = false;
    if (bodyRotation > 0 && bodyRotation <= 180 && isRightLimb(part)) {
      darken20Percent = true;
    }
    else if (bodyRotation < 0 && bodyRotation >= -180 && isLeftLimb(part)) {
      darken20Percent = true;
    }

    return (
      <g className={`cursor-pointer ${selectionClass}`} onMouseDown={handleMouseDown} onMouseEnter={handleMouseEnter} onDoubleClick={handleDoubleClick}>
        {React.Children.map(children, child =>
          React.isValidElement(child) && child.type === Bone
            ? React.cloneElement(child as React.ReactElement<BoneProps>, { darken20Percent: darken20Percent })
            : child
        )}
      </g>
    );
  };

  const ROOT_COLOR = "#708238"; 
  const PIN_INDICATOR_SIZE = ANATOMY.ROOT_SIZE * 0.7; 
  const PIN_INDICATOR_STROKE_COLOR = "#D1D5DB";
  const PIN_INDICATOR_STROKE_WIDTH = 1;

  const collarRotation = getTotalRotation(PartName.Collar, pose);

  return (
    <g className={`mannequin-root ${className}`} transform={`translate(${pose.root.x}, ${pose.root.y}) rotate(${bodyRotation})`}>
      <g 
        onMouseDown={onMouseDownOnRoot} 
        onDoubleClick={(e) => { e.stopPropagation(); onToggleCrane(); }} 
        className={isCraneActive ? 'cursor-ns-resize' : 'cursor-pointer'} 
        data-no-export={true}
      >
        <circle cx="0" cy="0" r={ANATOMY.ROOT_SIZE} fill="currentColor" opacity="0.1" />
        <circle 
          cx="0" cy="0" r={PIN_INDICATOR_SIZE} 
          fill={(isCraneActive || pin === 'root') ? COLORS_BY_CATEGORY.bicep : ROOT_COLOR} 
          stroke={PIN_INDICATOR_STROKE_COLOR} 
          strokeWidth={PIN_INDICATOR_STROKE_WIDTH} 
        />
      </g>

      {renderMode === 'wireframe' && Object.values(PartName).map(childPart => {
        const parentPart = PARENT_MAP[childPart];
        const childJoint = joints[childPart];
        let parentJoint;
        if (childPart === PartName.Waist || childPart === PartName.RThigh || childPart === PartName.LThigh) {
            parentJoint = joints.root;
        } else if (parentPart) {
            parentJoint = joints[parentPart];
        }
        if (parentJoint && childJoint) {
          return (
            <line 
              key={`conn-${parentPart}-${childPart}`}
              x1={parentJoint.x - pose.root.x}
              y1={parentJoint.y - pose.root.y}
              x2={childJoint.x - pose.root.x}
              y2={childJoint.y - pose.root.y}
              stroke={'#9CA3AF'} 
              strokeWidth="2"
              opacity="0.5"
            />
          );
        }
        return null;
      })}

      {pin !== 'root' && joints[pin as keyof typeof joints] && (
        <g transform={`translate(${joints[pin as keyof typeof joints].x - pose.root.x}, ${joints[pin as keyof typeof joints].y - pose.root.y})`} data-no-export={true}>
          <circle cx="0" cy="0" r={ANATOMY.ROOT_SIZE} fill="currentColor" opacity="0.1" />
          <circle 
            cx="0" cy="0" r={PIN_INDICATOR_SIZE} 
            fill={isCraneActive ? COLORS_BY_CATEGORY.bicep : ROOT_COLOR}
            stroke={PIN_INDICATOR_STROKE_COLOR} 
            strokeWidth={PIN_INDICATOR_STROKE_WIDTH} 
          />
        </g>
      )}

      <PartWrapper part={PartName.Waist}>
        <Bone 
          isSelected={selectedParts[PartName.Waist]} 
          constraint={jointModes[PartName.Waist]} 
          rotation={getTotalRotation(PartName.Waist, pose)} 
          length={ANATOMY.WAIST} 
          width={ANATOMY.WAIST_WIDTH} 
          variant="waist-teardrop-pointy-up" 
          drawsUpwards 
          showOverlay={showOverlay} 
          offset={offsets[PartName.Waist]} 
          visible={visibility[PartName.Waist]} 
          partCategory={getPartCategory(PartName.Waist)}
          renderMode={renderMode}
        >
          <PartWrapper part={PartName.Torso}>
            <Bone 
              isSelected={selectedParts[PartName.Torso]} 
              constraint={jointModes[PartName.Torso]} 
              rotation={getTotalRotation(PartName.Torso, pose)} 
              length={ANATOMY.TORSO} 
              width={ANATOMY.TORSO_WIDTH} 
              variant="torso-teardrop-pointy-down" 
              drawsUpwards 
              showOverlay={showOverlay} 
              offset={offsets[PartName.Torso]} 
              visible={visibility[PartName.Torso]} 
              partCategory={getPartCategory(PartName.Torso)}
              renderMode={renderMode}
            >
              <PartWrapper part={PartName.Collar}>
                <g>
                  <Bone 
                    isSelected={selectedParts[PartName.Collar]} 
                    constraint={jointModes[PartName.Collar]} 
                    rotation={collarRotation} 
                    length={ANATOMY.COLLAR} 
                    width={ANATOMY.COLLAR_WIDTH} 
                    variant="collar-horizontal-oval-shape" 
                    drawsUpwards 
                    showOverlay={showOverlay} 
                    partCategory={getPartCategory(PartName.Collar)}
                    offset={offsets[PartName.Collar]} 
                    visible={visibility[PartName.Collar]} 
                    renderMode={renderMode}
                  >
                    <PartWrapper part={PartName.Head}>
                      <Bone 
                        isSelected={selectedParts[PartName.Head]} 
                        constraint={jointModes[PartName.Head]} 
                        rotation={getTotalRotation(PartName.Head, pose)} 
                        length={ANATOMY.HEAD} 
                        width={ANATOMY.HEAD_WIDTH} 
                        variant="head-tall-oval" 
                        drawsUpwards 
                        showOverlay={showOverlay} 
                        offset={offsets[PartName.Head]} 
                        visible={visibility[PartName.Head]} 
                        partCategory={getPartCategory(PartName.Head)}
                        renderMode={renderMode}
                      />
                    </PartWrapper>
                  </Bone>

                  {/* Right Shoulder: Position relative to collar pivot using calculated joint positions */}
                  <g transform={`translate(${joints.rShoulder.x - joints.collar.x}, ${joints.rShoulder.y - joints.collar.y}) rotate(${collarRotation})`}>
                    <PartWrapper part={PartName.RShoulder}>
                      <Bone 
                        isSelected={selectedParts[PartName.RShoulder]} 
                        constraint={jointModes[PartName.RShoulder]} 
                        rotation={getTotalRotation(PartName.RShoulder, pose)} 
                        length={ANATOMY.UPPER_ARM} 
                        width={ANATOMY.LIMB_WIDTH_ARM} 
                        variant="deltoid-shape" 
                        showOverlay={showOverlay} 
                        offset={offsets[PartName.RShoulder]} 
                        visible={visibility[PartName.RShoulder]} 
                        partCategory={getPartCategory(PartName.RShoulder)}
                        renderMode={renderMode}
                      >
                        <PartWrapper part={PartName.RElbow}>
                          <Bone 
                            isSelected={selectedParts[PartName.RElbow]} 
                            constraint={jointModes[PartName.RElbow]} 
                            rotation={getTotalRotation('rForearm', pose)} 
                            length={ANATOMY.LOWER_ARM} 
                            width={ANATOMY.LIMB_WIDTH_FOREARM} 
                            variant="limb-tapered" 
                            showOverlay={showOverlay} 
                            offset={offsets[PartName.RElbow]} 
                            visible={visibility[PartName.RElbow]} 
                            partCategory={getPartCategory(PartName.RElbow)}
                            renderMode={renderMode}
                          >
                            <PartWrapper part={PartName.RWrist}>
                              <Bone 
                                isSelected={selectedParts[PartName.RWrist]} 
                                constraint={jointModes[PartName.RWrist]} 
                                rotation={getTotalRotation(PartName.RWrist, pose)} 
                                length={ANATOMY.HAND} 
                                width={ANATOMY.HAND_WIDTH} 
                                variant="hand-foot-arrowhead-shape" 
                                showOverlay={showOverlay} 
                                offset={offsets[PartName.RWrist]} 
                                visible={visibility[PartName.RWrist]} 
                                partCategory={getPartCategory(PartName.RWrist)}
                                renderMode={renderMode}
                              />
                            </PartWrapper>
                          </Bone>
                        </PartWrapper>
                      </Bone>
                    </PartWrapper>
                  </g>

                  {/* Left Shoulder: Position relative to collar pivot using calculated joint positions */}
                  <g transform={`translate(${joints.lShoulder.x - joints.collar.x}, ${joints.lShoulder.y - joints.collar.y}) rotate(${collarRotation})`}>
                    <PartWrapper part={PartName.LShoulder}>
                      <Bone 
                        isSelected={selectedParts[PartName.LShoulder]} 
                        constraint={jointModes[PartName.LShoulder]} 
                        rotation={getTotalRotation(PartName.LShoulder, pose)} 
                        length={ANATOMY.UPPER_ARM} 
                        width={ANATOMY.LIMB_WIDTH_ARM} 
                        variant="deltoid-shape" 
                        showOverlay={showOverlay} 
                        offset={offsets[PartName.LShoulder]} 
                        visible={visibility[PartName.LShoulder]} 
                        partCategory={getPartCategory(PartName.LShoulder)}
                        renderMode={renderMode}
                      >
                        <PartWrapper part={PartName.LElbow}>
                          <Bone 
                            isSelected={selectedParts[PartName.LElbow]} 
                            constraint={jointModes[PartName.LElbow]} 
                            rotation={getTotalRotation('lForearm', pose)} 
                            length={ANATOMY.LOWER_ARM} 
                            width={ANATOMY.LIMB_WIDTH_FOREARM} 
                            variant="limb-tapered" 
                            showOverlay={showOverlay} 
                            offset={offsets[PartName.LElbow]} 
                            visible={visibility[PartName.LElbow]} 
                            partCategory={getPartCategory(PartName.LElbow)}
                            renderMode={renderMode}
                          >
                            <PartWrapper part={PartName.LWrist}>
                              <Bone 
                                isSelected={selectedParts[PartName.LWrist]} 
                                constraint={jointModes[PartName.LWrist]} 
                                rotation={getTotalRotation(PartName.LWrist, pose)} 
                                length={ANATOMY.HAND} 
                                width={ANATOMY.HAND_WIDTH} 
                                variant="hand-foot-arrowhead-shape" 
                                showOverlay={showOverlay} 
                                offset={offsets[PartName.LWrist]} 
                                visible={visibility[PartName.LWrist]} 
                                partCategory={getPartCategory(PartName.LWrist)}
                                renderMode={renderMode}
                              />
                            </PartWrapper>
                          </Bone>
                        </PartWrapper>
                      </Bone>
                    </PartWrapper>
                  </g>
                </g>
              </PartWrapper>
            </Bone>
          </PartWrapper>
        </Bone>
      </PartWrapper>

      <PartWrapper part={PartName.RThigh}>
        <Bone 
          isSelected={selectedParts[PartName.RThigh]} 
          constraint={jointModes[PartName.RThigh]} 
          rotation={getTotalRotation(PartName.RThigh, pose)} 
          length={ANATOMY.LEG_UPPER} 
          width={ANATOMY.LIMB_WIDTH_THIGH} 
          variant="limb-tapered" 
          showOverlay={showOverlay} 
          offset={offsets[PartName.RThigh]} 
          visible={visibility[PartName.RThigh]} 
          partCategory={getPartCategory(PartName.RThigh)}
          renderMode={renderMode}
        >
          <PartWrapper part={PartName.RSkin}>
            <Bone 
              isSelected={selectedParts[PartName.RSkin]} 
              constraint={jointModes[PartName.RSkin]} 
              rotation={getTotalRotation('rCalf', pose)} 
              length={ANATOMY.LEG_LOWER} 
              width={ANATOMY.LIMB_WIDTH_CALF} 
              variant="limb-tapered" 
              showOverlay={showOverlay} 
              offset={offsets[PartName.RSkin]} 
              visible={visibility[PartName.RSkin]} 
              partCategory={getPartCategory(PartName.RSkin)}
              renderMode={renderMode}
            >
              <PartWrapper part={PartName.RAnkle}>
                <Bone 
                  isSelected={selectedParts[PartName.RAnkle]} 
                  constraint={jointModes[PartName.RAnkle]} 
                  rotation={getTotalRotation(PartName.RAnkle, pose)} 
                  length={ANATOMY.FOOT} 
                  width={ANATOMY.FOOT_WIDTH} 
                  variant="hand-foot-arrowhead-shape" 
                  showOverlay={showOverlay} 
                  offset={offsets[PartName.RAnkle]} 
                  visible={visibility[PartName.RAnkle]} 
                  partCategory={getPartCategory(PartName.RAnkle)}
                  renderMode={renderMode}
                />
              </PartWrapper>
            </Bone>
          </PartWrapper>
        </Bone>
      </PartWrapper>

      <PartWrapper part={PartName.LThigh}>
        <Bone 
          isSelected={selectedParts[PartName.LThigh]} 
          constraint={jointModes[PartName.LThigh]} 
          rotation={getTotalRotation(PartName.LThigh, pose)} 
          length={ANATOMY.LEG_UPPER} 
          width={ANATOMY.LIMB_WIDTH_THIGH} 
          variant="limb-tapered" 
          showOverlay={showOverlay} 
          offset={offsets[PartName.LThigh]} 
          visible={visibility[PartName.LThigh]} 
          partCategory={getPartCategory(PartName.LThigh)}
          renderMode={renderMode}
        >
          <PartWrapper part={PartName.LSkin}>
            <Bone 
              isSelected={selectedParts[PartName.LSkin]} 
              constraint={jointModes[PartName.LSkin]} 
              rotation={getTotalRotation('lCalf', pose)} 
              length={ANATOMY.LEG_LOWER} 
              width={ANATOMY.LIMB_WIDTH_CALF} 
              variant="limb-tapered" 
              showOverlay={showOverlay} 
              offset={offsets[PartName.LSkin]} 
              visible={visibility[PartName.LSkin]} 
              partCategory={getPartCategory(PartName.LSkin)}
              renderMode={renderMode}
            >
              <PartWrapper part={PartName.LAnkle}>
                <Bone 
                  isSelected={selectedParts[PartName.LAnkle]} 
                  constraint={jointModes[PartName.LAnkle]} 
                  rotation={getTotalRotation(PartName.LAnkle, pose)} 
                  length={ANATOMY.FOOT} 
                  width={ANATOMY.FOOT_WIDTH} 
                  variant="hand-foot-arrowhead-shape" 
                  showOverlay={showOverlay} 
                  offset={offsets[PartName.LAnkle]} 
                  visible={visibility[PartName.LAnkle]} 
                  partCategory={getPartCategory(PartName.LAnkle)}
                  renderMode={renderMode}
                />
              </PartWrapper>
            </Bone>
          </PartWrapper>
        </Bone>
      </PartWrapper>
    </g>
  );
};
