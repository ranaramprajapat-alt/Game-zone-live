import React, { useEffect, useMemo, useRef } from "react";
import { motion } from "motion/react";
import confetti from "canvas-confetti";
import type { XoxRoomState } from "@/src/games/xox/types";
import { playWinCrackers } from "@/src/lib/sounds";

export default function XoxBoard({
  room, myId, onPlaceMove, onRestart,
}: {
  room: XoxRoomState;
  myId: string | null;
  onPlaceMove: (cell: number) => void;
  onRestart: () => void;
}) {
  const isMyTurn = !!myId && room.turn?.playerId === myId;
  const canPlay = room.gameState === "playing" && isMyTurn;
  const celebratedRef = useRef<number>(0);

  const turnPlayer = useMemo(() => {
    if (!room.turn) return null;
    return room.players.find((p) => p.id === room.turn!.playerId) ?? null;
  }, [room.players, room.turn]);

  const me = useMemo(() => {
    if (!myId) return null;
    return room.players.find((p) => p.id === myId) ?? null;
  }, [room.players, myId]);

  const winningCells = useMemo(() => {
    if (room.gameState !== "ended" || !room.winnerId) return new Set<number>();
    const winner = room.players.find(p => p.id === room.winnerId);
    if (!winner?.symbol) return new Set<number>();
    return findWinningLine(room.board, room.gridSize, room.winLength, winner.symbol);
  }, [room]);

  const playerX = useMemo(() => room.players.find(p => p.symbol === "X") ?? null, [room.players]);
  const playerO = useMemo(() => room.players.find(p => p.symbol === "O") ?? null, [room.players]);

  // Celebration confetti
  useEffect(() => {
    if (room.gameState !== "ended" || celebratedRef.current === room.lastEventId) return;
    celebratedRef.current = room.lastEventId;
    if (room.winnerId) {
      playWinCrackers();
      const winner = room.players.find(p => p.id === room.winnerId);
      const isRed = winner?.symbol === "X";
      const colors = isRed ? ["#FF073A", "#ff4d6d", "#ff0a3e"] : ["#00D4FF", "#00b4d8", "#48cae4"];
      // Fire multiple bursts
      const fire = (opts: confetti.Options) => confetti({ ...opts, disableForReducedMotion: true });
      fire({ particleCount: 80, spread: 70, origin: { x: 0.3, y: 0.6 }, colors, startVelocity: 45 });
      fire({ particleCount: 80, spread: 70, origin: { x: 0.7, y: 0.6 }, colors, startVelocity: 45 });
      setTimeout(() => {
        fire({ particleCount: 50, spread: 100, origin: { x: 0.5, y: 0.4 }, colors, startVelocity: 35 });
      }, 300);
      setTimeout(() => {
        fire({ particleCount: 60, spread: 120, origin: { x: 0.4, y: 0.5 }, colors, startVelocity: 40 });
        fire({ particleCount: 60, spread: 120, origin: { x: 0.6, y: 0.5 }, colors, startVelocity: 40 });
      }, 600);
      setTimeout(() => {
        fire({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors });
        fire({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors });
      }, 900);
    } else if (room.isDraw) {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 }, colors: ["#555", "#888", "#aaa"], disableForReducedMotion: true });
    }
  }, [room.gameState, room.lastEventId]);

  const gridSize = room.gridSize;
  const cellSize = Math.min(Math.floor(520 / gridSize), 80);

  const NEON_RED = "#FF073A";
  const NEON_BLUE = "#00D4FF";
  const NEON_RED_GLOW = "0 0 15px #FF073A, 0 0 30px #FF073A66";
  const NEON_BLUE_GLOW = "0 0 15px #00D4FF, 0 0 30px #00D4FF66";

  const getPlayerNeon = (symbol: string | null) => {
    if (symbol === "X") return { color: NEON_RED, glow: NEON_RED_GLOW };
    if (symbol === "O") return { color: NEON_BLUE, glow: NEON_BLUE_GLOW };
    return { color: "#666", glow: "none" };
  };

  const turnNeon = turnPlayer ? getPlayerNeon(turnPlayer.symbol) : null;
  const isOwner = me?.isOwner;

  return (
    <div className="p-4 lg:p-6" style={{ backgroundColor: "#0a0a0a" }}>
      {/* Scoreboard */}
      <div className="mb-6 grid grid-cols-2 gap-3 max-w-[532px] mx-auto">
        {playerX ? (() => {
          const isXTurn = room.turn?.playerId === playerX.id && room.gameState === "playing";
          const neon = getPlayerNeon("X");
          const isYou = myId && playerX.id === myId;
          return (
            <div
              className="rounded-2xl p-3 flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden"
              style={{
                backgroundColor: "#111",
                border: isXTurn ? `2px solid ${neon.color}` : "2px solid #1c1c1c",
                boxShadow: isXTurn ? neon.glow : "none",
              }}
            >
              {isXTurn && (
                <div className="absolute top-0 inset-x-0 h-1 animate-pulse" style={{ backgroundColor: neon.color }} />
              )}
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex w-6 h-6 rounded-lg items-center justify-center text-xs font-black shrink-0"
                  style={{ backgroundColor: "#000", color: neon.color, border: `1.5px solid ${neon.color}`, boxShadow: neon.glow }}>
                  ✕
                </span>
                <span className="text-[10px] font-black tracking-wider uppercase text-slate-500">
                  Player X
                </span>
              </div>
              <div className="text-sm font-bold truncate max-w-full text-slate-200">
                {playerX.username} {isYou && <span className="text-[10px] text-slate-500 font-normal">(You)</span>}
              </div>
              <div className="mt-2 text-2xl font-black" style={{ color: neon.color, textShadow: neon.glow }}>
                {playerX.wins ?? 0}
              </div>
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-600 mt-0.5">
                {(playerX.wins ?? 0) === 1 ? "win" : "wins"}
              </div>
            </div>
          );
        })() : (
          <div className="rounded-2xl p-3 flex flex-col items-center justify-center border border-dashed border-slate-800 text-slate-600 text-xs font-bold">
            Waiting for Player X...
          </div>
        )}

        {playerO ? (() => {
          const isOTurn = room.turn?.playerId === playerO.id && room.gameState === "playing";
          const neon = getPlayerNeon("O");
          const isYou = myId && playerO.id === myId;
          return (
            <div
              className="rounded-2xl p-3 flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden"
              style={{
                backgroundColor: "#111",
                border: isOTurn ? `2px solid ${neon.color}` : "2px solid #1c1c1c",
                boxShadow: isOTurn ? neon.glow : "none",
              }}
            >
              {isOTurn && (
                <div className="absolute top-0 inset-x-0 h-1 animate-pulse" style={{ backgroundColor: neon.color }} />
              )}
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex w-6 h-6 rounded-lg items-center justify-center text-xs font-black shrink-0"
                  style={{ backgroundColor: "#000", color: neon.color, border: `1.5px solid ${neon.color}`, boxShadow: neon.glow }}>
                  ○
                </span>
                <span className="text-[10px] font-black tracking-wider uppercase text-slate-500">
                  Player O
                </span>
              </div>
              <div className="text-sm font-bold truncate max-w-full text-slate-200">
                {playerO.username} {isYou && <span className="text-[10px] text-slate-500 font-normal">(You)</span>}
              </div>
              <div className="mt-2 text-2xl font-black" style={{ color: neon.color, textShadow: neon.glow }}>
                {playerO.wins ?? 0}
              </div>
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-600 mt-0.5">
                {(playerO.wins ?? 0) === 1 ? "win" : "wins"}
              </div>
            </div>
          );
        })() : (
          <div className="rounded-2xl p-3 flex flex-col items-center justify-center border border-dashed border-slate-800 text-slate-600 text-xs font-bold">
            Waiting for Player O...
          </div>
        )}
      </div>

      {/* Turn Info & Helper Text */}
      <div className="mb-5 max-w-[532px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          {room.gameState === "lobby" && (
            <div className="text-xs font-medium" style={{ color: "#555" }}>Waiting for the host to start (exactly 2 players).</div>
          )}
          {room.gameState === "playing" && (
            <div className="text-sm font-bold">
              {canPlay ? (
                <span className="animate-pulse" style={{ color: getPlayerNeon(me?.symbol ?? null).color }}>
                  Your turn — place your {me?.symbol}!
                </span>
              ) : (
                <span style={{ color: "#888" }}>
                  Waiting for {turnPlayer?.username}'s move...
                </span>
              )}
            </div>
          )}
        </div>

        {/* Grid info */}
        {room.gameState === "playing" && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#444" }}>Grid: {gridSize}×{gridSize}</span>
            <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#444" }}>Win: {room.winLength} in a row</span>
          </div>
        )}
      </div>

      {/* Game Over Banner */}
      {room.gameState === "ended" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-5 rounded-2xl p-5 text-center"
          style={{
            backgroundColor: "#111",
            border: room.winnerId ? `2px solid ${getPlayerNeon(room.players.find(p => p.id === room.winnerId)?.symbol ?? null).color}` : "2px solid #333",
            boxShadow: room.winnerId ? getPlayerNeon(room.players.find(p => p.id === room.winnerId)?.symbol ?? null).glow : "none",
          }}
        >
          {room.winnerId && (() => {
            const winner = room.players.find((p) => p.id === room.winnerId);
            const neon = getPlayerNeon(winner?.symbol ?? null);
            return (
              <>
                <div className="text-4xl mb-2">🏆</div>
                <div className="text-xl font-black" style={{ color: neon.color, textShadow: neon.glow }}>
                  {winner?.username ?? "Unknown"} Wins!
                </div>
                <div className="mt-1 text-sm" style={{ color: "#666" }}>
                  Playing as <span style={{ color: neon.color, fontWeight: 900 }}>{winner?.symbol}</span>
                </div>
              </>
            );
          })()}
          {room.isDraw && (
            <>
              <div className="text-4xl mb-2">🤝</div>
              <div className="text-xl font-black" style={{ color: "#888" }}>It's a Draw!</div>
            </>
          )}

          {/* Continue Button */}
          {isOwner && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.3 }}
              onClick={onRestart}
              className="mt-4 px-8 py-3 rounded-2xl font-black text-sm transition-all active:scale-[0.97]"
              style={{
                backgroundColor: "#FF073A",
                color: "#fff",
                boxShadow: "0 0 20px rgba(255,7,58,0.4), 0 4px 20px rgba(255,7,58,0.2)",
              }}
            >
              🔄 Continue — Play Again
            </motion.button>
          )}
          {!isOwner && (
            <div className="mt-3 text-xs font-black" style={{ color: "#444" }}>
              Waiting for host to restart...
            </div>
          )}
        </motion.div>
      )}

      {/* Board */}
      <div className="flex justify-center">
        <div className="relative rounded-2xl overflow-hidden"
          style={{ padding: 6, backgroundColor: "#111", border: "2px solid #222", boxShadow: "0 0 40px rgba(0,0,0,0.8), inset 0 0 30px rgba(0,0,0,0.5)" }}>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`, gridTemplateRows: `repeat(${gridSize}, ${cellSize}px)`, gap: 3 }}>
            {room.board.map((cell, idx) => {
              const isEmpty = cell === null;
              const isWinCell = winningCells.has(idx);
              const isLastMove = room.lastMove?.cell === idx;
              const clickable = canPlay && isEmpty;
              const winNeon = isWinCell ? getPlayerNeon(cell) : null;

              return (
                <motion.button
                  key={idx}
                  onClick={() => { if (clickable) onPlaceMove(idx); }}
                  disabled={!clickable}
                  className="relative rounded-lg font-black flex items-center justify-center transition-all"
                  style={{
                    width: cellSize, height: cellSize, fontSize: Math.max(cellSize * 0.45, 16),
                    backgroundColor: isWinCell ? "#0a1a0a" : "#0d0d0d",
                    border: isWinCell ? `2px solid ${winNeon?.color}` : clickable ? "2px solid #222" : "2px solid #1a1a1a",
                    boxShadow: isWinCell ? winNeon?.glow : undefined,
                    cursor: clickable ? "pointer" : "default",
                  }}
                  whileHover={clickable ? { scale: 1.05, borderColor: "#333" } : {}}
                  whileTap={clickable ? { scale: 0.92 } : {}}
                  initial={false}
                  animate={isLastMove && cell ? { scale: [0, 1.2, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {cell === "X" && <span style={{ color: NEON_RED, textShadow: NEON_RED_GLOW, fontWeight: 900, fontSize: Math.max(cellSize * 0.5, 18) }}>✕</span>}
                  {cell === "O" && <span style={{ color: NEON_BLUE, textShadow: NEON_BLUE_GLOW, fontWeight: 900, fontSize: Math.max(cellSize * 0.5, 18) }}>○</span>}
                  {isEmpty && clickable && <span style={{ color: "#1a1a1a", fontSize: "60%" }}>·</span>}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function findWinningLine(board: (string | null)[], gridSize: number, winLength: number, symbol: string): Set<number> {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      for (const [dr, dc] of directions) {
        const cells: number[] = [];
        let valid = true;
        for (let i = 0; i < winLength; i++) {
          const r = row + dr * i, c = col + dc * i;
          if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) { valid = false; break; }
          const idx = r * gridSize + c;
          if (board[idx] !== symbol) { valid = false; break; }
          cells.push(idx);
        }
        if (valid && cells.length === winLength) return new Set(cells);
      }
    }
  }
  return new Set();
}
