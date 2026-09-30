import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils";
import Dice from "@/src/components/Dice";
import type { SnakeLadderRoomState } from "@/src/games/snake-ladder/types";
import { playWinCrackers } from "@/src/lib/sounds";

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function cellForNumber(n: number) {
  const idx = n - 1;
  const rowFromBottom = Math.floor(idx / 10);
  const colInRow = idx % 10;
  const reversed = rowFromBottom % 2 === 1;
  const col = reversed ? 9 - colInRow : colInRow;
  const row = 9 - rowFromBottom;
  return { row, col };
}

function centerForNumber(n: number, boardSize: number) {
  const { row, col } = cellForNumber(n);
  const cell = boardSize / 10;
  return { x: col * cell + cell / 2, y: row * cell + cell / 2 };
}

function boardCellPalette(n: number) {
  const palettes = [
    { bg: "#f6d64a", accent: "#b78112", text: "#6f4a0c" },
    { bg: "#3fa8d9", accent: "#1d6d96", text: "#ffffff" },
    { bg: "#d95840", accent: "#8e2d23", text: "#fff8dd" },
    { bg: "#7fb35b", accent: "#466e2f", text: "#f4ffe7" },
    { bg: "#fbf4de", accent: "#c7ab66", text: "#52401c" },
  ];
  return palettes[(n - 1) % palettes.length];
}

function ladderGeometry(x1: number, y1: number, x2: number, y2: number, inset: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;
  const railOffset = inset * 0.28;
  const innerStartX = x1 + ux * inset;
  const innerStartY = y1 + uy * inset;
  const innerEndX = x2 - ux * inset;
  const innerEndY = y2 - uy * inset;
  const rungCount = Math.max(4, Math.floor(length / 42));
  return {
    leftStart: { x: innerStartX + px * railOffset, y: innerStartY + py * railOffset },
    leftEnd: { x: innerEndX + px * railOffset, y: innerEndY + py * railOffset },
    rightStart: { x: innerStartX - px * railOffset, y: innerStartY - py * railOffset },
    rightEnd: { x: innerEndX - px * railOffset, y: innerEndY - py * railOffset },
    rungCount,
    unit: { x: ux, y: uy },
    normal: { x: px, y: py },
    innerStart: { x: innerStartX, y: innerStartY },
    innerEnd: { x: innerEndX, y: innerEndY },
  };
}

