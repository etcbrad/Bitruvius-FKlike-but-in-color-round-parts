import React from 'react';
import { Vector2D } from '../types'; // Import Vector2D
import { ANATOMY } from '../constants'; // Import ANATOMY for fixed visual dimensions

interface BoneProps {
  rotation: number;
  length: number;
  width?: number;
  variant?: 'diamond' | 'waist-shape' | 'torso-shape' | 'collar-tapered-shape' | 'deltoid-shape' | 'limb-effector';
  rounded?: boolean;
  decorations?: Array<{
    position: number;
    shape: 'circle' | 'square' | 'triangle';
    size?: number;
    type?: 'hole' | 'solid';
  }>;
  showOverlay?: boolean;
  visible?: boolean;
  offset?: Vector2D;
  isSilhouetteMode?: boolean;
  className?: string;
  children?: React.ReactNode;
  drawsUpwards?: boolean; // New prop to indicate if the bone draws from 0 to -length
}

export const Bone: React.FC<BoneProps> = ({
  rotation,
  length,
  width = 15, // Default width, but specific variants will use ANATOMY values
  variant = 'diamond',
  rounded = false,
  decorations,
  showOverlay = true,
  visible = true,
  offset = { x: 0, y: 0 },
  isSilhouetteMode = false,
  className,
  children,
  drawsUpwards = false, // Default to false (draws downwards)
}) => {
  const getBonePath = (length: number, width: number, variant: string, drawsUpwards: boolean): string => {
    // `effectiveLength` is the kinematic length used for overlay line and children positioning.
    const effectiveLength = drawsUpwards ? -length : length;
    const halfWidth = width / 2;

    switch (variant) {
      case 'waist-shape': // Upside-down teardrop: pointy at hips (0,0), broad at navel (0, -visualHeight)
        // This shape is fixed relative to ANATOMY.WAIST_WIDTH and ANATOMY.WAIST
        const waistVisHeight = ANATOMY.WAIST; // Use ANATOMY.WAIST as the base visual height
        const waistHipWidth = ANATOMY.WAIST_WIDTH * 0.7; // Width at hips (pivot)
        const waistNavelWidth = ANATOMY.WAIST_WIDTH; // Width at navel (top)
        return `M ${waistHipWidth / 2},0
                C ${waistHipWidth / 2},${-waistVisHeight * 0.3} ${waistNavelWidth / 2},${-waistVisHeight * 0.7} ${waistNavelWidth / 2},${-waistVisHeight}
                L ${-waistNavelWidth / 2},${-waistVisHeight}
                C ${-waistNavelWidth / 2},${-waistVisHeight * 0.7} ${-waistHipWidth / 2},${-waistVisHeight * 0.3} ${-waistHipWidth / 2},0 Z`;

      case 'torso-shape': // Right-side-up teardrop: pointy at navel (0,0), broad at chest (0, -visualHeight)
        // This shape is fixed relative to ANATOMY.TORSO_WIDTH and ANATOMY.TORSO
        const torsoVisHeight = ANATOMY.TORSO; // Use ANATOMY.TORSO as the base visual height
        const torsoNavelWidth = ANATOMY.TORSO_WIDTH * 0.7; // Width at navel (pivot)
        const torsoChestWidth = ANATOMY.TORSO_WIDTH; // Width at chest (top)
        return `M ${torsoNavelWidth / 2},0
                C ${torsoNavelWidth / 2},${-torsoVisHeight * 0.3} ${torsoChestWidth / 2},${-torsoVisHeight * 0.7} ${torsoChestWidth / 2},${-torsoVisHeight}
                L ${-torsoChestWidth / 2},${-torsoVisHeight}
                C ${-torsoChestWidth / 2},${-torsoVisHeight * 0.7} ${-torsoNavelWidth / 2},${-torsoVisHeight * 0.3} ${-torsoNavelWidth / 2},0 Z`;

      case 'collar-tapered-shape': // Trapezoid: wider at bottom (chest), narrower at top (neck)
        // This shape is fixed relative to ANATOMY.COLLAR_WIDTH and ANATOMY.COLLAR
        const collarVisHeight = ANATOMY.COLLAR; // Use ANATOMY.COLLAR as the base visual height
        const collarBottomWidth = ANATOMY.COLLAR_WIDTH; // Width at chest (pivot)
        const collarTopWidth = ANATOMY.COLLAR_WIDTH * 0.7; // Width at neck (top)
        return `M ${collarBottomWidth / 2},0
                L ${collarTopWidth / 2},${-collarVisHeight}
                L ${-collarTopWidth / 2},${-collarVisHeight}
                L ${-collarBottomWidth / 2},0 Z`;

      case 'deltoid-shape': // Organic shoulder shape: draws downwards from shoulder pivot (0,0)
        // This shape is fixed relative to ANATOMY.LIMB_WIDTH_ARM and ANATOMY.UPPER_ARM
        const deltoidVisHeight = ANATOMY.UPPER_ARM; // Use ANATOMY.UPPER_ARM as base visual height
        const deltoidTopWidth = ANATOMY.LIMB_WIDTH_ARM;
        const deltoidMidWidth = ANATOMY.LIMB_WIDTH_ARM * 1.2;
        const deltoidBottomWidth = ANATOMY.LIMB_WIDTH_ARM * 0.5;
        return `M ${deltoidTopWidth / 2} 0
                C ${deltoidTopWidth / 2} ${deltoidVisHeight * 0.2} ${deltoidMidWidth / 2} ${deltoidVisHeight * 0.4} ${deltoidMidWidth / 2} ${deltoidVisHeight * 0.7}
                L 0 ${deltoidVisHeight}
                L ${-deltoidMidWidth / 2} ${deltoidVisHeight * 0.7}
                C ${-deltoidMidWidth / 2} ${deltoidVisHeight * 0.4} ${-deltoidTopWidth / 2} ${deltoidVisHeight * 0.2} ${-deltoidTopWidth / 2} 0 Z`;

      default: // Diamond (default for most limbs like thigh, shin, forearm) - still stretches with effectiveLength
        const split = effectiveLength * 0.4;
        return `M 0 0 L ${halfWidth} ${split} L 0 ${effectiveLength} L ${-halfWidth} ${split} Z`;
    }
  };

  // Determine actual end point for line and children translation (this still uses kinematic length)
  const visualEndPoint = drawsUpwards ? -length : length;

  // Apply translation and rotation to the bone group
  const transform = (offset.x !== 0 || offset.y !== 0)
    ? `translate(${offset.x}, ${offset.y}) rotate(${rotation})`
    : `rotate(${rotation})`;

  return (
    <g transform={transform} className={className}>
      {visible && (
        <React.Fragment>
          {/* The main shape of the bone */}
          <path
            d={getBonePath(length, width, variant, drawsUpwards)}
            fill="currentColor"
            stroke={rounded ? "currentColor" : "none"} // Optional rounded styling
            strokeWidth={rounded ? width * 0.15 : 0}
            strokeLinejoin={rounded ? "round" : "miter"}
            strokeLinecap={rounded ? "round" : "butt"}
          />
          {/* Overlay line for axis, only if not silhouette mode */}
          {showOverlay && !isSilhouetteMode && (
            <line x1="0" y1="0" x2="0" y2={visualEndPoint} stroke="#333333" strokeWidth={2} opacity={0.9} strokeLinecap="round" />
          )}

          {/* Optional decorations on the bone's surface */}
          {decorations &&
            decorations.map((d, i) => {
              // Position decorations along the effective length
              const y = visualEndPoint * d.position;
              const size = d.size || 7;
              const r = size / 2;
              const fill = d.type === 'hole' ? '#333333' : 'currentColor';
              return (
                <g key={`deco-${i}`} transform={`translate(0, ${y})`}>
                  {d.shape === 'circle' && <circle cx={0} cy={0} r={r} fill={fill} />}
                  {d.shape === 'square' && <rect x={-r} y={-r} width={size} height={size} fill={fill} />}
                  {d.shape === 'triangle' && <polygon points={`0,${-r} ${-r},${r} ${r},${r}`} fill={fill} />}
                </g>
              );
            })}
        </React.Fragment>
      )}

      {/* Children are rendered at the end of the current bone's local coordinate system */}
      <g transform={`translate(0, ${visualEndPoint})`}>{children}</g>

      {/* Anchor (red dot) at the start of the bone, always visible if showOverlay and visible */}
      {showOverlay && visible && (
        <circle cx="0" cy="0" r="5" fill="#F87171" className="pointer-events-none" data-no-export={true} />
      )}
    </g>
  );
};