
import React, { useMemo } from 'react';
import { Vector2D, JointConstraint, RenderMode, PartName } from '../types';
import { ANATOMY } from '../constants';
import { adjustBrightness } from '../utils/color-utils';

export interface BoneProps {
  rotation: number;
  length: number;
  width?: number;
  variant?: 'diamond' | 'waist-teardrop-pointy-up' | 'torso-teardrop-pointy-down' | 'collar-horizontal-oval-shape' | 'deltoid-shape' | 'limb-tapered' | 'head-tall-oval' | 'hand-foot-arrowhead-shape';
  showOverlay?: boolean;
  visible?: boolean;
  offset?: Vector2D;
  className?: string;
  children?: React.ReactNode;
  drawsUpwards?: boolean;
  fillOverride?: string; 
  isSelected?: boolean;
  constraint?: JointConstraint;
  renderMode?: RenderMode;
  partCategory?: string; 
  darken20Percent?: boolean; 
}

const COLORS = {
  GREEN_CURL: "#A3E635", 
  PURPLE_STRETCH: "#8B7EC1", 
  ANCHOR_RED: "#F87171", 
  SELECTION: "#FACC15", 
  RIDGE: "#333333", 
  PIN_HIGHLIGHT: "#A3E635", 

  LIGHT_PURPLE_HEAD_HAND_FOOT: "#E0B0FF",
  PALE_GREEN_BICEP: "#90EE90",
  MEDIUM_AQUAMARINE_FOREARM: "#66CDAA",
  BLUE_VIOLET_THIGH: "#8A2BE2", 
  
  OLIVE_COLLAR: "#4d7c0f", // Updated to a more vibrant, richer green
  SEA_GREEN_WAIST: adjustBrightness("#8A2BE2", 0.95), 
  MEDIUM_SEA_GREEN_TORSO: adjustBrightness("#8A2BE2", 0.90),
  
  DARK_MAGENTA_SHIN: "#9370DB", 

  DEFAULT_FILL: "#000000",
};

export const COLORS_BY_CATEGORY: { [category: string]: string } = {
  head: COLORS.LIGHT_PURPLE_HEAD_HAND_FOOT,
  hand: COLORS.LIGHT_PURPLE_HEAD_HAND_FOOT,
  foot: COLORS.LIGHT_PURPLE_HEAD_HAND_FOOT,
  
  bicep: COLORS.PALE_GREEN_BICEP,
  forearm: COLORS.MEDIUM_AQUAMARINE_FOREARM,
  collar: COLORS.OLIVE_COLLAR, 
  torso: COLORS.MEDIUM_SEA_GREEN_TORSO,
  waist: COLORS.SEA_GREEN_WAIST,
  thigh: COLORS.BLUE_VIOLET_THIGH,
  shin: COLORS.DARK_MAGENTA_SHIN,

  default: COLORS.DEFAULT_FILL,
};

const getPartCategoryColor = (category?: string) => {
  if (category && COLORS_BY_CATEGORY[category]) {
    return COLORS_BY_CATEGORY[category];
  }
  return COLORS.DEFAULT_FILL;
};