function snakePath(x1: number, y1: number, x2: number, y2: number, wiggle: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;
  const startInset = Math.min(18, length * 0.12);
  const endInset = Math.min(16, length * 0.1);
  const start = { x: x1 + ux * startInset, y: y1 + uy * startInset };
  const end = { x: x2 - ux * endInset, y: y2 - uy * endInset };
  const c1 = { x: start.x + dx * 0.22 + px * wiggle, y: start.y + dy * 0.22 + py * wiggle };
  const c2 = { x: start.x + dx * 0.46 - px * wiggle * 0.85, y: start.y + dy * 0.46 - py * wiggle * 0.85 };
  const c3 = { x: start.x + dx * 0.72 + px * wiggle * 0.7, y: start.y + dy * 0.72 + py * wiggle * 0.7 };
  return {
    body: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${c3.x} ${c3.y} S ${end.x} ${end.y}, ${end.x} ${end.y}`,
    start, end,
    unit: { x: ux, y: uy },
    normal: { x: px, y: py },
  };
}

const TOKEN_OFFSETS = [
  { dx: -0.32, dy: -0.18 },
  { dx: 0.32, dy: -0.18 },
  { dx: 0, dy: 0.28 },
];

export default function SnakeLadderBoard({
  room, myId, rolling, onRollDice, onMoveToken,
  onRestart,
}: {
  room: SnakeLadderRoomState;
  myId: string | null;
  rolling: boolean;
  onRollDice: () => void;
  onMoveToken: (tokenIndex: number) => void;
  onRestart: () => void;
}) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const boardSize = Math.min(size.width, size.height);
  const playInset = boardSize * (40 / 620);
  const playSize = Math.max(0, boardSize - playInset * 2);

  const dice = room.turn?.dice ?? room.lastRoll?.dice ?? null;
  const isMyTurn = !!myId && room.turn?.playerId === myId;
  const canRoll = room.gameState === "playing" && isMyTurn && room.turn?.phase === "roll";
  const canMove = room.gameState === "playing" && isMyTurn && room.turn?.phase === "move";

  const turnPlayer = useMemo(() => {
    if (!room.turn) return null;
    return room.players.find((p) => p.id === room.turn!.playerId) ?? null;
  }, [room.players, room.turn]);
  const me = useMemo(() => {
    if (!myId) return null;
    return room.players.find((p) => p.id === myId) ?? null;
  }, [myId, room.players]);
  const isOwner = !!me?.isOwner;

  const [displayPositions, setDisplayPositions] = useState<Record<string, number[]>>(() => room.positions ?? {});
  const animTimeoutsRef = useRef<number[]>([]);
  const lastMoveIdRef = useRef<number>(0);
  const animatingRef = useRef<string | null>(null);
  const winnerFxRef = useRef<string | null>(null);

  function clearAnimationTimeouts() {
    for (const timeout of animTimeoutsRef.current) window.clearTimeout(timeout);
    animTimeoutsRef.current = [];
  }

  useEffect(() => {
    setDisplayPositions((prev) => {
      const next: Record<string, number[]> = {};
      for (const key of Object.keys(room.positions ?? {})) {
        next[key] = [...(room.positions[key] ?? [0, 0, 0])];
      }
      const anim = animatingRef.current;
      if (anim && prev[anim]) {
        next[anim] = [...prev[anim]];
      }
      return next;
    });
  }, [room.positions]);

  useEffect(() => {
    const move = room.lastMove;
    if (!move || move.id === lastMoveIdRef.current) return;
    if (move.tokenIndex < 0) return;
    lastMoveIdRef.current = move.id;
    clearAnimationTimeouts();
    const key = `${move.by}`;
    animatingRef.current = key;

    const stepDelay = 220;
    const effectDelay = 420;
    const sequence: number[] = [];
    const start = clamp(move.from, 0, 100);
    const landed = clamp(move.to, 0, 100);
    const final = clamp(move.final, 0, 100);

    if (landed > start) {
      for (let n = start + 1; n <= landed; n += 1) sequence.push(n);
    } else if (landed < start) {
      for (let n = start - 1; n >= landed; n -= 1) sequence.push(n);
    }
    if ((move.effect === "snake" || move.effect === "ladder") && final !== landed) {
      sequence.push(final);
    }

    if (sequence.length === 0) {
      setDisplayPositions((prev) => {
        const arr = [...(prev[move.by] ?? [0, 0, 0])];
        arr[move.tokenIndex] = final;
        return { ...prev, [move.by]: arr };
      });
      animatingRef.current = null;
      return;
    }

    sequence.forEach((position, index) => {
      const isEffectStep = index === sequence.length - 1 && move.effect && final !== landed;
      const timeout = window.setTimeout(() => {
        setDisplayPositions((prev) => {
          const arr = [...(prev[move.by] ?? [0, 0, 0])];
          arr[move.tokenIndex] = position;
          return { ...prev, [move.by]: arr };
        });
        if (index === sequence.length - 1) {
          animatingRef.current = null;
          setDisplayPositions((prev) => {
            const result: Record<string, number[]> = { ...prev };
            for (const k of Object.keys(room.positions ?? {})) {
              result[k] = [...(room.positions[k] ?? [0, 0, 0])];
            }
            return result;
          });
        }
      }, index * stepDelay + (isEffectStep ? effectDelay : 0));
      animTimeoutsRef.current.push(timeout);
    });

    return () => { clearAnimationTimeouts(); };
  }, [room.lastMove, room.positions]);

  useEffect(() => {
    if (!room.winnerId || room.winnerId === winnerFxRef.current) return;
    winnerFxRef.current = room.winnerId;
    playWinCrackers();
  }, [room.winnerId]);

  const tokenSize = useMemo(() => clamp(boardSize * 0.05, 14, 22), [boardSize]);

  const movableTokens = useMemo(() => {
    if (!canMove || !myId || !room.turn?.dice) return new Set<number>();
    const tokens = room.positions[myId] ?? [0, 0, 0];
    const d = room.turn.dice;
    const set = new Set<number>();
    tokens.forEach((pos, idx) => {
      if (pos < 100 && pos + d <= 100) set.add(idx);
    });
    return set;
  }, [canMove, myId, room.turn, room.positions]);

  const overlayLines = useMemo(() => {
    if (!playSize) return [];
    const cell = playSize / 10;
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number; kind: "snake" | "ladder"; id: string; start: number; end: number }> = [];
    for (const [startStr, end] of Object.entries(room.ladders ?? {})) {
      const start = Number(startStr);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      const a = centerForNumber(start, playSize);
      const b = centerForNumber(end, playSize);
      const { row: sr, col: sc } = cellForNumber(start);
      const { row: er, col: ec } = cellForNumber(end);
      const biasX = (sc - ec) * cell * 0.08;
      const biasY = (sr - er) * cell * 0.08;
      lines.push({ x1: a.x + biasX, y1: a.y + biasY, x2: b.x + biasX, y2: b.y + biasY, kind: "ladder", id: `ladder-${start}-${end}`, start, end });
    }
    for (const [startStr, end] of Object.entries(room.snakes ?? {})) {
      const start = Number(startStr);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      const a = centerForNumber(start, playSize);
      const b = centerForNumber(end, playSize);
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, kind: "snake", id: `snake-${start}-${end}`, start, end });
    }
    return lines;
  }, [playSize, room.ladders, room.snakes]);

  // Token progress display
  const myTokens = myId ? (room.positions[myId] ?? [0, 0, 0]) : [0, 0, 0];
  const finishedCount = myId ? myTokens.filter(p => p >= 100).length : 0;

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Turn</div>
          <div className="mt-1 font-black text-slate-900 text-lg">
            {turnPlayer ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: turnPlayer.color ?? "#94A3B8" }} aria-hidden />
                {turnPlayer.username}
                {myId && turnPlayer.id === myId && <span className="text-indigo-600">• You</span>}
              </span>
            ) : (
              <span className="text-slate-500">—</span>
            )}
          </div>
          {room.gameState === "lobby" && (
            <div className="mt-1 text-sm text-slate-500 font-medium">Waiting for the host to start (2–4 players).</div>
          )}
          {room.gameState === "ended" && room.winnerId && (
            <div className="mt-2 space-y-2">
              <div className="text-sm font-black text-emerald-600">
                Winner: {room.players.find((p) => p.id === room.winnerId)?.username ?? "Unknown"}
              </div>
              {isOwner ? (
                <button
                  onClick={onRestart}
                  className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all active:scale-[0.98] hover:bg-emerald-700"
                >
                  Continue With Same Players
                </button>
              ) : (
                <div className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Waiting for host to continue...
                </div>
              )}
            </div>
          )}
          {room.gameState === "playing" && canMove && (
            <div className="mt-1 text-sm text-amber-600 font-black animate-pulse">
              🎯 Tap a token to move (+{room.turn?.dice})
            </div>
          )}
          {room.gameState === "playing" && !canMove && room.lastMove && room.lastMove.tokenIndex >= 0 && (
            <div className="mt-1 text-sm text-slate-500 font-medium">
              Rolled {room.lastMove.dice} • {room.lastMove.effect === "ladder" ? "Ladder climb!" : room.lastMove.effect === "snake" ? "Snake slide!" : "Move"}
            </div>
          )}
        </div>

        <Dice
          value={dice}
          rolling={rolling}
          onRoll={canRoll ? onRollDice : undefined}
          disabled={!canRoll || rolling}
          accentClassName="bg-emerald-600"
          label={canRoll ? "Roll Dice" : canMove ? "Pick Token" : "Waiting"}
        />
      </div>

      {/* Token progress bar */}
      {room.gameState === "playing" && myId && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Your Tokens:</span>
          {myTokens.map((pos, idx) => (
            <span key={idx} className={cn(
              "inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-black border-2",
              pos >= 100 ? "bg-emerald-500 text-white border-emerald-600" : "bg-slate-100 text-slate-600 border-slate-200"
            )}>
              {pos >= 100 ? "✓" : pos}
            </span>
          ))}
          <span className="text-[10px] font-black text-emerald-600 ml-1">{finishedCount}/3 done</span>
        </div>
      )}

      <div
        ref={ref}
        className="mt-5 relative w-full max-w-[620px] mx-auto aspect-square overflow-hidden rounded-[1.75rem] border-[8px] border-[#5d3927] bg-[#c98d55] shadow-[0_22px_50px_rgba(60,36,13,0.2)]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(120,72,28,0.14) 0px, rgba(120,72,28,0.14) 2px, transparent 2px, transparent 22px), linear-gradient(180deg, #d5a26c 0%, #c48346 100%)",
        }}
      >
        <div className="absolute inset-[12px] rounded-[1.25rem] border-[4px] border-[#f6e3b6] bg-[#f4d770]" />
        <div className="absolute inset-[26px] rounded-[0.9rem] border-[4px] border-[#874628] bg-[#f8efcf] shadow-inner" />

        <div className="absolute left-[40px] right-[40px] top-[40px] bottom-[40px] overflow-hidden rounded-[0.45rem] border-[3px] border-[#91502e] bg-[#f7efcf]">
        <div className="absolute inset-0 grid grid-cols-10 grid-rows-10">
          {Array.from({ length: 10 }).flatMap((_, row) => {
            const rowFromBottom = 9 - row;
            const reversed = rowFromBottom % 2 === 1;
            const base = rowFromBottom * 10;
            return Array.from({ length: 10 }).map((_, col) => {
              const n = base + (reversed ? 10 - col : col + 1);
              const palette = boardCellPalette(n);
              const isStart = n === 1;
              const isFinish = n === 100;
              return (
                <div
                  key={`${row}-${col}`}
                  className="relative border border-[#8c5b2f]/50"
                  style={{
                    backgroundColor: palette.bg,
                    backgroundImage:
                      "radial-gradient(circle at 25% 22%, rgba(255,255,255,0.2), transparent 34%), radial-gradient(circle at 70% 78%, rgba(0,0,0,0.06), transparent 42%)",
                  }}
                >
                  <div
                    className="absolute top-1.5 left-1.5 text-[10px] leading-none font-black"
                    style={{ color: palette.text, textShadow: "0 1px 0 rgba(255,255,255,0.35)" }}
                  >
                    {n}
                  </div>
                  {(isStart || isFinish) && (
                    <div
                      className="absolute inset-1 flex items-center justify-center text-center text-[8px] font-black uppercase tracking-[0.16em]"
                      style={{ color: palette.accent }}
                    >
                      {isStart ? "Start" : "Finish"}
                    </div>
                  )}
                </div>
              );
            });
          })}
        </div>

        <svg className="absolute inset-0" viewBox={`0 0 ${playSize} ${playSize}`} preserveAspectRatio="none">
          <defs>
            <filter id="board-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(55, 24, 9, 0.28)" />
            </filter>
          </defs>
          {overlayLines.map((l) => {
            if (l.kind === "ladder") {
              const geom = ladderGeometry(l.x1, l.y1, l.x2, l.y2, Math.max(8, boardSize * 0.018));
              const rungLines = Array.from({ length: geom.rungCount }).map((_, index) => {
                const t = (index + 1) / (geom.rungCount + 1);
                const cx = geom.innerStart.x + (geom.innerEnd.x - geom.innerStart.x) * t;
                const cy = geom.innerStart.y + (geom.innerEnd.y - geom.innerStart.y) * t;
                const half = boardSize * 0.02;
                return { x1: cx + geom.normal.x * half, y1: cy + geom.normal.y * half, x2: cx - geom.normal.x * half, y2: cy - geom.normal.y * half };
              });
              return (
                <g key={l.id} opacity={0.96} filter="url(#board-shadow)">
                  <line x1={geom.leftStart.x} y1={geom.leftStart.y} x2={geom.leftEnd.x} y2={geom.leftEnd.y} stroke="#2f5f8e" strokeWidth={boardSize * 0.013} strokeLinecap="round" />
                  <line x1={geom.rightStart.x} y1={geom.rightStart.y} x2={geom.rightEnd.x} y2={geom.rightEnd.y} stroke="#2f5f8e" strokeWidth={boardSize * 0.013} strokeLinecap="round" />
                  <line x1={geom.leftStart.x} y1={geom.leftStart.y} x2={geom.leftEnd.x} y2={geom.leftEnd.y} stroke="#91c2e3" strokeWidth={boardSize * 0.0045} strokeLinecap="round" />
                  <line x1={geom.rightStart.x} y1={geom.rightStart.y} x2={geom.rightEnd.x} y2={geom.rightEnd.y} stroke="#91c2e3" strokeWidth={boardSize * 0.0045} strokeLinecap="round" />
                  {rungLines.map((rung, index) => (
                    <g key={`${l.id}-rung-${index}`}>
                      <line x1={rung.x1} y1={rung.y1} x2={rung.x2} y2={rung.y2} stroke="#82502d" strokeWidth={boardSize * 0.011} strokeLinecap="round" />
                      <line x1={rung.x1} y1={rung.y1} x2={rung.x2} y2={rung.y2} stroke="#efc774" strokeWidth={boardSize * 0.0045} strokeLinecap="round" />
                    </g>
                  ))}
                </g>
              );
            }

            const wiggle = Math.max(18, Math.min(boardSize * 0.09, Math.abs(l.x1 - l.x2) * 0.35 + 14));
            const snake = snakePath(l.x1, l.y1, l.x2, l.y2, wiggle);
            const headRadius = boardSize * 0.028;
            const eyeOffset = headRadius * 0.42;
            const eyeForward = headRadius * 0.15;
            const bodyColor = l.start % 2 === 0 ? "#ba7d2f" : "#8cbe4d";
            const outlineColor = l.start % 2 === 0 ? "#84501e" : "#4a7f36";
            const patternColor = l.start % 2 === 0 ? "#a43727" : "#42743f";
            return (
              <g key={l.id} opacity={0.98} filter="url(#board-shadow)">
                <path d={snake.body} fill="none" stroke={outlineColor} strokeWidth={boardSize * 0.03} strokeLinecap="round" />
                <path d={snake.body} fill="none" stroke={bodyColor} strokeWidth={boardSize * 0.022} strokeLinecap="round" />
                <path d={snake.body} fill="none" stroke={patternColor} strokeWidth={boardSize * 0.005} strokeLinecap="round" strokeDasharray={`${boardSize * 0.014} ${boardSize * 0.024}`} />
                <ellipse cx={snake.start.x} cy={snake.start.y} rx={headRadius * 1.2} ry={headRadius} fill={bodyColor} transform={`rotate(${(Math.atan2(snake.unit.y, snake.unit.x) * 180) / Math.PI} ${snake.start.x} ${snake.start.y})`} />
                <circle cx={snake.start.x + snake.normal.x * eyeOffset + snake.unit.x * eyeForward} cy={snake.start.y + snake.normal.y * eyeOffset + snake.unit.y * eyeForward} r={boardSize * 0.0045} fill="#1f160f" />
                <circle cx={snake.start.x - snake.normal.x * eyeOffset + snake.unit.x * eyeForward} cy={snake.start.y - snake.normal.y * eyeOffset + snake.unit.y * eyeForward} r={boardSize * 0.0045} fill="#1f160f" />
                <path d={`M ${snake.start.x + snake.unit.x * headRadius * 1.1} ${snake.start.y + snake.unit.y * headRadius * 0.4} Q ${snake.start.x + snake.unit.x * headRadius * 1.9} ${snake.start.y + snake.unit.y * headRadius * 0.2} ${snake.start.x + snake.unit.x * headRadius * 2.1} ${snake.start.y + snake.unit.y * headRadius * 0.7}`} stroke="#d53f35" strokeWidth={boardSize * 0.004} fill="none" strokeLinecap="round" />
              </g>
            );
          })}
        </svg>

        {/* Render 3 tokens per player */}
        {room.players.map((player) => {
          const tokens = displayPositions[player.id] ?? [0, 0, 0];
          return tokens.map((pos, tIdx) => {
            const clamped = clamp(pos, 0, 100);
            const center = clamped <= 0
              ? { x: playSize / 20, y: playSize - playSize / 20 }
              : centerForNumber(clamped, playSize);

            const off = TOKEN_OFFSETS[tIdx];
            const finalX = center.x + off.dx * tokenSize * 1.2;
            const finalY = center.y + off.dy * tokenSize * 1.2;

            const isClickable = canMove && player.id === myId && movableTokens.has(tIdx);
            const isFinished = pos >= 100;

            return (
              <motion.div
                key={`${player.id}-${tIdx}`}
                className={cn(
                  "absolute rounded-full border-2 shadow-lg flex items-center justify-center",
                  isClickable ? "cursor-pointer ring-2 ring-amber-400 ring-offset-1 animate-pulse border-amber-300" : "border-white",
                  isFinished && "opacity-60"
                )}
                style={{
                  width: tokenSize,
                  height: tokenSize,
                  left: finalX,
                  top: finalY,
                  transform: "translate(-50%, -50%)",
                  backgroundColor: player.color ?? "#94A3B8",
                  boxShadow: isClickable ? "0 0 12px rgba(251,191,36,0.6)" : "0 6px 14px rgba(15,23,42,0.2)",
                  zIndex: isClickable ? 30 : player.id === room.turn?.playerId ? 20 : 10,
                }}
                animate={{ left: finalX, top: finalY, scale: isClickable ? 1.15 : 1 }}
                transition={{
                  duration: room.lastMove?.by === player.id && room.lastMove?.tokenIndex === tIdx ? 0.18 : 0.35,
                  ease: room.lastMove?.effect === "snake" && room.lastMove?.by === player.id ? "easeIn" : "easeOut",
                }}
                onClick={() => { if (isClickable) onMoveToken(tIdx); }}
                title={`${player.username} Token ${tIdx + 1}`}
              >
                <span className="text-[8px] font-black text-white drop-shadow">{tIdx + 1}</span>
              </motion.div>
            );
          });
        })}

      </div>
      </div>
    </div>
  );
}
