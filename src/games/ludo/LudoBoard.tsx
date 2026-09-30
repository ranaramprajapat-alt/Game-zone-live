import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import confetti from "canvas-confetti";
import { cn } from "@/src/lib/utils";
import Dice from "@/src/components/Dice";
import type { LudoColorKey, LudoLastMove, LudoRoomState } from "@/src/games/ludo/types";
import {
  BASE_CELLS,
  HOME_PATH_CELLS,
  LUDO_SAFE_INDICES,
  START_INDEX_TO_COLOR,
  TRACK_CELLS,
  canMoveWithDice,
  cornerForCell,
  cornerOrigin,
  getCellCenter,
  getCenteredTokenPosition,
  getCellForProgress,
  getHomeTokenPositions,
  getTokenPixelPosition,
  isCornerInnerCell,
  ludoGlobalIndex,
} from "@/src/game-logic/ludo";
import { playLudoCapture, playLudoTokenMove, playLudoWin, playWinCrackers } from "@/src/lib/sounds";

const COLOR_HEX: Record<LudoColorKey, string> = {
  red: "#E53935",
  blue: "#1E88E5",
  yellow: "#F9A825",
  green: "#43A047",
};

const COLOR_LIGHT: Record<LudoColorKey, string> = {
  red: "#FFCDD2",
  blue: "#BBDEFB",
  yellow: "#FFF9C4",
  green: "#C8E6C9",
};

const COLOR_RING: Record<LudoColorKey, string> = {
  red: "ring-red-400/70",
  blue: "ring-blue-400/70",
  yellow: "ring-amber-400/80",
  green: "ring-green-400/70",
};

const COLOR_ACCENT_CLASS: Record<LudoColorKey, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  yellow: "bg-amber-500",
  green: "bg-green-500",
};

const ENTRY_ARROW_ROTATION: Record<LudoColorKey, number> = {
  red: 90,
  blue: 180,
  yellow: -90,
  green: 0,
};

type TokenView = {
  id: string;
  playerId: string;
  tokenIndex: number;
  progress: number;
  color: string;
  colorKey: LudoColorKey;
  stackKey: string;
  stackIndex: number;
  stackCount: number;
  isMovable: boolean;
  isAnimating: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}

function StarIcon({ size = 14, color = "#888", outlined = false }: { size?: number; color?: string; outlined?: boolean }) {
  if (outlined) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <path d="M12 2l2.9 6.3 6.8.6-5.1 4.4 1.5 6.6L12 16.9 5.9 19.9l1.5-6.6L2.3 8.9l6.8-.6L12 2z" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2l2.9 6.3 6.8.6-5.1 4.4 1.5 6.6L12 16.9 5.9 19.9l1.5-6.6L2.3 8.9l6.8-.6L12 2z" />
    </svg>
  );
}

function getProgressMap(room: LudoRoomState) {
  const next: Record<string, number> = {};
  for (const player of room.players) {
    const tokens = room.tokens?.[player.id] ?? [-1, -1, -1, -1];
    for (let i = 0; i < 4; i++) next[`${player.id}:${i}`] = Number(tokens[i] ?? -1);
  }
  return next;
}

function buildStackKey(colorKey: LudoColorKey, playerId: string, tokenIndex: number, progress: number) {
  if (progress === -1) return `base:${playerId}:${tokenIndex}`;
  if (progress === 57) return "home:center";
  if (progress >= 52 && progress <= 56) return `home:${colorKey}:${progress}`;
  return `track:${ludoGlobalIndex(colorKey, progress)}`;
}

