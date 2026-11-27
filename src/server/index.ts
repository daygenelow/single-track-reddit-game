import express from 'express';
import { createServer, context, redis, reddit } from '@devvit/web/server';
import { getDailyPuzzle, getUtcDateKey } from '../shared/puzzle.ts';
import { simulate } from '../shared/sim.ts';
import type { BoardState, InitResponse, SubmitResponse, UserDailyState, UserStreak } from '../shared/types.ts';

const app = express();
app.use(express.json());

const DEFAULT_DAILY: UserDailyState = {
  completed: false,
  bestTiles: null,
  ticks: null,
  shared: false,
  gridHash: null,
};

const DEFAULT_STREAK: UserStreak = {
  current: 0,
  best: 0,
  lastPlayedDate: null,
};

function flairForStreak(streak: number): string | null {
  if (streak >= 14) return 'Chief Rail Architect';
  if (streak >= 7) return 'Line Dispatcher';
  if (streak >= 3) return 'Transit Commuter';
  return null;
}

app.get('/api/init', async (req, res) => {
  try {
    const devSeed = req.query.devSeed !== undefined ? Number(req.query.devSeed) : undefined;
    const date = getUtcDateKey();
    const puzzle = getDailyPuzzle(date, devSeed);
    const user = await reddit.getCurrentUser();
    const userId = user?.id ?? 'anon';
    const username = user?.username ?? 'commuter';

    const parKey = `st:daily:${date}:par`;
    const holderKey = `st:daily:${date}:record_holder`;
    const playsKey = `st:daily:${date}:plays`;
    const userDailyKey = `st:user:${userId}:daily:${date}`;
    const streakKey = `st:user:${userId}:streak`;

    const [parRaw, recordHolder, playsRaw, dailyRaw, streakRaw] = await Promise.all([
      redis.get(parKey),
      redis.get(holderKey),
      redis.get(playsKey),
      redis.get(userDailyKey),
      redis.get(streakKey),
    ]);

    const currentPar = parRaw ? Number(parRaw) : puzzle.baselinePar;
    if (!parRaw) await redis.set(parKey, String(puzzle.baselinePar));

    const payload: InitResponse = {
      puzzle,
      currentPar,
      recordHolder: recordHolder ?? null,
      totalPlays: playsRaw ? Number(playsRaw) : 0,
      userDaily: dailyRaw ? JSON.parse(dailyRaw) : DEFAULT_DAILY,
      streak: streakRaw ? JSON.parse(streakRaw) : DEFAULT_STREAK,
      username,
      isModOrDev: Boolean(context.subredditName),
    };

    res.json(payload);
  } catch (err) {
    console.error('Init error:', err);
    res.status(500).json({ error: 'Failed to initialize dispatch.' });
  }
});

