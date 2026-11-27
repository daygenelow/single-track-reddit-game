import type { PuzzleDef } from './types.ts';

function hashDate(dateStr: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 14 hand-tuned 6x6 puzzles with shared-rail bottlenecks */
const CURATED_PACK: Omit<PuzzleDef, 'edition' | 'date'>[] = [
  {
    id: 'hudson-choke',
    name: 'HUDSON CHOKEPOINT',
    baselinePar: 9,
    depots: [
      { line: 'A', r: 1, c: 0, dir: 'E' },
      { line: 'B', r: 4, c: 0, dir: 'E' },
    ],
    stations: [
      { line: 'A', r: 4, c: 5 },
      { line: 'B', r: 1, c: 5 },
    ],
    obstacles: [
      { r: 0, c: 2, kind: 'water' },
      { r: 1, c: 2, kind: 'water' },
      { r: 4, c: 2, kind: 'water' },
      { r: 5, c: 2, kind: 'water' },
      { r: 2, c: 4, kind: 'park' },
    ],
  },
  {
    id: 'midtown-cross',
    name: 'MIDTOWN CROSSING',
    baselinePar: 10,
    depots: [
      { line: 'A', r: 0, c: 1, dir: 'S' },
      { line: 'B', r: 2, c: 0, dir: 'E' },
    ],
    stations: [
      { line: 'A', r: 5, c: 4 },
      { line: 'B', r: 2, c: 5 },
    ],
    obstacles: [
      { r: 0, c: 3, kind: 'park' },
      { r: 1, c: 3, kind: 'park' },
      { r: 4, c: 1, kind: 'water' },
      { r: 4, c: 2, kind: 'water' },
    ],
  },
  {
    id: 'east-river-switch',
    name: 'EAST RIVER SWITCH',
    baselinePar: 11,
    depots: [
      { line: 'A', r: 0, c: 0, dir: 'E' },
      { line: 'B', r: 5, c: 0, dir: 'E' },
    ],
    stations: [
      { line: 'A', r: 5, c: 5 },
      { line: 'B', r: 0, c: 5 },
    ],
    obstacles: [
      { r: 1, c: 2, kind: 'water' },
      { r: 2, c: 2, kind: 'water' },
      { r: 3, c: 3, kind: 'park' },
      { r: 4, c: 3, kind: 'park' },
    ],
  },
  {
    id: 'central-loop',
    name: 'CENTRAL PARK BYPASS',
    baselinePar: 11,
    depots: [
      { line: 'A', r: 1, c: 0, dir: 'E' },
      { line: 'B', r: 0, c: 4, dir: 'S' },
    ],
    stations: [
      { line: 'A', r: 4, c: 5 },
      { line: 'B', r: 5, c: 1 },
    ],
    obstacles: [
      { r: 2, c: 2, kind: 'park' },
      { r: 2, c: 3, kind: 'park' },
      { r: 3, c: 2, kind: 'park' },
      { r: 3, c: 3, kind: 'park' },
    ],
  },
  {
    id: 'canal-split',
    name: 'CANAL STREET SPLIT',
    baselinePar: 9,
    depots: [
      { line: 'A', r: 2, c: 0, dir: 'E' },
      { line: 'B', r: 5, c: 2, dir: 'N' },
    ],
    stations: [
      { line: 'A', r: 0, c: 5 },
      { line: 'B', r: 2, c: 5 },
    ],
    obstacles: [
      { r: 0, c: 2, kind: 'water' },
      { r: 1, c: 2, kind: 'water' },
      { r: 4, c: 4, kind: 'park' },
      { r: 5, c: 4, kind: 'park' },
    ],
  },
  // Days 6-14 cycle cleanly with distinct obstacle/depot symmetries
  {
    id: 'battery-neck',
    name: 'BATTERY NECK',
    baselinePar: 10,
    depots: [
      { line: 'A', r: 0, c: 2, dir: 'S' },
      { line: 'B', r: 0, c: 3, dir: 'S' },
    ],
    stations: [
      { line: 'A', r: 5, c: 5 },
      { line: 'B', r: 5, c: 0 },
    ],
    obstacles: [
      { r: 2, c: 0, kind: 'water' },
      { r: 2, c: 1, kind: 'water' },
      { r: 2, c: 4, kind: 'water' },
      { r: 2, c: 5, kind: 'water' },
    ],
  },
  {
    id: 'harlem-merge',
    name: 'HARLEM MERGE',
    baselinePar: 10,
    depots: [
      { line: 'A', r: 0, c: 0, dir: 'S' },
      { line: 'B', r: 3, c: 0, dir: 'E' },
    ],
    stations: [
      { line: 'A', r: 3, c: 5 },
      { line: 'B', r: 0, c: 5 },
    ],
    obstacles: [
      { r: 1, c: 1, kind: 'park' },
      { r: 1, c: 2, kind: 'park' },
      { r: 4, c: 3, kind: 'water' },
      { r: 5, c: 3, kind: 'water' },
    ],
  },
  {
    id: 'queens-bridge',
    name: 'QUEENSBORO BRIDGE',
    baselinePar: 11,
    depots: [
      { line: 'A', r: 1, c: 0, dir: 'E' },
      { line: 'B', r: 4, c: 0, dir: 'E' },
    ],
    stations: [
      { line: 'A', r: 1, c: 5 },
      { line: 'B', r: 4, c: 5 },
    ],
    obstacles: [
      { r: 0, c: 3, kind: 'water' },
      { r: 1, c: 3, kind: 'water' },
      { r: 3, c: 3, kind: 'water' },
      { r: 4, c: 3, kind: 'water' },
      { r: 5, c: 3, kind: 'water' },
    ],
  },
  {
    id: 'fulton-hub',
    name: 'FULTON HUB',
    baselinePar: 10,
    depots: [
      { line: 'A', r: 5, c: 1, dir: 'N' },
      { line: 'B', r: 1, c: 5, dir: 'W' },
    ],
    stations: [
      { line: 'A', r: 0, c: 4 },
      { line: 'B', r: 4, c: 0 },
    ],
    obstacles: [
      { r: 0, c: 1, kind: 'park' },
      { r: 1, c: 1, kind: 'park' },
      { r: 4, c: 4, kind: 'water' },
      { r: 5, c: 4, kind: 'water' },
    ],
  },
  {
    id: 'astoria-bend',
    name: 'ASTORIA BEND',
    baselinePar: 10,
    depots: [
      { line: 'A', r: 0, c: 0, dir: 'E' },
      { line: 'B', r: 2, c: 0, dir: 'E' },
    ],
    stations: [
      { line: 'A', r: 5, c: 3 },
      { line: 'B', r: 5, c: 5 },
    ],
    obstacles: [
      { r: 1, c: 3, kind: 'water' },
      { r: 2, c: 3, kind: 'water' },
      { r: 3, c: 1, kind: 'park' },
      { r: 4, c: 1, kind: 'park' },
    ],
  },
  {
    id: 'soho-weave',
    name: 'SOHO WEAVE',
    baselinePar: 11,
    depots: [
      { line: 'A', r: 0, c: 5, dir: 'W' },
      { line: 'B', r: 5, c: 0, dir: 'E' },
    ],
    stations: [
      { line: 'A', r: 5, c: 5 },
      { line: 'B', r: 0, c: 0 },
    ],
    obstacles: [
      { r: 2, c: 1, kind: 'park' },
      { r: 2, c: 4, kind: 'park' },
      { r: 3, c: 1, kind: 'water' },
      { r: 3, c: 4, kind: 'water' },
    ],
  },
  {
    id: 'lexington-express',
    name: 'LEXINGTON EXPRESS',
    baselinePar: 9,
    depots: [
      { line: 'A', r: 0, c: 1, dir: 'S' },
      { line: 'B', r: 0, c: 4, dir: 'S' },
    ],
    stations: [
      { line: 'A', r: 5, c: 4 },
      { line: 'B', r: 5, c: 1 },
    ],
    obstacles: [
      { r: 2, c: 0, kind: 'park' },
      { r: 2, c: 5, kind: 'park' },
      { r: 3, c: 0, kind: 'water' },
      { r: 3, c: 5, kind: 'water' },
    ],
  },
  {
    id: 'brooklyn-neck',
    name: 'BROOKLYN NECK',
    baselinePar: 10,
    depots: [
      { line: 'A', r: 1, c: 0, dir: 'E' },
      { line: 'B', r: 5, c: 3, dir: 'N' },
    ],
    stations: [
      { line: 'A', r: 1, c: 5 },
      { line: 'B', r: 0, c: 3 },
    ],
    obstacles: [
      { r: 0, c: 1, kind: 'water' },
      { r: 3, c: 1, kind: 'park' },
      { r: 3, c: 4, kind: 'park' },
      { r: 4, c: 4, kind: 'water' },
    ],
  },
  {
    id: 'grand-central',
    name: 'GRAND CENTRAL',
    baselinePar: 12,
    depots: [
      { line: 'A', r: 2, c: 0, dir: 'E' },
      { line: 'B', r: 0, c: 2, dir: 'S' },
    ],
    stations: [
      { line: 'A', r: 3, c: 5 },
      { line: 'B', r: 5, c: 3 },
    ],
    obstacles: [
      { r: 1, c: 4, kind: 'park' },
      { r: 4, c: 1, kind: 'water' },
      { r: 0, c: 5, kind: 'water' },
      { r: 5, c: 0, kind: 'park' },
    ],
  },
];

export function getUtcDateKey(offsetDays = 0): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  return now.toISOString().slice(0, 10);
}

export function getDailyPuzzle(dateStr: string, devSeedOverride?: number): PuzzleDef {
  const epoch = Date.UTC(2026, 9, 16); // Edition #1 anchor
  const [y = 2026, m = 1, d = 1] = dateStr.split('-').map(Number);
  const current = Date.UTC(y, m - 1, d);
  const edition = Math.max(1, Math.floor((current - epoch) / 86_400_000) + 1);

  if (typeof devSeedOverride === 'number') {
    const picked = CURATED_PACK[devSeedOverride % CURATED_PACK.length]!;
    return { ...picked, edition, date: dateStr };
  }

  const rng = mulberry32(hashDate(dateStr));
  const idx = (edition - 1) < CURATED_PACK.length
    ? edition - 1
    : Math.floor(rng() * CURATED_PACK.length);

  return {
    ...CURATED_PACK[idx]!,
    edition,
    date: dateStr,
  };
}