export default function LudoBoard({
  room,
  myId,
  rolling,
  onRollDice,
  onMoveToken,
  onRestart,
}: {
  room: LudoRoomState;
  myId: string | null;
  rolling: boolean;
  onRollDice: () => void;
  onMoveToken: (tokenIndex: number) => void;
  onRestart: () => void;
}) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const boardSize = Math.min(size.width, size.height);
  const cellSize = boardSize ? boardSize / 15 : 0;
  const tokenSize = useMemo(() => clamp(cellSize * 0.65, 22, 34), [cellSize]);

  const [displayProgress, setDisplayProgress] = useState<Record<string, number>>(() => getProgressMap(room));
  const [activePathKeys, setActivePathKeys] = useState<string[]>([]);
  const [captureFlashKeys, setCaptureFlashKeys] = useState<string[]>([]);
  const [animatingTokenId, setAnimatingTokenId] = useState<string | null>(null);
  const lastAnimatedMoveIdRef = useRef<number>(0);
  const winnerFxRef = useRef<string | null>(null);
  const animationTimersRef = useRef<number[]>([]);

  const me = useMemo(() => {
    if (!myId) return null;
    return room.players.find((p) => p.id === myId) ?? null;
  }, [myId, room.players]);
  const isOwner = !!me?.isOwner;

  const turnPlayer = useMemo(() => {
    const turn = room.turn;
    if (!turn) return null;
    return room.players.find((p) => p.id === turn.playerId) ?? null;
  }, [room.players, room.turn]);

  const turnDice = room.turn?.dice ?? null;
  const dice = turnDice ?? room.lastRoll?.dice ?? null;
  const isMyTurn = !!myId && room.turn?.playerId === myId;
  const isRollingPhase = room.gameState === "playing" && isMyTurn && room.turn?.phase === "roll";
  const isMovePhase = room.gameState === "playing" && isMyTurn && room.turn?.phase === "move" && typeof turnDice === "number";

  useEffect(() => {
    const next = getProgressMap(room);
    setDisplayProgress((prev) => {
      if (!animatingTokenId) return next;
      const merged = { ...next };
      merged[animatingTokenId] = prev[animatingTokenId] ?? merged[animatingTokenId];
      return merged;
    });
  }, [room.tokens, room.players, animatingTokenId, room]);

  useEffect(() => {
    const move = room.lastMove;
    if (!move || move.type !== "move") return;
    if (move.id === lastAnimatedMoveIdRef.current) return;

    const actor = room.players.find((p) => p.id === move.by);
    if (!actor?.colorKey) return;

    lastAnimatedMoveIdRef.current = move.id;
    const tokenId = `${move.by}:${move.tokenIndex}`;
    const path = move.path.length > 0 ? move.path : [move.to];
    const stepDuration = 170;

    animationTimersRef.current.forEach((id) => window.clearTimeout(id));
    animationTimersRef.current = [];
    setAnimatingTokenId(tokenId);

    const pathKeys = path.map((progress) => {
      const cell = getCellForProgress(actor.colorKey!, progress, move.tokenIndex);
      return `${cell.row},${cell.col}`;
    });
    setActivePathKeys(pathKeys);

    setDisplayProgress((prev) => ({ ...prev, [tokenId]: move.from }));

    path.forEach((progress, idx) => {
      const timer = window.setTimeout(() => {
        setDisplayProgress((prev) => ({ ...prev, [tokenId]: progress }));
        playLudoTokenMove();
      }, idx * stepDuration);
      animationTimersRef.current.push(timer);
    });

    const finishTimer = window.setTimeout(() => {
      setAnimatingTokenId(null);
      setActivePathKeys([]);

      if (move.captured.length > 0) {
        const flashKeys = move.captured.map((capture) => {
          const capturedPlayer = room.players.find((p) => p.id === capture.playerId);
          if (!capturedPlayer?.colorKey) return "";
          const cell = getCellForProgress(capturedPlayer.colorKey, -1, capture.tokenIndex);
          return `${cell.row},${cell.col}`;
        }).filter(Boolean);
        setCaptureFlashKeys(flashKeys);
        playLudoCapture();
        const clearTimer = window.setTimeout(() => setCaptureFlashKeys([]), 420);
        animationTimersRef.current.push(clearTimer);
      }
    }, path.length * stepDuration + 40);

    animationTimersRef.current.push(finishTimer);

    return () => {
      animationTimersRef.current.forEach((id) => window.clearTimeout(id));
      animationTimersRef.current = [];
    };
  }, [room.lastMove, room.players]);

  useEffect(() => {
    if (!room.winnerId || room.winnerId === winnerFxRef.current) return;
    winnerFxRef.current = room.winnerId;
    playLudoWin();
    playWinCrackers();
    confetti({
      particleCount: 180,
      spread: 150,
      origin: { y: 0.6 },
    });
  }, [room.winnerId]);

  const movableTokens = useMemo(() => {
    if (!isMovePhase || !myId || typeof turnDice !== "number") return new Set<number>();
    const tokens = room.tokens?.[myId] ?? [-1, -1, -1, -1];
    return new Set(tokens.map((progress, idx) => ({ idx, ok: canMoveWithDice(progress, turnDice) })).filter((item) => item.ok).map((item) => item.idx));
  }, [isMovePhase, myId, room.tokens, turnDice]);

  const tokensFlat = useMemo(() => {
    const out: TokenView[] = [];
    for (const player of room.players) {
      if (!player.colorKey || !player.color) continue;
      const tokens = room.tokens?.[player.id] ?? [-1, -1, -1, -1];
      for (let tokenIndex = 0; tokenIndex < 4; tokenIndex++) {
        const id = `${player.id}:${tokenIndex}`;
        const progress = displayProgress[id] ?? Number(tokens[tokenIndex] ?? -1);
        out.push({
          id,
          playerId: player.id,
          tokenIndex,
          progress,
          color: player.color,
          colorKey: player.colorKey,
          stackKey: buildStackKey(player.colorKey, player.id, tokenIndex, progress),
          stackIndex: 0,
          stackCount: 1,
          isMovable: isMovePhase && myId === player.id && movableTokens.has(tokenIndex),
          isAnimating: animatingTokenId === id,
        });
      }
    }

    const grouped = new Map<string, TokenView[]>();
    for (const token of out) {
      if (!grouped.has(token.stackKey)) grouped.set(token.stackKey, []);
      grouped.get(token.stackKey)!.push(token);
    }

    for (const group of grouped.values()) {
      group.forEach((token, index) => {
        token.stackIndex = index;
        token.stackCount = group.length;
      });
    }

    return out;
  }, [room.players, room.tokens, displayProgress, isMovePhase, myId, movableTokens, animatingTokenId]);

  const accent = me?.colorKey ? COLOR_ACCENT_CLASS[me.colorKey] : "bg-blue-600";
  const arrowSize = useMemo(() => clamp(cellSize * 0.46, 10, 16), [cellSize]);

  const getStackOffset = (token: TokenView) => {
    if (token.stackCount <= 1) return { dx: 0, dy: 0 };
    const maxOffsetInsideCell = Math.max(0, (cellSize - tokenSize) / 2 - 1);
    const spread = Math.min(cellSize * 0.18, maxOffsetInsideCell);

    if (token.stackCount === 2) {
      return token.stackIndex === 0 ? { dx: -spread, dy: 0 } : { dx: spread, dy: 0 };
    }

    if (token.stackCount === 3) {
      const positions = [
        { dx: 0, dy: -spread },
        { dx: -spread, dy: spread * 0.75 },
        { dx: spread, dy: spread * 0.75 },
      ];
      return positions[token.stackIndex] ?? { dx: 0, dy: 0 };
    }

    const positions = [
      { dx: -spread, dy: -spread },
      { dx: spread, dy: -spread },
      { dx: -spread, dy: spread },
      { dx: spread, dy: spread },
    ];
    return positions[token.stackIndex] ?? { dx: 0, dy: 0 };
  };

  const renderStatus = (move: LudoLastMove) => {
    if (!move) return null;
    const actor = room.players.find((p) => p.id === move.by)?.username ?? "Someone";
    if (move.type === "pass") return `${actor} rolled ${move.dice} - no valid move`;
    const capturedText = move.captured.length > 0 ? ` - captured ${move.captured.length}` : "";
    return `${actor} moved token ${move.tokenIndex + 1} by ${move.dice}${capturedText}`;
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Turn</div>
          <div className="mt-1 font-black text-slate-900 text-lg">
            {turnPlayer ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: turnPlayer.color ?? "#94A3B8" }} aria-hidden />
                {turnPlayer.username}
                {turnPlayer.id === myId && <span className="text-indigo-600">You</span>}
              </span>
            ) : (
              <span className="text-slate-500">-</span>
            )}
          </div>
          {room.gameState === "lobby" && <div className="mt-1 text-sm font-medium text-slate-500">Waiting for the host to start (2-4 players).</div>}
          {room.gameState === "playing" && isMyTurn && (
            <div className="mt-1 text-sm font-medium text-slate-500">
              {room.turn?.phase === "roll" ? "Roll the dice to start your move." : "Choose a highlighted token."}
            </div>
          )}
          {room.gameState === "playing" && room.lastMove && <div className="mt-1 text-sm font-medium text-slate-500">{renderStatus(room.lastMove)}</div>}
          {room.gameState === "ended" && room.winnerId && (
            <div className="mt-2 space-y-2">
              <div className="text-sm font-black text-emerald-600">
                Winner: {room.players.find((p) => p.id === room.winnerId)?.username ?? "Unknown"}
              </div>
              {isOwner ? (
                <button
                  onClick={onRestart}
                  className={cn(
                    "rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all active:scale-[0.98] hover:brightness-110",
                    accent
                  )}
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
          {room.scores && (
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
              {room.players.map((player) => (
                <span key={`score-${player.id}`} className="rounded-full bg-slate-100 px-2 py-1">
                  {player.username}: {room.scores?.[player.id] ?? 0}
                </span>
              ))}
            </div>
          )}
        </div>

        <Dice
          value={dice}
          rolling={rolling}
          onRoll={isRollingPhase ? onRollDice : undefined}
          disabled={!isRollingPhase || rolling}
          accentClassName={accent}
          label={isRollingPhase ? "Roll Dice" : "Waiting"}
        />
      </div>

      <div
        ref={ref}
        className="mt-5 relative mx-auto aspect-square w-full max-w-[620px] overflow-hidden rounded-[18px] select-none"
        style={{
          border: "3px solid #334155",
          background: "linear-gradient(180deg, #fff 0%, #f8fafc 100%)",
          boxShadow: "0 14px 40px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.9)",
          boxSizing: "border-box",
          padding: 0,
        }}
      >
        <div className="absolute inset-0 grid grid-cols-[repeat(15,minmax(0,1fr))] grid-rows-[repeat(15,minmax(0,1fr))]">
          {Array.from({ length: 15 }).flatMap((_, row) =>
            Array.from({ length: 15 }).map((_, col) => {
              const key = `${row},${col}`;
              const trackIndex = TRACK_CELLS.findIndex((cell) => cell.row === row && cell.col === col);
              const corner = cornerForCell(row, col);
              const isCornerInner = corner ? isCornerInnerCell(row, col, corner) : false;
              const home = (Object.entries(HOME_PATH_CELLS) as Array<[LudoColorKey, typeof HOME_PATH_CELLS.red]>)
                .find(([, cells]) => cells.some((cell) => cell.row === row && cell.col === col))?.[0];
              const base = (Object.entries(BASE_CELLS) as Array<[LudoColorKey, typeof BASE_CELLS.red]>)
                .find(([, cells]) => cells.some((cell) => cell.row === row && cell.col === col))?.[0];
              const isCenter = row >= 6 && row <= 8 && col >= 6 && col <= 8;
              const startColor = trackIndex >= 0 ? START_INDEX_TO_COLOR[trackIndex] : undefined;
              const isSafe = trackIndex >= 0 && LUDO_SAFE_INDICES.has(trackIndex);
              const isHighlightedPath = activePathKeys.includes(key);
              const isCaptureFlash = captureFlashKeys.includes(key);

              let background = "#FFFFFF";
              let border = "0.5px solid rgba(148,163,184,0.38)";
              if (home) {
                background = COLOR_LIGHT[home];
                border = `1px solid ${COLOR_HEX[home]}33`;
              } else if (startColor) {
                background = COLOR_HEX[startColor];
                border = "1px solid rgba(255,255,255,0.35)";
              } else if (trackIndex >= 0) {
                background = "#FFFFFF";
              } else if (corner) {
                background = isCornerInner ? COLOR_LIGHT[corner] : COLOR_HEX[corner];
                border = isCornerInner ? `1px solid ${COLOR_HEX[corner]}26` : "1px solid rgba(255,255,255,0.15)";
              } else if (isCenter) {
                background = "#FFFFFF";
                border = "none";
              } else {
                background = "#FFFFFF";
              }

              return (
                <div
                  key={key}
                  className="relative"
                  style={{
                    background,
                    border,
                    boxShadow: isHighlightedPath
                      ? "inset 0 0 0 2px rgba(251,191,36,0.65), 0 0 14px rgba(251,191,36,0.28)"
                      : isCaptureFlash
                        ? "inset 0 0 0 2px rgba(244,63,94,0.7), 0 0 16px rgba(244,63,94,0.34)"
                        : undefined,
                  }}
                >
                  {base && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        style={{
                          width: "58%",
                          height: "58%",
                          borderRadius: "50%",
                          backgroundColor: COLOR_HEX[base],
                          boxShadow: "inset 0 1px 2px rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.12)",
                        }}
                        aria-hidden
                      />
                    </div>
                  )}

                  {isSafe && (
                    <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
                      {startColor ? (
                        <StarIcon size={14} color="rgba(255,255,255,0.95)" />
                      ) : (
                        <StarIcon size={14} color="#94A3B8" outlined />
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {boardSize > 0 && (
          <>
            <div className="absolute inset-0 pointer-events-none" aria-hidden>
              {(["red", "blue", "green", "yellow"] as LudoColorKey[]).map((colorKey) => {
                const origin = cornerOrigin(colorKey);
                return (
                  <div
                    key={`panel-${colorKey}`}
                    style={{
                      position: "absolute",
                      left: (origin.col + 0.9) * cellSize,
                      top: (origin.row + 0.9) * cellSize,
                      width: cellSize * 4.2,
                      height: cellSize * 4.2,
                      borderRadius: Math.max(14, cellSize * 0.55),
                      background: "#FFFFFF",
                      boxShadow: "0 2px 8px rgba(15,23,42,0.12)",
                    }}
                  />
                );
              })}
            </div>

            <svg
              className="absolute pointer-events-none"
              style={{ left: cellSize * 6, top: cellSize * 6, width: cellSize * 3, height: cellSize * 3 }}
              viewBox="0 0 100 100"
              aria-hidden
            >
              <polygon points="0,0 100,0 50,50" fill={COLOR_HEX.blue} />
              <polygon points="100,0 100,100 50,50" fill={COLOR_HEX.yellow} />
              <polygon points="0,100 100,100 50,50" fill={COLOR_HEX.green} />
              <polygon points="0,0 0,100 50,50" fill={COLOR_HEX.red} />
              <line x1="0" y1="0" x2="50" y2="50" stroke="rgba(15,23,42,0.18)" strokeWidth="1" />
              <line x1="100" y1="0" x2="50" y2="50" stroke="rgba(15,23,42,0.18)" strokeWidth="1" />
              <line x1="100" y1="100" x2="50" y2="50" stroke="rgba(15,23,42,0.18)" strokeWidth="1" />
              <line x1="0" y1="100" x2="50" y2="50" stroke="rgba(15,23,42,0.18)" strokeWidth="1" />
            </svg>

            <div className="absolute inset-0 pointer-events-none" aria-hidden>
              {(["red", "blue", "yellow", "green"] as LudoColorKey[]).map((colorKey) => {
                const entryCell = HOME_PATH_CELLS[colorKey][0];
                if (!entryCell) return null;
                const center = getCellCenter(entryCell.row, entryCell.col, boardSize, 15);

                return (
                  <svg
                    key={`entry-arrow-${colorKey}`}
                    width={arrowSize}
                    height={arrowSize}
                    viewBox="0 0 24 24"
                    style={{
                      position: "absolute",
                      left: center.x,
                      top: center.y,
                      transform: `translate(-50%, -50%) rotate(${ENTRY_ARROW_ROTATION[colorKey]}deg)`,
                      transformOrigin: "50% 50%",
                      opacity: 0.8,
                      overflow: "visible",
                    }}
                  >
                    <path fill={COLOR_HEX[colorKey]} d="M12 3l7 8h-4v9H9v-9H5l7-8z" />
                  </svg>
                );
              })}
            </div>
          </>
        )}

        {tokensFlat.map((token) => {
          const baseCenter = boardSize > 0
            ? getTokenPixelPosition(token.colorKey, token.progress, token.tokenIndex, boardSize)
            : getCenteredTokenPosition(7, 7, 15, 15);
          const homePositions = boardSize > 0 ? getHomeTokenPositions(token.colorKey, boardSize) : [];
          const center = token.progress === -1 ? (homePositions[token.tokenIndex] ?? baseCenter) : baseCenter;
          const stack = getStackOffset(token);
          const left = center.x + stack.dx;
          const top = center.y + stack.dy;

          return (
            <motion.button
              key={token.id}
              onClick={() => {
                if (token.isMovable) onMoveToken(token.tokenIndex);
              }}
              className={cn(
                "absolute rounded-full",
                token.isMovable ? cn("cursor-pointer ring-[3px]", COLOR_RING[token.colorKey]) : "cursor-default",
              )}
              style={{
                position: "absolute",
                left,
                top,
                width: 0,
                height: 0,
                transform: "translate(-50%, -50%)",
              }}
              animate={{
                left,
                top,
                scale: token.isMovable ? [1, 1.12, 1] : token.isAnimating ? [1, 1.06, 0.98, 1] : 1,
                y: token.isAnimating ? [0, -8, 0] : 0,
                rotate: token.isAnimating ? [-4, 4, 0] : 0,
              }}
              transition={
                token.isMovable || token.isAnimating
                  ? {
                      left: { type: "spring", stiffness: 280, damping: 24 },
                      top: { type: "spring", stiffness: 280, damping: 24 },
                      scale: token.isMovable
                        ? { duration: 0.75, repeat: Infinity }
                        : { duration: 0.28, ease: "easeInOut" },
                      y: token.isAnimating
                        ? { duration: 0.28, ease: "easeInOut", repeat: Infinity }
                        : { duration: 0.2 },
                      rotate: token.isAnimating
                        ? { duration: 0.28, ease: "easeInOut", repeat: Infinity }
                        : { duration: 0.2 },
                    }
                  : {
                      left: { type: "spring", stiffness: 280, damping: 24 },
                      top: { type: "spring", stiffness: 280, damping: 24 },
                    }
              }
              disabled={!token.isMovable}
              title={token.isMovable ? "Move token" : "Token"}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: tokenSize,
                  height: tokenSize,
                  transform: "translate(-50%, -50%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  filter: token.isAnimating
                    ? "drop-shadow(0 10px 20px rgba(15,23,42,0.22)) drop-shadow(0 0 18px rgba(251,191,36,0.28))"
                    : "drop-shadow(0 6px 14px rgba(15,23,42,0.18))",
                }}
              >
                <svg
                  width={tokenSize}
                  height={tokenSize}
                  viewBox="0 0 64 82"
                  style={{ overflow: "visible", display: "block" }}
                >
                  <ellipse cx="32" cy="67" rx="25" ry="11.5" fill="#67D1CC" opacity="0.92" />
                  <path
                    d="M32 4C20.4 4 11 13.2 11 24.7c0 7.5 4.2 15 8.9 21.1 4 5.2 8.1 10.3 10.4 16.7.6 1.6 2.8 1.6 3.4 0 2.3-6.4 6.4-11.5 10.4-16.7 4.7-6.1 8.9-13.6 8.9-21.1C53 13.2 43.6 4 32 4z"
                    fill={token.color}
                  />
                  <path
                    d="M32 4C20.4 4 11 13.2 11 24.7c0 7.5 4.2 15 8.9 21.1 4 5.2 8.1 10.3 10.4 16.7.3.8.9 1.2 1.7 1.2V4z"
                    fill="rgba(255,255,255,0.14)"
                  />
                  <circle cx="32" cy="24.5" r="10.6" fill="rgba(255,255,255,0.98)" />
                </svg>
              </span>
            </motion.button>
          );
        })}
      </div>

      {isMovePhase && movableTokens.size === 0 && (
        <div className="mt-4 text-center text-sm font-bold text-slate-500">No valid move for this dice roll.</div>
      )}
    </div>
  );
}