app.post('/api/submit', async (req, res) => {
  try {
    const { board, devSeed } = req.body as { board: BoardState; devSeed?: number };
    const date = getUtcDateKey();
    const puzzle = getDailyPuzzle(date, devSeed);

    const result = simulate(puzzle, board);
    if (result.status !== 'WIN') {
      return res.status(400).json({ ok: false, error: result.message });
    }

    const user = await reddit.getCurrentUser();
    const userId = user?.id ?? 'anon';
    const username = user?.username ?? 'commuter';

    const parKey = `st:daily:${date}:par`;
    const holderKey = `st:daily:${date}:record_holder`;
    const scoresKey = `st:daily:${date}:scores`;
    const playsKey = `st:daily:${date}:plays`;
    const userDailyKey = `st:user:${userId}:daily:${date}`;
    const streakKey = `st:user:${userId}:streak`;

    const [parRaw, holderRaw, dailyRaw, streakRaw] = await Promise.all([
      redis.get(parKey),
      redis.get(holderKey),
      redis.get(userDailyKey),
      redis.get(streakKey),
    ]);

    let currentPar = parRaw ? Number(parRaw) : puzzle.baselinePar;
    let recordHolder = holderRaw ?? 'Baseline';
    let isNewRecord = false;

    if (result.tileCount < currentPar) {
      currentPar = result.tileCount;
      recordHolder = username;
      isNewRecord = true;
      await Promise.all([
        redis.set(parKey, String(currentPar)),
        redis.set(holderKey, recordHolder),
      ]);
    }

    const prevDaily: UserDailyState = dailyRaw ? JSON.parse(dailyRaw) : DEFAULT_DAILY;
    const isFirstSolveToday = !prevDaily.completed;

    if (isFirstSolveToday) {
      await redis.incrBy(playsKey, 1);
    }

    const bestTiles =
      prevDaily.bestTiles === null
        ? result.tileCount
        : Math.min(prevDaily.bestTiles, result.tileCount);

    await redis.zAdd(scoresKey, { member: userId, score: bestTiles });

    const [totalScored, worseOrEqual] = await Promise.all([
      redis.zCard(scoresKey),
      redis.zRange(scoresKey, bestTiles, '+inf', { by: 'score' }),
    ]);
    const beatPercent =
      totalScored <= 1
        ? 100
        : Math.round(((worseOrEqual.length - 1) / (totalScored - 1)) * 100);

    const streak: UserStreak = streakRaw ? JSON.parse(streakRaw) : { ...DEFAULT_STREAK };
    const yesterday = getUtcDateKey(-1);
    let unlockedFlair: string | null = null;

    if (streak.lastPlayedDate !== date) {
      streak.current = streak.lastPlayedDate === yesterday ? streak.current + 1 : 1;
      streak.best = Math.max(streak.best, streak.current);
      streak.lastPlayedDate = date;
      await redis.set(streakKey, JSON.stringify(streak));

      const flairText = flairForStreak(streak.current);
      if (flairText && user?.username && context.subredditName) {
        try {
          await reddit.setUserFlair({
            subredditName: context.subredditName,
            username: user.username,
            text: flairText,
          });
          unlockedFlair = flairText;
        } catch {
          // Graceful fallback in test subreddits without flair permissions
        }
      }
    }

    const nextDaily: UserDailyState = {
      completed: true,
      bestTiles,
      ticks: result.ticks,
      shared: prevDaily.shared,
      gridHash: board.tracks.slice().sort().join('|'),
    };
    await redis.set(userDailyKey, JSON.stringify(nextDaily));

    const payload: SubmitResponse = {
      ok: true,
      tileCount: result.tileCount,
      ticks: result.ticks,
      beatPercent: Math.max(1, Math.min(99, beatPercent)),
      currentPar,
      recordHolder,
      isNewRecord,
      streak,
      unlockedFlair,
    };

    res.json(payload);
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ ok: false, error: 'Server validation failed.' });
  }
});

app.post('/api/share', async (req, res) => {
  try {
    const { tiles, par, ticks, streak, beatPercent, edition } = req.body;
    const date = getUtcDateKey();
    const user = await reddit.getCurrentUser();
    const userId = user?.id ?? 'anon';
    const userDailyKey = `st:user:${userId}:daily:${date}`;
    const dailyRaw = await redis.get(userDailyKey);
    const daily: UserDailyState = dailyRaw ? JSON.parse(dailyRaw) : DEFAULT_DAILY;

    if (daily.shared && daily.bestTiles !== null && tiles >= daily.bestTiles) {
      return res.json({ ok: true, alreadyShared: true });
    }

    const editionStr = String(edition).padStart(3, '0');
    const text = [
      `**SINGLE-TRACK #${editionStr}** — ${tiles} Tiles (Subreddit Par: ${par})`,
      '```text',
      '[A] ━━━┫━━━ [A]',
      '[B] ━━━╋━━━ [B]',
      '```',
      `Ticks: ${ticks} | Streak: ${streak}d | Beat ${beatPercent}% of commuters`,
    ].join('\n');

    if (context.postId) {
      await reddit.submitComment({ id: context.postId, text });
    }

    daily.shared = true;
    await redis.set(userDailyKey, JSON.stringify(daily));
    res.json({ ok: true });
  } catch (err) {
    console.error('Share error:', err);
    res.status(500).json({ ok: false, error: 'Could not post comment.' });
  }
});

app.post('/internal/on/menu/new-post', async (_req, res) => {
  try {
    const post = await reddit.submitCustomPost({ title: context.appSlug });
    res.json({
      showToast: { text: `Post ${post.id} created.`, appearance: 'success' },
      navigateTo: post.url,
    });
  } catch (err) {
    console.error('Menu new-post error:', err);
    res.status(500).json({ status: 500, error: String(err) });
  }
});

app.post('/internal/on/app/install', async (_req, res) => {
  try {
    await reddit.submitCustomPost({ title: context.appSlug });
    res.json({});
  } catch (err) {
    console.error('App install error:', err);
    res.status(500).json({ status: 500, error: String(err) });
  }
});

const server = createServer(app);
server.listen(process.env.PORT ?? 3000);
