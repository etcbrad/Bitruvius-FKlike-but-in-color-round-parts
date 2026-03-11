
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Pose, PartName, PartSelection, PartVisibility, AnchorName, partNameToPoseKey, PARENT_MAP, CHILD_MAP, LIMB_SEQUENCES, JointConstraint, RenderMode, Vector2D } from './types';
import { RESET_POSE, FLOOR_HEIGHT, SCALE_FACTOR, JOINT_LIMITS, BEHAVIOR } from './constants'; 
import { getJointPositions, solveArmIK, solveLegIK, getShortestAngleDiffDeg } from './utils/kinematics';
import { Scanlines, SystemGuides } from './components/SystemGrid';
import { Mannequin, getPartCategory } from './components/Mannequin';
import { DraggablePanel } from './components/DraggablePanel';
import { COLORS_BY_CATEGORY } from './components/Bone';
import { poseToString } from './utils/pose-parser';

type ViewMode = 'zoomed' | 'default' | 'lotte' | 'wide';

interface PanelRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
}

const App: React.FC = () => {
  const [activePose, setActivePose] = useState<Pose>(RESET_POSE);
  const undoStack = useRef<Pose[]>([]);
  const redoStack = useRef<Pose[]>([]);

  const [viewMode, setViewMode] = useState<ViewMode>('default');
  const [activePin, setActivePin] = useState<AnchorName>(PartName.Waist); 
  const [renderMode, setRenderMode] = useState<RenderMode>('default');
  const [smartPinning, setSmartPinning] = useState(true);

  const [selectedParts, setSelectedParts] = useState<PartSelection>(() => {
    const initialSelection: PartSelection = Object.values(PartName).reduce((acc, name) => ({ ...acc, [name]: false }), {} as PartSelection);
    initialSelection[PartName.Waist] = true; 
    return initialSelection;
  });

  const [visibility] = useState<PartVisibility>(() => Object.values(PartName).reduce((acc, name) => ({ ...acc, [name]: true }), {} as PartVisibility));

  const [jointModes, setJointModes] = useState<Record<PartName, JointConstraint>>(() => 
    Object.values(PartName).reduce((acc, name) => ({ ...acc, [name]: 'fk' }), {} as Record<PartName, JointConstraint>)
  );

  const [jointStrengths, setJointStrengths] = useState<Record<PartName, number>>(() =>
    Object.values(PartName).reduce((acc, name) => ({ ...acc, [name]: 1.0 }), {} as Record<PartName, number>)
  );

  const [broadcastMode, setBroadcastMode] = useState(true);
  const [bodySyncMode, setBodySyncMode] = useState(false); // Sagittal Mirroring
  const [omniSyncMode, setOmniSyncMode] = useState(false); // NEW: Universal Sympathy
  
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [rotatingPart, setRotatingPart] = useState<PartName | null>(null);
  const rotationStartInfo = useRef<{ 
    startAngle: number; 
    startRotationValue: number; 
    pointerX: number; 
    pointerY: number;
    initialPinnedPos: Vector2D | null;
  } | null>(null);

  const [isEffectorDragging, setIsEffectorDragging] = useState(false);
  const [effectorPart, setEffectorPart] = useState<PartName | null>(null);

  const svgRef = useRef<SVGSVGElement>(null); 
  const [isCraneActive, setIsCraneActive] = useState(false);
  const [isCraneDragging, setIsCraneDragging] = useState(false);
  const dragStartInfo = useRef<{ startX: number; startY: number; startRootX: number; startRootY: number } | null>({ startX: 0, startY: 0, startRootX: 0, startRootY: 0 });

  const [showSplash, setShowSplash] = useState(true);
  const [isAirMode] = useState(false);

  // Panel Z-index management
  const [panelZIndices, setPanelZIndices] = useState<Record<string, number>>({
    'pin-control-panel': 102,
    'scalar-hub-panel': 101,
    'system-status-panel': 100,
    'command-log-panel': 99, 
    'pose-data-terminal-panel': 98,
  });
  const nextZIndex = useRef<number>(103);

  const bringPanelToFront = useCallback((id: string) => {
    setPanelZIndices(prev => {
      const newZIndices = { ...prev };
      newZIndices[id] = nextZIndex.current++;
      return newZIndices;
    });
  }, []);

  const [panelRects, setPanelRects] = useState<Record<string, PanelRect>>({
    'pin-control-panel': { id: 'pin-control-panel', x: 16, y: 16, width: 224, height: 140, minimized: false }, 
    'scalar-hub-panel': { id: 'scalar-hub-panel', x: 16, y: 16 + 140, width: 224, height: 350, minimized: false }, 
    'system-status-panel': { id: 'system-status-panel', x: window.innerWidth - 224 - 16, y: 16, width: 224, height: 250, minimized: false }, 
    'command-log-panel': { id: 'command-log-panel', x: window.innerWidth - 224 - 16, y: 16 + 250, width: 224, height: 250, minimized: false }, 
    'pose-data-terminal-panel': { id: 'pose-data-terminal-panel', x: window.innerWidth - 224 - 16, y: 16 + 250 + 250, width: 224, height: 150, minimized: false },
  });

  const updatePanelRect = useCallback((id: string, newRect: Omit<PanelRect, 'x' | 'y'>) => {
    setPanelRects(prev => {
      const existingRect = prev[id];
      if (!existingRect || existingRect.width !== newRect.width || existingRect.height !== newRect.height || existingRect.minimized !== newRect.minimized) {
        return { ...prev, [id]: { ...existingRect, ...newRect } };
      }
      return prev;
    });
  }, []);

  const updatePanelPosition = useCallback((id: string, newX: number, newY: number, minimized: boolean) => {
    setPanelRects(prev => {
      const existingRect = prev[id];
      if (!existingRect || existingRect.x !== newX || existingRect.y !== newY || existingRect.minimized !== minimized) {
        return { ...prev, [id]: { ...existingRect, x: newX, y: newY, minimized: minimized } };
      }
      return prev;
    });
  }, []);

  const primarySelectedPart = useMemo(() => {
    return (Object.entries(selectedParts).find(([p, sel]) => sel)?.[0]) as PartName | undefined;
  }, [selectedParts]);

  const autoViewBox = useMemo(() => {
    const configs = {
      zoomed: { x: -900, y: 1950, w: 1800, h: 1550 },
      default: { x: -1112.5, y: 1287.5, w: 2225, h: 2212.5 },
      lotte: { x: -1325, y: 625, w: 2650, h: 2875 },
      wide: { x: -1750, y: -700, w: 3500, h: 4200 }
    };
    const c = configs[viewMode];
    return `${c.x} ${c.y} ${c.w} ${c.h}`;
  }, [viewMode]);

  const getInitialPinnedPos = useCallback((pose: Pose, pin: AnchorName) => {
    const joints = getJointPositions(pose, jointModes);
    let initialPinnedPos: Vector2D | null = null;
    if (pin === 'root') initialPinnedPos = joints.root;
    else if (pin === 'lFootTip') initialPinnedPos = joints.lFootTip;
    else if (pin === 'rFootTip') initialPinnedPos = joints.rFootTip;
    else initialPinnedPos = joints[pin as PartName];
    
    if (initialPinnedPos && (pin === 'lFootTip' || pin === 'rFootTip')) {
      initialPinnedPos = { ...initialPinnedPos, y: Math.min(initialPinnedPos.y, FLOOR_HEIGHT) };
    }
    return initialPinnedPos;
  }, [jointModes]);

  const isValidMove = useCallback((
    potentialPose: Pose,
    originalPose: Pose,
    pin: AnchorName,
    initialPinnedPos: Vector2D | null,
    isCrane: boolean,
    isIK: boolean,
    part: PartName | null,
    airMode: boolean,
  ): boolean => {
    if (airMode) return true;
    const potentialJoints = getJointPositions(potentialPose, jointModes);

    if (!isCrane && initialPinnedPos && pin) {
        const currentPinnedPos = potentialJoints[pin as keyof typeof potentialJoints];
        if (currentPinnedPos) {
            const dx = currentPinnedPos.x - initialPinnedPos.x;
            const dy = currentPinnedPos.y - initialPinnedPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 2) return false; 
        }
    }

    const isFootRelated = (p: PartName | null) => p === PartName.LAnkle || p === PartName.RAnkle || p === PartName.LSkin || p === PartName.RSkin || p === PartName.LThigh || p === PartName.RThigh;
    
    if (isCrane || isIK || isFootRelated(part)) {
      const lFootTipY = potentialJoints.lFootTip?.y || -Infinity;
      const rFootTipY = potentialJoints.rFootTip?.y || -Infinity;
      const lowestFootTipY = Math.max(lFootTipY, rFootTipY);
      if (lowestFootTipY > FLOOR_HEIGHT + 2) return false;
    }

    return true;
  }, [jointModes]);

  const validateAndApplyPoseUpdate = useCallback((
      proposedUpdates: Partial<Pose>,
      directPart: PartName | null,
      isEffector: boolean,
  ) => {
      setActivePose(prev => {
          let tentativeNextPose: Pose = { ...prev, ...proposedUpdates };

          // 1. Mirroring Logic (Sagittal Body Sync)
          if (bodySyncMode && directPart) {
            const oppositeMap: Record<string, string> = {
              'lShoulder': 'rShoulder', 'rShoulder': 'lShoulder',
              'lForearm': 'rForearm', 'rForearm': 'lForearm',
              'lWrist': 'rWrist', 'rWrist': 'lWrist',
              'lThigh': 'rThigh', 'rThigh': 'lThigh',
              'lCalf': 'rCalf', 'rCalf': 'lCalf',
              'lAnkle': 'rAnkle', 'rAnkle': 'lAnkle',
            };
            const directKey = partNameToPoseKey[directPart];
            const oppositeKey = oppositeMap[directKey];
            if (oppositeKey) {
              const delta = ((proposedUpdates as any)[directKey] || 0) - ((prev as any)[directKey] || 0);
              (tentativeNextPose as any)[oppositeKey] = ((prev as any)[oppositeKey] || 0) - delta;
            }
          }

          // 2. Kinetic Ripple & Omni Broadcast
          Object.keys(proposedUpdates).forEach(key => {
              const part = Object.entries(partNameToPoseKey).find(([p, k]) => k === key)?.[0] as PartName;
              if (!part) return;
              
              const delta = ((proposedUpdates as any)[key] || 0) - ((prev as any)[key] || 0);

              // OMNI BROADCAST: Every joint gets a piece of the action based on its Resonance Factor
              if (omniSyncMode) {
                Object.values(PartName).forEach(otherPart => {
                    if (otherPart === part) return;
                    const otherKey = partNameToPoseKey[otherPart];
                    if (!otherKey) return;
                    
                    const resFactor = jointStrengths[otherPart];
                    const sharedDelta = delta * resFactor;
                    (tentativeNextPose as any)[otherKey] = ((tentativeNextPose as any)[otherKey] || 0) + sharedDelta;
                });
              }
              
              // TRADITIONAL RIPPLE: Hierarchy based follow
              const ripple = (parentPart: PartName, currentDelta: number) => {
                const children = CHILD_MAP[parentPart] || [];
                children.forEach(child => {
                  const childKey = partNameToPoseKey[child];
                  if (!childKey) return;
                  
                  const mode = jointModes[child];
                  const strength = jointStrengths[child];
                  
                  let multiplier = 0;
                  if (mode === 'stretch') multiplier = -1;
                  else if (mode === 'curl') multiplier = 1;
                  else if (mode === 'pure-ik') multiplier = strength; 
                  else if (mode === 'loose') multiplier = 0.5;
                  else if (mode === 'pure') multiplier = 0; 
                  
                  const finalMultiplier = mode === 'pure-ik' ? multiplier : multiplier * strength;
                  const childDelta = currentDelta * finalMultiplier;
                  
                  (tentativeNextPose as any)[childKey] = ((tentativeNextPose as any)[childKey] || 0) + childDelta;
                  ripple(child, childDelta);
                });
              };
              ripple(part, delta);
          });

          if (!isValidMove(
              tentativeNextPose,
              prev,
              activePin,
              rotationStartInfo.current?.initialPinnedPos || null,
              isCraneDragging, 
              isEffector,
              directPart,
              isAirMode,
          )) {
              return prev;
          }

          undoStack.current.push(prev);
          redoStack.current.length = 0;
          return tentativeNextPose;
      });
  }, [activePin, isAirMode, isCraneDragging, jointModes, jointStrengths, isValidMove, bodySyncMode, omniSyncMode]);


  const handleUndo = useCallback(() => {
    if (undoStack.current.length > 0) {
      setActivePose(prev => {
        redoStack.current.push(prev); 
        return undoStack.current.pop()!;
      });
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length > 0) {
      setActivePose(prev => {
        undoStack.current.push(prev); 
        return redoStack.current.pop()!;
      });
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!svgRef.current) return;
    const svgPoint = svgRef.current.createSVGPoint();
    svgPoint.x = e.clientX; svgPoint.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    const transformedPoint = svgPoint.matrixTransform(ctm.inverse());

    if (isCraneDragging && dragStartInfo.current) {
      const dx = transformedPoint.x - dragStartInfo.current.startX;
      const dy = transformedPoint.y - dragStartInfo.current.startY;
      validateAndApplyPoseUpdate({ root: { x: dragStartInfo.current.startRootX + dx, y: dragStartInfo.current.startRootY + dy } }, null, false);
      
    } else if (isAdjusting && rotatingPart && rotationStartInfo.current) {
      const joints = getJointPositions(activePose, jointModes);
      const pivot = joints[rotatingPart]; 
      if (!pivot) return;
      
      const currentAngleDeg = Math.atan2(transformedPoint.y - pivot.y, transformedPoint.x - pivot.x) * 180 / Math.PI;
      const angleDeltaDeg = getShortestAngleDiffDeg(currentAngleDeg, rotationStartInfo.current.startAngle);
      
      let newRotationValue = rotationStartInfo.current.startRotationValue + angleDeltaDeg;
      const partKey = partNameToPoseKey[rotatingPart];
      const limits = JOINT_LIMITS[partKey];
      if (limits) newRotationValue = Math.max(limits.min, Math.min(limits.max, newRotationValue));

      validateAndApplyPoseUpdate({ [partKey]: newRotationValue }, rotatingPart, false);

    } else if (isEffectorDragging && effectorPart) {
      let ikResult = null;
      let newPoseUpdates: Partial<Pose> = {};
      if (effectorPart === PartName.RWrist) ikResult = solveArmIK(transformedPoint, true, activePose, jointModes);
      else if (effectorPart === PartName.LWrist) ikResult = solveArmIK(transformedPoint, false, activePose, jointModes);
      else if (effectorPart === PartName.RAnkle) ikResult = solveLegIK(transformedPoint, true, activePose, jointModes);
      else if (effectorPart === PartName.LAnkle) ikResult = solveLegIK(transformedPoint, false, activePose, jointModes);

      if (ikResult) {
        if (ikResult.shoulder !== undefined) newPoseUpdates[partNameToPoseKey[PARENT_MAP[effectorPart] as PartName] === 'rForearm' ? 'rShoulder' : 'lShoulder'] = ikResult.shoulder;
        if (ikResult.forearm !== undefined) newPoseUpdates[effectorPart.startsWith('r') ? 'rForearm' : 'lForearm'] = ikResult.forearm;
        if (ikResult.thigh !== undefined) newPoseUpdates[effectorPart.startsWith('r') ? 'rThigh' : 'lThigh'] = ikResult.thigh;
        if (ikResult.calf !== undefined) newPoseUpdates[effectorPart.startsWith('r') ? 'rCalf' : 'lCalf'] = ikResult.calf;
        validateAndApplyPoseUpdate(newPoseUpdates, effectorPart, true);
      }
    }
  }, [isAdjusting, rotatingPart, isCraneDragging, activePose, isEffectorDragging, effectorPart, validateAndApplyPoseUpdate, jointModes]);

  const handleMouseUp = useCallback(() => {
    setIsAdjusting(false);
    setRotatingPart(null);
    setIsCraneDragging(false);
    setEffectorPart(null); 
    setIsEffectorDragging(false); 
    rotationStartInfo.current = null;
  }, []);

  const handleDoubleClickOnPart = useCallback((part: PartName, e: React.MouseEvent<SVGGElement>) => {
    e.stopPropagation();
    if ([PartName.RWrist, PartName.LWrist, PartName.RAnkle, PartName.LAnkle].includes(part)) {
      setIsEffectorDragging(true);
      setEffectorPart(part);
      setSelectedParts(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => next[k as PartName] = k === part);
        return next;
      });
      rotationStartInfo.current = { startAngle: 0, startRotationValue: 0, pointerX: 0, pointerY: 0, initialPinnedPos: getInitialPinnedPos(activePose, activePin) };
    } else {
      setJointModes(prev => {
        const currentMode = prev[part];
        // Updated cycle to include 'pure-ik'
        const cycle: JointConstraint[] = ['fk', 'curl', 'stretch', 'pure-ik'];
        const nextMode = cycle[(cycle.indexOf(currentMode as any) + 1) % cycle.length] || 'fk';
        const next = { ...prev, [part]: nextMode };
        if (broadcastMode) {
          for (const seq of Object.values(LIMB_SEQUENCES)) {
            if (seq.includes(part)) { seq.forEach(p => next[p] = nextMode); break; }
          }
        }
        return next;
      });
    }
  }, [activePose, activePin, getInitialPinnedPos, broadcastMode]);

  const handleMouseDownOnPart = useCallback((part: PartName, e: React.MouseEvent<SVGGElement>) => {
    e.stopPropagation();
    if (!svgRef.current) return;
    setSelectedParts(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => next[k as PartName] = k === part);
      return next;
    });
    const joints = getJointPositions(activePose, jointModes);
    const pivot = joints[part]; 
    if (!pivot) return;
    const svgPoint = svgRef.current.createSVGPoint();
    svgPoint.x = e.clientX; svgPoint.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    const transformedPoint = svgPoint.matrixTransform(ctm.inverse());
    setIsAdjusting(true);
    setRotatingPart(part);
    rotationStartInfo.current = {
      startAngle: Math.atan2(transformedPoint.y - pivot.y, transformedPoint.x - pivot.x) * 180 / Math.PI,
      startRotationValue: (activePose as any)[partNameToPoseKey[part]] || 0,
      pointerX: transformedPoint.x, pointerY: transformedPoint.y, initialPinnedPos: getInitialPinnedPos(activePose, activePin)
    };
  }, [activePose, activePin, getInitialPinnedPos, jointModes]);

  const cycleRenderMode = useCallback(() => {
    setRenderMode(prev => {
      if (prev === 'default') return 'wireframe';
      if (prev === 'wireframe') return 'grayscale'; 
      if (prev === 'grayscale') return 'silhouette'; 
      return 'default';
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'v') setViewMode(prev => prev === 'zoomed' ? 'default' : prev === 'default' ? 'lotte' : prev === 'lotte' ? 'wide' : 'zoomed');
      if (e.key === 'p') setActivePin(prev => {
        if (prev === PartName.Waist) return PartName.LAnkle;
        if (prev === PartName.LAnkle) return 'lFootTip'; 
        return PartName.Waist;
      });
      if (e.key === 'b') setBroadcastMode(prev => !prev);
      if (e.key === 'r') cycleRenderMode();
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleUndo(); }
      if (e.key === 'y' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      clearTimeout(timer);
    };
  }, [handleMouseMove, handleMouseUp, handleUndo, handleRedo, cycleRenderMode]);

  const getPinName = (pin: AnchorName) => {
    if (pin === PartName.Waist) return 'WAIST';
    if (pin === PartName.LAnkle) return 'LEFT ANKLE';
    if (pin === 'lFootTip') return 'LEFT TIPTOE';
    if (pin === 'rFootTip') return 'RIGHT TIPTOE';
    if (pin === 'root') return 'ROOT';
    return pin.toString().toUpperCase();
  };

  const getPartCategoryDisplayName = (part: PartName): string => {
    const category = getPartCategory(part);
    switch(category) {
      case 'bicep': return part.startsWith('r') ? 'RIGHT BICEP' : 'LEFT BICEP';
      case 'forearm': return part.startsWith('r') ? 'RIGHT FOREARM' : 'LEFT FOREARM';
      case 'hand': return part.startsWith('r') ? 'RIGHT HAND' : 'LEFT HAND';
      case 'thigh': return part.startsWith('r') ? 'RIGHT THIGH' : 'LEFT THIGH';
      case 'shin': return part.startsWith('r') ? 'RIGHT SHIN' : 'LEFT SHIN';
      case 'foot': return part.startsWith('r') ? 'RIGHT FOOT' : 'LEFT FOOT';
      default: return category.toUpperCase();
    }
  };

  const allPanelRectsArray = useMemo(() => Object.values(panelRects), [panelRects]);

  return (
    <div className="w-full h-full bg-mono-darker shadow-2xl flex flex-col relative touch-none fixed inset-0 z-50 overflow-hidden text-ink font-mono">
      <div className="relative flex h-full w-full">
        {/* PIN CONTROL */}
        <DraggablePanel
          id="pin-control-panel"
          title="PIN_CONTROL"
          x={panelRects['pin-control-panel'].x}
          y={panelRects['pin-control-panel'].y}
          minimized={panelRects['pin-control-panel'].minimized}
          onUpdateRect={(id, rect) => updatePanelRect(id, rect)}
          onUpdatePosition={(id, x, y, minimized) => updatePanelPosition(id, x, y, minimized)}
          allPanelRects={allPanelRectsArray}
          onBringToFront={bringPanelToFront}
          currentZIndex={panelZIndices['pin-control-panel']}
        >
          <div className="flex flex-col gap-2 w-full text-left">
            <span className="text-white/40 text-[8px] uppercase">Pin_Location</span>
            <div className="grid grid-cols-2 gap-1">
              {([PartName.Waist, PartName.LAnkle, 'lFootTip', 'root'] as AnchorName[]).map(pinOption => (
                <button
                  key={pinOption}
                  onClick={() => setActivePin(pinOption)}
                  className={`text-[9px] text-left px-2 py-1 transition-all border ${
                    activePin === pinOption
                    ? 'bg-accent-red/30 border-accent-red text-accent-red'
                    : 'bg-white/5 border-transparent text-white/50 hover:bg-white/10'
                  }`}
                >
                  {getPinName(pinOption)}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-2 mt-1">
                 <span className="text-[8px] text-white/40 uppercase">Smart_Pivot_Handover</span>
                 <button 
                  onClick={() => setSmartPinning(!smartPinning)}
                  className={`text-[9px] px-2 py-0.5 border ${smartPinning ? 'bg-accent-green/20 border-accent-green text-accent-green' : 'bg-white/5 border-white/10 text-white/20'}`}
                 >
                  {smartPinning ? 'ACTIVE' : 'OFF'}
                 </button>
              </div>
          </div>
        </DraggablePanel>

        {/* SCALAR HUB */}
        <DraggablePanel
          id="scalar-hub-panel"
          title="SCALAR_HUB"
          x={panelRects['scalar-hub-panel'].x}
          y={panelRects['scalar-hub-panel'].y}
          minimized={panelRects['scalar-hub-panel'].minimized}
          onUpdateRect={(id, rect) => {
            updatePanelRect(id, rect);
            const pinControlRect = panelRects['pin-control-panel'];
            const newY = pinControlRect.y + pinControlRect.height;
            if (panelRects['scalar-hub-panel'].y !== newY) updatePanelPosition('scalar-hub-panel', pinControlRect.x, newY, panelRects['scalar-hub-panel'].minimized);
          }}
          onUpdatePosition={(id, x, y, minimized) => updatePanelPosition(id, x, y, minimized)}
          allPanelRects={allPanelRectsArray}
          onBringToFront={bringPanelToFront}
          currentZIndex={panelZIndices['scalar-hub-panel']}
          extraTitleContent={primarySelectedPart && <span className="text-accent-red animate-pulse text-[8px]">ACTIVE_PIVOT</span>}
        >
          <div className="bg-white/5 p-2 rounded border border-white/10 mb-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: primarySelectedPart ? COLORS_BY_CATEGORY[getPartCategory(primarySelectedPart)] : '#9CA3AF' }}></span>
              <span className="text-white/70 text-[9px] uppercase font-bold">
                {primarySelectedPart ? getPartCategoryDisplayName(primarySelectedPart) : 'WHOLE FIGURE'}
              </span>
            </div>
          </div>

          {primarySelectedPart ? (
            <div className="flex flex-col gap-3 w-full">
              <div className="flex flex-col gap-1">
                <span className="text-white/40 text-[8px] uppercase">Kinetic_Behavior</span>
                <div className="grid grid-cols-2 gap-1">
                  {(['fk', 'stretch', 'curl', 'pure-ik', 'loose', 'pure'] as JointConstraint[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => {
                        const next = { ...jointModes, [primarySelectedPart]: mode };
                        if (broadcastMode) {
                          for (const seq of Object.values(LIMB_SEQUENCES)) {
                            if (seq.includes(primarySelectedPart)) { seq.forEach(p => next[p] = mode); break; }
                          }
                        }
                        setJointModes(next);
                      }}
                      className={`text-[9px] text-left px-2 py-1 transition-all border ${
                        jointModes[primarySelectedPart!] === mode 
                        ? 'bg-selection/30 border-selection text-selection' 
                        : 'bg-white/5 border-transparent text-white/50 hover:bg-white/10'
                      }`}
                    >
                      {mode.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[8px]">
                  <span className="text-white/40 uppercase">{jointModes[primarySelectedPart] === 'pure-ik' ? 'IK_RES_INPUT' : 'RESONANCE_FACTOR'}</span>
                  <span className="text-focus-ring font-bold">{jointStrengths[primarySelectedPart].toFixed(2)}</span>
                </div>
                <input 
                  type="range" min="-3" max="3" step="0.05"
                  value={jointStrengths[primarySelectedPart]}
                  onChange={(e) => setJointStrengths({...jointStrengths, [primarySelectedPart]: parseFloat(e.target.value)})}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-focus-ring"
                />
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-2 mt-1">
                 <span className="text-[8px] text-white/40 uppercase">Limb_Broadcast</span>
                 <button onClick={() => setBroadcastMode(!broadcastMode)} className={`text-[9px] px-2 py-0.5 border ${broadcastMode ? 'bg-accent-green/20 border-accent-green text-accent-green' : 'bg-white/5 border-white/10 text-white/20'}`}>{broadcastMode ? 'ACTIVE' : 'OFF'}</button>
              </div>

              <div className="flex flex-col gap-1 border-t border-white/10 pt-2 mt-1">
                 <span className="text-[8px] text-white/40 uppercase mb-1">Body_Sync_Protocols</span>
                 <div className="grid grid-cols-2 gap-1">
                    <button onClick={() => setBodySyncMode(!bodySyncMode)} className={`text-[8px] px-2 py-1 border ${bodySyncMode ? 'bg-accent-purple/20 border-accent-purple text-accent-purple' : 'bg-white/5 border-white/10 text-white/20'}`}>SAGITTAL</button>
                    <button onClick={() => setOmniSyncMode(!omniSyncMode)} className={`text-[8px] px-2 py-1 border ${omniSyncMode ? 'bg-accent-green/20 border-accent-green text-accent-green' : 'bg-white/5 border-white/10 text-white/20'}`}>OMNI</button>
                 </div>
              </div>
            </div>
          ) : (
            <div className="text-white/20 italic py-8 text-center w-full uppercase text-[8px] tracking-widest">Select_Anchor_To_Adjust</div>
          )}
          
          <div className="border-t border-white/10 pt-2 mt-4 w-full flex justify-between gap-2">
            <button onClick={handleUndo} disabled={undoStack.current.length === 0} className={`flex-1 text-[9px] px-2 py-1 border ${undoStack.current.length > 0 ? 'bg-white/10 border-white/20 text-white/70 hover:bg-white/20' : 'bg-white/5 border-transparent text-white/30 cursor-not-allowed'}`}>UNDO</button>
            <button onClick={handleRedo} disabled={redoStack.current.length === 0} className={`flex-1 text-[9px] px-2 py-1 border ${redoStack.current.length > 0 ? 'bg-white/10 border-white/20 text-white/70 hover:bg-white/20' : 'bg-white/5 border-transparent text-white/30 cursor-not-allowed'}`}>REDO</button>
          </div>
        </DraggablePanel>

        {/* SYSTEM STATUS */}
        <DraggablePanel
          id="system-status-panel"
          title="MONITOR_O1"
          x={panelRects['system-status-panel'].x}
          y={panelRects['system-status-panel'].y}
          minimized={panelRects['system-status-panel'].minimized}
          onUpdateRect={(id, rect) => updatePanelRect(id, rect)}
          onUpdatePosition={(id, x, y, minimized) => updatePanelPosition(id, x, y, minimized)}
          allPanelRects={allPanelRectsArray}
          onBringToFront={bringPanelToFront}
          currentZIndex={panelZIndices['system-status-panel']}
        >
          <div className="flex flex-col gap-4 w-full text-right text-[9px]">
             <div className="flex justify-between border-b border-white/5 pb-1"><span>VIEW:</span> <span className="text-accent-green">{viewMode.toUpperCase()}</span></div>
             <div className="flex justify-between border-b border-white/5 pb-1"><span>PIN:</span> <span className="text-accent-red">{getPinName(activePin)}</span></div>
             <div className="flex justify-between border-b border-white/5 pb-1"><span>OMNI_SYNC:</span> <span className={omniSyncMode ? "text-accent-green" : "text-white/20"}>{omniSyncMode ? "ACTIVE" : "OFF"}</span></div>
             <div className="flex justify-between border-b border-white/5 pb-1"><span>ACTIVE:</span> <span className="text-focus-ring">{primarySelectedPart || 'NONE'}</span></div>
             <div className="flex justify-between"><span>OPTICS:</span> <span className="text-focus-ring">{renderMode.toUpperCase()}</span></div>
          </div>
        </DraggablePanel>

        {/* COMMAND LOG */}
        <DraggablePanel
          id="command-log-panel"
          title="COMMAND_LOG"
          x={panelRects['command-log-panel'].x}
          y={panelRects['command-log-panel'].y}
          minimized={panelRects['command-log-panel'].minimized}
          onUpdateRect={(id, rect) => {
            updatePanelRect(id, rect);
            const systemStatusRect = panelRects['system-status-panel'];
            const newY = systemStatusRect.y + systemStatusRect.height;
            if (panelRects['command-log-panel'].y !== newY) updatePanelPosition('command-log-panel', systemStatusRect.x, newY, panelRects['command-log-panel'].minimized);
          }}
          onUpdatePosition={(id, x, y, minimized) => updatePanelPosition(id, x, y, minimized)}
          allPanelRects={allPanelRectsArray}
          onBringToFront={bringPanelToFront}
          currentZIndex={panelZIndices['command-log-panel']}
        >
           <div className="flex flex-col gap-1 w-full text-left uppercase tracking-widest text-[8px]">
            <span className="text-white/30 mb-1 border-b border-white/10 pb-1">KINETIC_FLOW_SUMMARY</span>
            <div className="flex gap-2 items-center"><span className="text-accent-green">OMNI SYNC</span> <span>Every rotation ripples globally</span></div>
            <div className="flex gap-2 items-center"><span className="text-accent-green">SAGITTAL</span> <span>L/R symmetrical mirroring</span></div>
            <div className="flex gap-2 items-center"><span className="text-accent-green">PURE IK</span> <span>Custom resonance multiplier</span></div>
            <div className="flex gap-2 items-center mt-2"><div className="w-2 h-2 rounded-full bg-[#A3E635]"></div> <span>CURL: Child follows parent</span></div>
            <div className="flex gap-2 items-center"><div className="w-2 h-2 rounded-full bg-[#8B7EC1]"></div> <span>STRETCH: Child counter-reacts</span></div>
          </div>
        </DraggablePanel>
        
        {/* POSE DATA TERMINAL */}
        <DraggablePanel
          id="pose-data-terminal-panel"
          title="POSE_DATA_TERMINAL"
          x={panelRects['pose-data-terminal-panel'].x}
          y={panelRects['pose-data-terminal-panel'].y}
          minimized={panelRects['pose-data-terminal-panel'].minimized}
          onUpdateRect={(id, rect) => {
            updatePanelRect(id, rect);
            const commandLogRect = panelRects['command-log-panel'];
            const newY = commandLogRect.y + commandLogRect.height;
            if (panelRects['pose-data-terminal-panel'].y !== newY) updatePanelPosition('pose-data-terminal-panel', commandLogRect.x, newY, panelRects['pose-data-terminal-panel'].minimized);
          }}
          onUpdatePosition={(id, x, y, minimized) => updatePanelPosition(id, x, y, minimized)}
          allPanelRects={allPanelRectsArray}
          onBringToFront={bringPanelToFront}
          currentZIndex={panelZIndices['pose-data-terminal-panel']}
        >
          <div className="text-white/70 text-[8px] whitespace-pre-wrap break-all h-full overflow-y-auto custom-scrollbar">
            {poseToString(activePose)}
          </div>
        </DraggablePanel>

        <div className="w-full h-full bg-selection-super-light bg-triangle-grid flex items-center justify-center relative">
          <Scanlines />
          {showSplash && (
            <div className="absolute top-[8%] left-0 right-0 z-30 flex items-center justify-center pointer-events-none">
              <h1 className="text-6xl font-archaic text-paper/80 animate-terminal-boot tracking-widest uppercase">BITRUVIUS</h1>
            </div>
          )}
          
          <svg ref={svgRef} width="100%" height="100%" viewBox={autoViewBox} className="overflow-visible relative z-10" style={{ filter: renderMode === 'silhouette' ? 'grayscale(100%)' : 'none' }}>
            <SystemGuides floorY={FLOOR_HEIGHT} isAirMode={isAirMode} />
            <g>
              <Mannequin
                pose={activePose}
                showOverlay={true}
                selectedParts={selectedParts}
                visibility={visibility}
                pin={activePin}
                className="text-black"
                onMouseDownOnPart={handleMouseDownOnPart}
                onDoubleClickOnPart={handleDoubleClickOnPart}
                onMouseDownOnRoot={(e) => { 
                  e.stopPropagation(); 
                  if (!svgRef.current) return;
                  const svgPoint = svgRef.current.createSVGPoint();
                  svgPoint.x = e.clientX; 
                  svgPoint.y = e.clientY;
                  const ctm = svgRef.current.getScreenCTM();
                  if (!ctm) return;
                  const transformedPoint = svgPoint.matrixTransform(ctm.inverse());

                  setIsCraneDragging(true); 
                  rotationStartInfo.current = { 
                    startAngle: 0, 
                    startRotationValue: 0, 
                    pointerX: transformedPoint.x, 
                    pointerY: transformedPoint.y, 
                    initialPinnedPos: getInitialPinnedPos(activePose, activePin) 
                  };
                  dragStartInfo.current = { 
                    startX: transformedPoint.x, 
                    startY: transformedPoint.y, 
                    startRootX: activePose.root.x, 
                    startRootY: activePose.root.y 
                  }; 
                }}
                isAirMode={isAirMode}
                onToggleCrane={() => setIsCraneActive(!isCraneActive)}
                isCraneActive={isCraneActive}
                jointModes={jointModes} 
                renderMode={renderMode}
                bodyRotation={activePose.bodyRotation}
              />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default App;