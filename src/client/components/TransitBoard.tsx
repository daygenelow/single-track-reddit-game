import React, { useRef, useState } from 'react';
import { getConnections, GRID_SIZE, isTJunction, keyOf } from '../../shared/sim';
import type { BoardState, Coord, Dir, PuzzleDef, SimTick } from '../../shared/types.ts';

interface Props {
  puzzle: PuzzleDef;
  board: BoardState;
  activeFrame: SimTick | null;
  failAt: Coord | null;
  isSimulating: boolean;
  showOnboardingHint: boolean;
  onPaintCell: (r: number, c: number, mode: 'add' | 'remove') => void;
  onToggleSwitch: (r: number, c: number) => void;
}

const CELL = 60;
const SIZE = CELL * GRID_SIZE; // 360x360 viewBox
const LINE_COLOR = { A: '#D9381E', B: '#0057B8' };

const EDGE_POINT: Record<Dir, [number, number]> = {
  N: [30, 0],
  E: [60, 30],
  S: [30, 60],
  W: [0, 30],
};

export const TransitBoard: React.FC<Props> = ({
  puzzle,
  board,
  activeFrame,
  failAt,
  isSimulating,
  showOnboardingHint,
  onPaintCell,
  onToggleSwitch,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragMode, setDragMode] = useState<'add' | 'remove' | null>(null);
  const lastCellRef = useRef<string | null>(null);

  const trackSet = new Set(board.tracks);
  const obstacleMap = new Map(puzzle.obstacles.map((o) => [keyOf(o.r, o.c), o]));
  const depotMap = new Map(puzzle.depots.map((d) => [keyOf(d.r, d.c), d]));
  const stationMap = new Map(puzzle.stations.map((s) => [keyOf(s.r, s.c), s]));

  const getCellFromPointer = (e: React.PointerEvent<SVGSVGElement>): Coord | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SIZE;
    const y = ((e.clientY - rect.top) / rect.height) * SIZE;
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return null;
    return { r, c };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isSimulating) return;
    const cell = getCellFromPointer(e);
    if (!cell) return;
    const k = keyOf(cell.r, cell.c);
    if (obstacleMap.has(k) || depotMap.has(k) || stationMap.has(k)) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    lastCellRef.current = k;

    if (isTJunction(cell.r, cell.c, trackSet, puzzle)) {
      onToggleSwitch(cell.r, cell.c);
      return;
    }

    const mode = trackSet.has(k) ? 'remove' : 'add';
    setDragMode(mode);
    onPaintCell(cell.r, cell.c, mode);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragMode || isSimulating) return;
    const cell = getCellFromPointer(e);
    if (!cell) return;
    const k = keyOf(cell.r, cell.c);
    if (k === lastCellRef.current) return;
    if (obstacleMap.has(k) || depotMap.has(k) || stationMap.has(k)) return;

    lastCellRef.current = k;
    onPaintCell(cell.r, cell.c, dragMode);
  };

  const handlePointerUp = () => {
    setDragMode(null);
    lastCellRef.current = null;
  };

  const switches = activeFrame?.switches ?? board.switches;
  const depotA = puzzle.depots[0];

  return (
    <div className="relative flex items-center justify-center">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-[min(88vw,360px)] sm:w-[372px] aspect-square bg-[#F5F2EB] border-2 border-[#111111] select-none touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <defs>
          <pattern id="hatch-water" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="#C9D9DC" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="#AEC3C7" strokeWidth="2" />
          </pattern>
          <pattern id="hatch-park" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <rect width="8" height="8" fill="#D3DEC9" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="#BACAA9" strokeWidth="2" />
          </pattern>
        </defs>

        {/* Architectural Grid Hairlines */}
        {Array.from({ length: GRID_SIZE - 1 }).map((_, i) => (
          <React.Fragment key={i}>
            <line x1={(i + 1) * CELL} y1={0} x2={(i + 1) * CELL} y2={SIZE} stroke="#DDD8CE" strokeWidth="1" />
            <line x1={0} y1={(i + 1) * CELL} x2={SIZE} y2={(i + 1) * CELL} stroke="#DDD8CE" strokeWidth="1" />
          </React.Fragment>
        ))}

        {/* Obstacles */}
        {puzzle.obstacles.map((o) => (
          <rect
            key={keyOf(o.r, o.c)}
            x={o.c * CELL + 2}
            y={o.r * CELL + 2}
            width={CELL - 4}
            height={CELL - 4}
            fill={o.kind === 'water' ? 'url(#hatch-water)' : 'url(#hatch-park)'}
            stroke="#111111"
            strokeOpacity="0.15"
          />
        ))}

        {/* Contextual Onboarding Hint */}
        {showOnboardingHint && (
          <line
            x1={depotA.c * CELL + 30}
            y1={depotA.r * CELL + 30}
            x2={(depotA.c + (depotA.dir === 'E' ? 2 : 0)) * CELL + 30}
            y2={(depotA.r + (depotA.dir === 'S' ? 2 : 0)) * CELL + 30}
            stroke="#D9381E"
            strokeWidth="6"
            strokeDasharray="6 6"
            strokeLinecap="round"
            className="animate-pulse"
          />
        )}

        {/* Placed Tracks */}
        {board.tracks.map((k) => {
          const [r = 0, c = 0] = k.split(',').map(Number);
          const conns = getConnections(r, c, trackSet, puzzle);
          const x = c * CELL;
          const y = r * CELL;
          const isT = conns.length === 3;
          const swState = switches[k] ?? 0;

          return (
            <g key={k} transform={`translate(${x},${y})`}>
              {conns.length === 0 ? (
                <circle cx={30} cy={30} r={8} fill="#222222" />
              ) : (
                conns.map((d) => {
                  const [ex, ey] = EDGE_POINT[d];
                  return (
                    <g key={d}>
                      <line x1={30} y1={30} x2={ex} y2={ey} stroke="#222222" strokeWidth="10" strokeLinecap="round" />
                      <line x1={30} y1={30} x2={ex} y2={ey} stroke="#F5F2EB" strokeWidth="2" strokeDasharray="3 5" />
                    </g>
                  );
                })
              )}
              {isT && (
                <g>
                  <circle cx={30} cy={30} r={11} fill="#F5F2EB" stroke="#111111" strokeWidth="2.5" />
                  <text x={30} y={34} textAnchor="middle" fontSize="11" fontWeight="800" fill="#111111">
                    {swState === 0 ? 'I' : 'II'}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Depots */}
        {puzzle.depots.map((d) => (
          <g key={`depot-${d.line}`} transform={`translate(${d.c * CELL},${d.r * CELL})`}>
            <rect x={8} y={8} width={44} height={44} rx={4} fill={LINE_COLOR[d.line]} stroke="#111111" strokeWidth="2" />
            <text x={30} y={36} textAnchor="middle" fill="#F5F2EB" fontSize="20" fontWeight="800">
              {d.line}
            </text>
          </g>
        ))}

        {/* Stations */}
        {puzzle.stations.map((s) => (
          <g key={`station-${s.line}`} transform={`translate(${s.c * CELL},${s.r * CELL})`}>
            <circle cx={30} cy={30} r={21} fill="#F5F2EB" stroke={LINE_COLOR[s.line]} strokeWidth="5" />
            <text x={30} y={36} textAnchor="middle" fill="#111111" fontSize="18" fontWeight="800">
              {s.line}
            </text>
          </g>
        ))}

        {/* Live Animated Trains */}
        {activeFrame &&
          (['A', 'B'] as const).map((line) => {
            const tr = activeFrame.trains[line];
            return (
              <g
                key={`train-${line}`}
                style={{
                  transform: `translate(${tr.c * CELL + 30}px, ${tr.r * CELL + 30}px)`,
                  transition: 'transform 320ms linear',
                }}
              >
                <circle r={14} fill={LINE_COLOR[line]} stroke="#111111" strokeWidth="2.5" />
                <text y={5} textAnchor="middle" fill="#F5F2EB" fontSize="13" fontWeight="800">
                  {line}
                </text>
              </g>
            );
          })}

        {/* Collision / Derail Impact Ring */}
        {failAt && (
          <circle
            cx={failAt.c * CELL + 30}
            cy={failAt.r * CELL + 30}
            r={24}
            fill="none"
            stroke="#FF2A2A"
            strokeWidth="4"
            className="animate-ping"
          />
        )}
      </svg>

      {showOnboardingHint && (
        <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 bg-[#111111] text-[#F5F2EB] text-[11px] font-bold tracking-wider uppercase px-3 py-1">
          Drag to lay track
        </div>
      )}
    </div>
  );
};

