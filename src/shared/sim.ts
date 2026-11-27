import type { BoardState, Coord, Dir, LineId, PuzzleDef, SimOutcome, SimTick, TrainFrame } from './types.ts';

export const GRID_SIZE = 6;
export const MAX_TICKS = 30;

const DIR_ORDER: Dir[] = ['N', 'E', 'S', 'W'];
const DELTA: Record<Dir, Coord> = {
  N: { r: -1, c: 0 },
  E: { r: 0, c: 1 },
  S: { r: 1, c: 0 },
  W: { r: 0, c: -1 },
};
const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };

export const keyOf = (r: number, c: number) => `${r},${c}`;
export const coordLabel = (r: number, c: number) =>
  `${String.fromCharCode(65 + c)}${r + 1}`; // e.g. C4

export function isInside(r: number, c: number): boolean {
  return r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE;
}

/** Returns all cardinal directions that connect to a valid rail/depot/station */
export function getConnections(
  r: number,
  c: number,
  trackSet: Set<string>,
  puzzle: PuzzleDef
): Dir[] {
  const dirs: Dir[] = [];
  const depotKeys = new Set(puzzle.depots.map((d) => keyOf(d.r, d.c)));
  const stationKeys = new Set(puzzle.stations.map((s) => keyOf(s.r, s.c)));

  for (const d of DIR_ORDER) {
    const nr = r + DELTA[d].r;
    const nc = c + DELTA[d].c;
    if (!isInside(nr, nc)) continue;
    const nk = keyOf(nr, nc);
    if (trackSet.has(nk) || depotKeys.has(nk) || stationKeys.has(nk)) {
      dirs.push(d);
    }
  }
  return dirs;
}

export function isTJunction(
  r: number,
  c: number,
  trackSet: Set<string>,
  puzzle: PuzzleDef
): boolean {
  return trackSet.has(keyOf(r, c)) && getConnections(r, c, trackSet, puzzle).length === 3;
}

export function simulate(puzzle: PuzzleDef, board: BoardState): SimOutcome {
  const obstacleSet = new Set(puzzle.obstacles.map((o) => keyOf(o.r, o.c)));
  const depotMap = new Map(puzzle.depots.map((d) => [keyOf(d.r, d.c), d]));
  const stationMap = new Map(puzzle.stations.map((s) => [keyOf(s.r, s.c), s]));

  // Sanitize tracks (reject out-of-bounds or overlapping fixed tiles)
  const trackSet = new Set<string>();
  for (const k of board.tracks) {
    const [r = -1, c = -1] = k.split(',').map(Number);
    if (!isInside(r, c)) continue;
    if (obstacleSet.has(k) || depotMap.has(k) || stationMap.has(k)) continue;
    trackSet.add(k);
  }

  const switches: Record<string, 0 | 1> = { ...board.switches };
  const trains: Record<LineId, TrainFrame> = {
    A: { line: 'A', r: puzzle.depots[0].r, c: puzzle.depots[0].c, dir: puzzle.depots[0].dir, docked: false },
    B: { line: 'B', r: puzzle.depots[1].r, c: puzzle.depots[1].c, dir: puzzle.depots[1].dir, docked: false },
  };

  const frames: SimTick[] = [
    {
      tick: 0,
      trains: { A: { ...trains.A }, B: { ...trains.B } },
      switches: { ...switches },
    },
  ];

  for (let tick = 1; tick <= MAX_TICKS; tick++) {
    const prevA = { ...trains.A };
    const prevB = { ...trains.B };
    const flipsThisTick: string[] = [];

    for (const line of ['A', 'B'] as LineId[]) {
      const tr = trains[line];
      if (tr.docked) continue;

      const nr = tr.r + DELTA[tr.dir].r;
      const nc = tr.c + DELTA[tr.dir].c;

      if (!isInside(nr, nc)) {
        return {
          status: 'DERAIL',
          ticks: tick,
          at: { r: tr.r, c: tr.c },
          line,
          message: `LINE ${line} DERAILED AT ${coordLabel(tr.r, tr.c)}`,
          frames,
        };
      }

      const nk = keyOf(nr, nc);

      // Check station arrival
      const st = stationMap.get(nk);
      if (st) {
        if (st.line === line) {
          tr.r = nr;
          tr.c = nc;
          tr.docked = true;
          continue;
        }
        return {
          status: 'DERAIL',
          ticks: tick,
          at: { r: nr, c: nc },
          line,
          message: `WRONG STATION AT ${coordLabel(nr, nc)}`,
          frames,
        };
      }

      if (!trackSet.has(nk)) {
        return {
          status: 'DERAIL',
          ticks: tick,
          at: { r: nr, c: nc },
          line,
          message: `LINE ${line} DERAILED AT ${coordLabel(nr, nc)}`,
          frames,
        };
      }

      // Advance onto track tile and compute next heading
      const enteredFrom = OPPOSITE[tr.dir];
      const conns = getConnections(nr, nc, trackSet, puzzle);
      const exits = conns.filter((d) => d !== enteredFrom);

      if (exits.length === 0) {
        tr.r = nr;
        tr.c = nc;
        frames.push({
          tick,
          trains: { A: { ...trains.A }, B: { ...trains.B } },
          switches: { ...switches },
        });
        return {
          status: 'DERAIL',
          ticks: tick,
          at: { r: nr, c: nc },
          line,
          message: `DEAD END AT ${coordLabel(nr, nc)}`,
          frames,
        };
      }

      let nextDir: Dir;
      if (exits.length === 1) {
        nextDir = exits[0]!;
      } else if (exits.length === 2) {
        // T-junction: use timed switch state, then schedule flip
        const state = switches[nk] ?? 0;
        nextDir = exits[state]!;
        flipsThisTick.push(nk);
      } else {
        // 4-way crossing: proceed straight
        nextDir = tr.dir;
      }

      tr.r = nr;
      tr.c = nc;
      tr.dir = nextDir;
    }

    // Apply switch flips after both trains evaluate the tick
    for (const k of flipsThisTick) {
      switches[k] = (switches[k] ?? 0) === 0 ? 1 : 0;
    }

    frames.push({
      tick,
      trains: { A: { ...trains.A }, B: { ...trains.B } },
      switches: { ...switches },
    });

    // Vertex collision
    if (trains.A.r === trains.B.r && trains.A.c === trains.B.c) {
      return {
        status: 'COLLISION_VERTEX',
        ticks: tick,
        at: { r: trains.A.r, c: trains.A.c },
        message: `COLLISION AT ${coordLabel(trains.A.r, trains.A.c)}`,
        frames,
      };
    }

    // Head-on edge swap collision
    if (
      trains.A.r === prevB.r &&
      trains.A.c === prevB.c &&
      trains.B.r === prevA.r &&
      trains.B.c === prevA.c
    ) {
      return {
        status: 'COLLISION_HEADON',
        ticks: tick,
        at: { r: trains.A.r, c: trains.A.c },
        message: `HEAD-ON COLLISION AT ${coordLabel(trains.A.r, trains.A.c)}`,
        frames,
      };
    }

    if (trains.A.docked && trains.B.docked) {
      return {
        status: 'WIN',
        ticks: tick,
        tileCount: trackSet.size,
        frames,
      };
    }
  }

  return {
    status: 'LOOP',
    ticks: MAX_TICKS,
    at: { r: trains.A.r, c: trains.A.c },
    message: 'INFINITE LOOP DETECTED',
    frames,
  };
}
