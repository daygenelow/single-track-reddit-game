import React, { useCallback, useEffect, useState } from 'react';
import { keyOf, simulate } from '../shared/sim';
import type { BoardState, Coord, InitResponse, SimTick, SubmitResponse } from '../shared/types.ts';
import { synth } from './audio/synth';
import { TransitBoard } from './components/TransitBoard';

export default function App() {
  const [init, setInit] = useState<InitResponse | null>(null);
  const [screen, setScreen] = useState<'start' | 'play'>('start');
  const [board, setBoard] = useState<BoardState>({ tracks: [], switches: {} });
  const [history, setHistory] = useState<BoardState[]>([]);
  const [muted, setMuted] = useState(false);

  const [isSimulating, setIsSimulating] = useState(false);
  const [activeFrame, setActiveFrame] = useState<SimTick | null>(null);
  const [failBanner, setFailBanner] = useState<string | null>(null);
  const [failAt, setFailAt] = useState<Coord | null>(null);

  const [report, setReport] = useState<SubmitResponse | null>(null);
  const [shared, setShared] = useState(false);
  const [devSeed, setDevSeed] = useState<number | undefined>(undefined);

  const fetchInit = useCallback(async (seed?: number) => {
    const q = seed !== undefined ? `?devSeed=${seed}` : '';
    const res = await fetch(`/api/init${q}`);
    const data: InitResponse = await res.json();
    setInit(data);
    setShared(data.userDaily.shared);
    setBoard({ tracks: [], switches: {} });
    setHistory([]);
    setReport(null);
    setFailBanner(null);
    setFailAt(null);
    setActiveFrame(null);
  }, []);

  useEffect(() => {
    fetchInit(devSeed);
  }, [fetchInit, devSeed]);

  // Judge / Dev shortcut: Shift + D cycles 3 seeds (Easy / Medium / Hard)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === 'd') {
        setDevSeed((prev) => (prev === undefined ? 0 : (prev + 1) % 3));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handlePaintCell = (r: number, c: number, mode: 'add' | 'remove') => {
    setFailBanner(null);
    setFailAt(null);
    setBoard((prev) => {
      const k = keyOf(r, c);
      const exists = prev.tracks.includes(k);
      if (mode === 'add' && exists) return prev;
      if (mode === 'remove' && !exists) return prev;

      setHistory((h) => [...h.slice(-20), prev]);
      if (mode === 'add') synth.placeTrack();
      else synth.removeTrack();

      const nextTracks = mode === 'add' ? [...prev.tracks, k] : prev.tracks.filter((t) => t !== k);
      return { ...prev, tracks: nextTracks };
    });
  };

  const handleToggleSwitch = (r: number, c: number) => {
    synth.toggleSwitch();
    const k = keyOf(r, c);
    setBoard((prev) => ({
      ...prev,
      switches: { ...prev.switches, [k]: (prev.switches[k] ?? 0) === 0 ? 1 : 0 },
    }));
  };

  const handleDispatch = () => {
    if (!init) return;
    if (isSimulating) {
      setIsSimulating(false);
      setActiveFrame(null);
      return;
    }

    setFailBanner(null);
    setFailAt(null);
    const outcome = simulate(init.puzzle, board);
    setIsSimulating(true);

    let idx = 0;
    const step = () => {
      if (idx >= outcome.frames.length) {
        setIsSimulating(false);
        if (outcome.status === 'WIN') {
          synth.win();
          fetch('/api/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ board, devSeed }),
          })
            .then((r) => r.json())
            .then((data: SubmitResponse) => {
              if (data.ok) setReport(data);
            });
        } else {
          synth.fail();
          setFailBanner(outcome.message);
          setFailAt(outcome.at);
        }
        return;
      }

      setActiveFrame(outcome.frames[idx] ?? null);
      if (idx > 0) synth.tick();
      idx++;
      timerRef = window.setTimeout(step, 350);
    };

    let timerRef = window.setTimeout(step, 40);
    return () => window.clearTimeout(timerRef);
  };

  const handleShare = async () => {
    if (!init || !report || shared) return;
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tiles: report.tileCount,
        par: report.currentPar,
        ticks: report.ticks,
        streak: report.streak.current,
        beatPercent: report.beatPercent,
        edition: init.puzzle.edition,
      }),
    });
    if (res.ok) setShared(true);
  };

  if (!init) {
    return (
      <div className="h-dvh max-h-[600px] flex items-center justify-center text-xs font-bold tracking-widest uppercase">
        LOADING DISPATCH...
      </div>
    );
  }

  if (screen === 'start') {
    return (
      <div className="h-dvh max-h-[600px] flex flex-col justify-between p-6 max-w-md mx-auto">
        <div className="border-t-4 border-[#111111] pt-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-full bg-[#D9381E] text-[#F5F2EB] font-extrabold text-sm flex items-center justify-center">A</span>
            <span className="w-7 h-7 rounded-full bg-[#0057B8] text-[#F5F2EB] font-extrabold text-sm flex items-center justify-center">B</span>
            <span className="text-2xl font-extrabold tracking-tight">SINGLE-TRACK</span>
          </div>
          <p className="text-sm text-[#5A5750] font-medium">
            Route both trains. Share the rails. Beat today&apos;s Par.
          </p>
        </div>

        <div className="border-y border-[#111111] py-4 space-y-2 text-xs font-bold tracking-wider uppercase tabular-nums">
          <div className="flex justify-between">
            <span>EDITION #{String(init.puzzle.edition).padStart(3, '0')}</span>
            <span>{init.puzzle.name}</span>
          </div>
          <div className="flex justify-between text-[#5A5750]">
            <span>SUBREDDIT PAR: {init.currentPar} TILES</span>
            <span>STREAK: {init.streak.current} DAYS</span>
          </div>
        </div>

        <button
          onClick={() => setScreen('play')}
          className="w-full py-4 bg-[#111111] text-[#F5F2EB] font-extrabold tracking-widest uppercase text-sm active:opacity-80"
        >
          {init.userDaily.completed ? 'IMPROVE ROUTE' : 'OPEN DISPATCH'}
        </button>
      </div>
    );
  }

  return (
    <div className="h-dvh max-h-[600px] flex flex-col justify-between max-w-md mx-auto px-3 py-2 relative">
      {/* Top HUD (44px) */}
      <header className="h-11 flex items-center justify-between border-b-2 border-[#111111] text-xs font-extrabold tracking-wider uppercase tabular-nums">
        <div>
          #{String(init.puzzle.edition).padStart(3, '0')} &middot; PAR {init.currentPar}
        </div>
        <div className="text-sm">TILES: {board.tracks.length}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              synth.muted = !muted;
              setMuted(!muted);
            }}
            className="px-2 py-1 border border-[#111111]"
            aria-label="Toggle Audio"
          >
            {muted ? 'MUTE' : 'SFX'}
          </button>
          <button
            onClick={() => {
              setBoard({ tracks: [], switches: {} });
              setFailBanner(null);
              setFailAt(null);
              setActiveFrame(null);
            }}
            className="px-2 py-1 border border-[#111111]"
          >
            CLR
          </button>
        </div>
      </header>

      {/* Center Canvas */}
      <main className="flex-1 flex flex-col items-center justify-center relative">
        <TransitBoard
          puzzle={init.puzzle}
          board={board}
          activeFrame={activeFrame}
          failAt={failAt}
          isSimulating={isSimulating}
          showOnboardingHint={!init.userDaily.completed && board.tracks.length < 3}
          onPaintCell={handlePaintCell}
          onToggleSwitch={handleToggleSwitch}
        />
        {failBanner && (
          <div className="mt-2 px-3 py-1 bg-[#FF2A2A] text-[#F5F2EB] text-xs font-extrabold tracking-wider uppercase">
            {failBanner}
          </div>
        )}
      </main>

      {/* Bottom Controls (56px) */}
      <footer className="h-14 flex items-center gap-2 border-t-2 border-[#111111] pt-2">
        <button
          disabled={history.length === 0 || isSimulating}
          onClick={() => {
            const prev = history[history.length - 1];
            if (!prev) return;
            setHistory((h) => h.slice(0, -1));
            setBoard(prev);
          }}
          className="h-11 px-4 border-2 border-[#111111] text-xs font-extrabold uppercase disabled:opacity-30"
        >
          UNDO
        </button>
        <button
          onClick={handleDispatch}
          className="flex-1 h-11 bg-[#111111] text-[#F5F2EB] text-sm font-extrabold tracking-widest uppercase"
        >
          {isSimulating ? 'STOP / EDIT' : 'DISPATCH'}
        </button>
      </footer>

      {/* Dispatch Report End-State Card */}
      {report && (
        <div className="absolute inset-0 bg-[#F5F2EB]/95 flex items-center justify-center p-5">
          <div className="w-full border-4 border-[#111111] bg-[#F5F2EB] p-5 space-y-4">
            <div className="border-b-2 border-[#111111] pb-2">
              <div className="text-xl font-extrabold tracking-tight uppercase">
                {report.isNewRecord ? 'NEW SUBREDDIT RECORD!' : 'ROUTE CLEARED'}
              </div>
              <div className="text-xs font-bold text-[#5A5750] uppercase">
                {init.puzzle.name} &middot; {report.ticks} TICKS
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center tabular-nums border-b border-[#DDD8CE] pb-3">
              <div>
                <div className="text-[10px] font-bold text-[#5A5750]">YOUR TILES</div>
                <div className="text-xl font-extrabold">{report.tileCount}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-[#5A5750]">PAR</div>
                <div className="text-xl font-extrabold">{report.currentPar}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-[#5A5750]">BEAT</div>
                <div className="text-xl font-extrabold">{report.beatPercent}%</div>
              </div>
            </div>

            {report.unlockedFlair && (
              <div className="text-xs font-extrabold bg-[#111111] text-[#F5F2EB] px-3 py-1.5 uppercase text-center">
                FLAIR UNLOCKED: {report.unlockedFlair}
              </div>
            )}

            <button
              onClick={handleShare}
              disabled={shared}
              className="w-full py-3 bg-[#111111] text-[#F5F2EB] text-xs font-extrabold tracking-widest uppercase disabled:opacity-60"
            >
              {shared ? 'SHARED âœ“' : 'SHARE TO COMMENTS'}
            </button>

            <button
              onClick={() => {
                setReport(null);
                setActiveFrame(null);
              }}
              className="w-full py-2.5 border-2 border-[#111111] text-xs font-extrabold tracking-widest uppercase"
            >
              OPTIMIZE ROUTE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