export const Bone: React.FC<BoneProps> = ({
  rotation,
  length,
  width = 15,
  variant = 'diamond',
  showOverlay = true,
  visible = true,
  offset = { x: 0, y: 0 },
  className,
  children,
  drawsUpwards = false,
  fillOverride,
  isSelected = false,
  constraint = 'fk',
  renderMode = 'default',
  partCategory, 
  darken20Percent = false, 
}) => {
  const getBonePath = (length: number, width: number, variant: string, drawsUpwards: boolean): string => {
    const effectiveLength = drawsUpwards ? -length : length;
    const halfWidth = width / 2;

    switch (variant) {
      case 'head-tall-oval':
        const hH = ANATOMY.HEAD;    
        const hW = ANATOMY.HEAD_WIDTH; 
        return `M 0,0 C ${hW/2},0 ${hW/2},${-hH} 0,${-hH} C ${-hW/2},${-hH} ${-hW/2},0 0,0 Z`;

      case 'collar-horizontal-oval-shape':
        const collarVisHeight = ANATOMY.COLLAR;
        const collarBaseWidth = ANATOMY.COLLAR_WIDTH;
        return `M ${collarBaseWidth / 2},0 C ${collarBaseWidth / 2},${-collarVisHeight} ${-collarBaseWidth / 2},${-collarVisHeight} ${-collarBaseWidth / 2},0 Z`;

      case 'waist-teardrop-pointy-up':
        const wHeight = ANATOMY.WAIST;
        const wWidth = ANATOMY.WAIST_WIDTH;
        return `M ${wWidth / 2},0 L ${wWidth * 0.15},${-wHeight} L ${-wWidth * 0.15},${-wHeight} L ${-wWidth / 2},0 Z`;

      case 'torso-teardrop-pointy-down':
        const tHeight = ANATOMY.TORSO;
        const tWidth = ANATOMY.TORSO_WIDTH;
        return `M ${tWidth * 0.3},0 C ${tWidth / 2},${-tHeight * 0.5} ${tWidth / 2},${-tHeight} 0,${-tHeight} C ${-tWidth / 2},${-tHeight} ${-tWidth / 2},${-tHeight * 0.5} ${-tWidth * 0.3},0 Z`;

      case 'deltoid-shape':
        const dHeight = ANATOMY.UPPER_ARM;
        const sW = ANATOMY.LIMB_WIDTH_ARM; 
        return `M ${sW / 2},0 C ${sW * 1.5},${dHeight * 0.3} ${sW * 0.8},${dHeight * 0.8} 0,${dHeight} C ${-sW * 0.8},${dHeight * 0.8} ${-sW * 1.5},${dHeight * 0.3} ${-sW / 2},0 Z`;

      case 'limb-tapered':
        const endWidth = width * 0.6;
        return `M ${width / 2},0 L ${endWidth / 2},${effectiveLength} L ${-endWidth / 2},${effectiveLength} L ${-width / 2},0 Z`;

      case 'hand-foot-arrowhead-shape':
        const hBaseWidth = width * 0.3; 
        const hMaxWidth = width;
        return `M ${-hBaseWidth / 2},0 L ${hBaseWidth / 2},0 L ${hMaxWidth / 2},${effectiveLength * 0.3} L 0,${effectiveLength} L ${-hMaxWidth / 2},${effectiveLength * 0.3} Z`;

      default:
        const split = effectiveLength * 0.4;
        return `M 0 0 L ${halfWidth} ${split} L 0 ${effectiveLength} L ${-halfWidth} ${split} Z`;
    }
  };

  const partCategoryColor = getPartCategoryColor(partCategory);

  const pathFill = useMemo(() => {
    if (renderMode === 'wireframe') return 'none';
    if (renderMode === 'grayscale') return COLORS.DEFAULT_FILL;

    let finalFill = fillOverride || partCategoryColor;
    if (darken20Percent) finalFill = adjustBrightness(finalFill, 0.8);

    if (renderMode === 'default' || renderMode === 'silhouette') {
      if (constraint === 'curl') return COLORS.GREEN_CURL;
      if (constraint === 'stretch') return COLORS.PURPLE_STRETCH;
      // Added case for pure-ik (keeping standard category color or specific styling if preferred)
      if (constraint === 'pure-ik') return finalFill;
      return finalFill;
    }
    return finalFill;
  }, [renderMode, constraint, fillOverride, partCategoryColor, darken20Percent]);

  const pathStroke = useMemo(() => {
    if (isSelected) return COLORS.SELECTION;
    if (renderMode === 'wireframe') return COLORS.RIDGE;
    if (renderMode === 'grayscale') return 'none';
    if (renderMode === 'silhouette') {
      if (constraint === 'curl') return COLORS.GREEN_CURL;
      if (constraint === 'stretch') return COLORS.PURPLE_STRETCH;
    }
    return 'none';
  }, [isSelected, renderMode, constraint]);

  const transform = (offset.x !== 0 || offset.y !== 0)
    ? `translate(${offset.x}, ${offset.y}) rotate(${rotation})`
    : `rotate(${rotation})`;

  return (
    <g transform={transform} className={className}>
      {visible && (
        <React.Fragment>
          <path
            d={getBonePath(length, width, variant, drawsUpwards)}
            fill={pathFill}
            stroke={pathStroke}
            strokeWidth={isSelected ? 3 : 0}
            paintOrder="stroke"
          />
          {showOverlay && renderMode === 'default' && (
            <line x1="0" y1="0" x2="0" y2={drawsUpwards ? -length : length} stroke={COLORS.RIDGE} strokeWidth={1} opacity={0.15} />
          )}
        </React.Fragment>
      )}
      <g transform={`translate(0, ${drawsUpwards ? -length : length})`}>{children}</g>
      {showOverlay && visible && (
        <circle cx="0" cy="0" r={isSelected ? 7 : 5} fill={COLORS.ANCHOR_RED} />
      )}
    </g>
  );
};