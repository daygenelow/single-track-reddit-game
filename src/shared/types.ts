export type Dir = 'N' | 'E' | 'S' | 'W';
export type LineId = 'A' | 'B';
export type ObstacleKind = 'water' | 'park';

export interface Coord {
  r: number; // 0..5
  c: number; // 0..5
}

export interface DepotSpec extends Coord {
  line: LineId;
  dir: Dir; // Initial departure direction
}

export interface StationSpec extends Coord {
  line: LineId;
}

export interface ObstacleSpec extends Coord {
  kind: ObstacleKind;
}

export interface PuzzleDef {
  id: string;
  edition: number;
  date: string; // YYYY-MM-DD (UTC)
  name: string;
  baselinePar: number;
  depots: [DepotSpec, DepotSpec];
  stations: [StationSpec, StationSpec];
  obstacles: ObstacleSpec[];
}

export interface BoardState {
  tracks: string[]; // "r,c" keys
  switches: Record<string, 0 | 1>; // "r,c" -> initial toggle state for T-junctions
}

export interface TrainFrame {
  line: LineId;
  r: number;
  c: number;
  dir: Dir;
  docked: boolean;
}

export interface SimTick {
  tick: number;
  trains: Record<LineId, TrainFrame>;
  switches: Record<string, 0 | 1>;
}

export type SimOutcome =
  | { status: 'WIN'; ticks: number; tileCount: number; frames: SimTick[] }
  | {
      status: 'COLLISION_VERTEX' | 'COLLISION_HEADON' | 'DERAIL' | 'LOOP';
      ticks: number;
      at: Coord;
      line?: LineId;
      message: string;
      frames: SimTick[];
    };

export interface UserDailyState {
  completed: boolean;
  bestTiles: number | null;
  ticks: number | null;
  shared: boolean;
  gridHash: string | null;
}

export interface UserStreak {
  current: number;
  best: number;
  lastPlayedDate: string | null;
}

export interface InitResponse {
  puzzle: PuzzleDef;
  currentPar: number;
  recordHolder: string | null;
  totalPlays: number;
  userDaily: UserDailyState;
  streak: UserStreak;
  username: string;
  isModOrDev: boolean;
}

export interface SubmitResponse {
  ok: boolean;
  error?: string;
  tileCount: number;
  ticks: number;
  beatPercent: number;
  currentPar: number;
  recordHolder: string;
  isNewRecord: boolean;
  streak: UserStreak;
  unlockedFlair: string | null;
}