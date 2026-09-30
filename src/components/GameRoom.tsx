import React, { useState, useEffect, useRef } from "react";
import { socket } from "@/src/lib/socket";
import { buildInviteLink } from "@/src/lib/router";
import Canvas from "./Canvas";
import { cn } from "@/src/lib/utils";
import { Timer, Hash, Share2, Copy, Check, Trophy, User, Send, Pencil, MessageCircle } from "lucide-react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "motion/react";
import { auth } from "../firebase";
import { firebaseService } from "../services/firebaseService";
import {
  playCorrectGuess,
  playMyCorrectGuess,
  playRoundStart,
  playRoundEnd,
  playTimerTick,
  playTimerUrgent,
  playPlayerJoin,
  playMessagePop,
  playWordSelect,
  playGameOver,
  playClick,
  playWinCrackers,
} from "@/src/lib/sounds";

interface GameRoomProps {
  roomCode: string;
  username: string;
  maxRounds?: number;
  onExit: () => void;
}

export default function GameRoom({ roomCode, username, maxRounds, onExit }: GameRoomProps) {
  const [room, setRoom] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [secretWord, setSecretWord] = useState("");
  const [gameState, setGameState] = useState<"waiting" | "playing" | "ended" | "choosing">("waiting");
  const [timer, setTimer] = useState(60);
  const [showGameOver, setShowGameOver] = useState(false);
  const [finalScores, setFinalScores] = useState<any[]>([]);
  const [hint, setHint] = useState("");
  const [wordChoices, setWordChoices] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  const handleExit = () => {
    socket.emit("leave-room", { roomCode, game: "drawing-game" });
    onExit();
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const mediaQuery = window.matchMedia("(max-width: 1023px)");

    const updateOverflow = () => {
      document.body.style.overflow = mediaQuery.matches ? "hidden" : previousOverflow;
    };

    updateOverflow();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateOverflow);
    } else {
      mediaQuery.addListener(updateOverflow);
    }
    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", updateOverflow);
      } else {
        mediaQuery.removeListener(updateOverflow);
      }
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    socket.emit("join-room", { roomCode, username, maxRounds });

    const handleRoomUpdate = (updatedRoom: any) => {
      setRoom((prev: any) => {
        // Detect new player joined
        if (prev && updatedRoom.players.length > prev.players.length) {
          playPlayerJoin();
        }
        return updatedRoom;
      });
      setTimer(updatedRoom.timer);
      setGameState(updatedRoom.gameState);
      if (updatedRoom.gameState !== "ended") {
        setShowGameOver(false);
      }
    };

    const handleTimerUpdate = (newTime: number) => {
      setTimer(newTime);
      // Timer warning sounds
      if (newTime <= 5 && newTime > 0) {
        playTimerUrgent();
      } else if (newTime <= 10 && newTime > 5) {
        playTimerTick();
      }
    };

    const handleHintUpdate = (newHint: string) => {
      setHint(newHint);
    };

    const handleGameStarted = ({ round, turn, totalTurnsInRound, drawerUsername }: { currentDrawer: string; round: number; turn: number; totalTurnsInRound: number; drawerUsername: string }) => {
      setGameState("playing");
      setWordChoices([]);
      setMessages((prev) => [...prev, { username: "System", message: `Round ${round} — Turn ${turn}/${totalTurnsInRound}: ${drawerUsername} is drawing!`, isSystem: true }]);
      playRoundStart();
    };

    const handleWordChoices = (choices: string[]) => {
      setWordChoices(choices);
      setGameState("choosing");
    };

    const handleSecretWord = (word: string) => {
      setSecretWord(word);
    };

    const handleRoundEnded = ({ word }: { word: string }) => {
      setGameState("ended");
      setMessages((prev) => [...prev, { username: "System", message: `Round ended! The word was: ${word}`, isSystem: true }]);
      setSecretWord("");
      setWordChoices([]);
      playRoundEnd();
    };

    const handleGameOver = async (players: any[]) => {
      const sorted = players.sort((a: any, b: any) => b.score - a.score);
      setFinalScores(sorted);
      setShowGameOver(true);
      playGameOver();
      if (sorted.length > 0 && sorted[0].score > 0) {
        playWinCrackers();
      }
      confetti({
        particleCount: 200,
        spread: 160,
        origin: { y: 0.6 }
      });

      // Persist score if authenticated
      if (auth.currentUser) {
        const myPlayer = players.find((p: any) => p.username === username);
        if (myPlayer && myPlayer.score > 0) {
          try {
            await firebaseService.updateScore(auth.currentUser.uid, username, myPlayer.score);
          } catch (err) {
            console.error("Failed to persist score:", err);
          }
        }
      }
    };

    const handleNewMessage = (msg: any) => {
      setMessages((prev) => [...prev, msg]);
      playMessagePop();
    };

    const handleCorrectGuess = ({ username: guesser }: { username: string; score: number }) => {
      setMessages((prev) => [...prev, { username: guesser, message: "guessed the word!", isCorrect: true }]);
      if (guesser === username) {
        playMyCorrectGuess();
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } else {
        playCorrectGuess();
      }
    };

    socket.on("room-update", handleRoomUpdate);
    socket.on("timer-update", handleTimerUpdate);
    socket.on("hint-update", handleHintUpdate);
    socket.on("game-started", handleGameStarted);
    socket.on("word-choices", handleWordChoices);
    socket.on("secret-word", handleSecretWord);
    socket.on("round-ended", handleRoundEnded);
    socket.on("game-over", handleGameOver);
    socket.on("new-message", handleNewMessage);
    socket.on("correct-guess", handleCorrectGuess);

    return () => {
      socket.emit("leave-room", { roomCode, game: "drawing-game" });
      socket.off("room-update", handleRoomUpdate);
      socket.off("timer-update", handleTimerUpdate);
      socket.off("hint-update", handleHintUpdate);
      socket.off("game-started", handleGameStarted);
      socket.off("word-choices", handleWordChoices);
      socket.off("secret-word", handleSecretWord);
      socket.off("round-ended", handleRoundEnded);
      socket.off("game-over", handleGameOver);
      socket.off("new-message", handleNewMessage);
      socket.off("correct-guess", handleCorrectGuess);
    };
  }, [roomCode, username, maxRounds]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!shareOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!shareMenuRef.current?.contains(event.target as Node)) {
        setShareOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [shareOpen]);

  const handleSendMessage = (message: string) => {
    socket.emit("send-message", { roomCode, message, username });
  };

  const handleDraw = (data: any) => {
    socket.emit("draw", { roomCode, drawingData: data });
  };

  const handleClear = () => {
    socket.emit("clear-canvas", roomCode);
  };

  const handleSelectWord = (word: string) => {
    socket.emit("select-word", { roomCode, word });
    setSecretWord(word);
    setWordChoices([]);
    playWordSelect();
  };

  const handleStartGame = () => {
    socket.emit("start-game", roomCode);
    playClick();
  };

  const handleContinueSamePlayers = () => {
    socket.emit("drawing-restart", { roomCode });
    playClick();
    setShowGameOver(false);
  };

  const roomLink = buildInviteLink("drawing-game", roomCode, room?.networkIP, room?.port);
  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(`Join my SketchGuess room ${roomCode}: ${roomLink}`)}`;

  const copyRoomLink = async () => {
    try {
      await navigator.clipboard.writeText(roomLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select+copy via a hidden textarea (older browsers / denied permissions)
      const textarea = document.createElement("textarea");
      textarea.value = roomLink;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      handleSendMessage(chatInput.trim());
      setChatInput("");
    }
  };

  if (!room) return (
    <div className="min-h-[var(--app-height)] lg:min-h-screen bg-white/60 backdrop-blur-sm flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 font-medium">Connecting to room...</p>
      </div>
    </div>
  );

  const isDrawer = room.currentDrawer === socket.id;
  const isOwner = room.players.find((p: any) => p.id === socket.id)?.isOwner;
  const sortedPlayers = [...room.players].sort((a: any, b: any) => b.score - a.score);
  const currentDrawerName = room.players.find((p: any) => p.id === room.currentDrawer)?.username ?? "Waiting";

  return (
    <div className="min-h-[var(--app-height)] lg:min-h-screen bg-white/60 backdrop-blur-sm flex flex-col h-[var(--app-height)] lg:h-auto overflow-hidden lg:overflow-visible">
      {/* ========== HEADER ========== */}
      <header className="bg-white border-b border-slate-200 px-3 lg:px-6 py-2 lg:py-3 flex items-center justify-between shadow-sm sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-2 lg:gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 lg:w-8 lg:h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-bold text-sm lg:text-base">S</div>
            <span className="font-black text-base lg:text-xl text-slate-900 hidden sm:block">SketchGuess</span>
          </div>

          <div className="h-5 lg:h-6 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-2 lg:gap-4">
            <div className="flex items-center gap-1 lg:gap-2 bg-slate-100 px-2 lg:px-3 py-1 lg:py-1.5 rounded-full">
              <Timer size={12} className="text-indigo-600 lg:w-4 lg:h-4" />
              <span className="font-bold text-slate-700 tabular-nums text-xs lg:text-base">{timer}s</span>
            </div>
            <div className="flex items-center gap-1 lg:gap-2 bg-slate-100 px-2 lg:px-3 py-1 lg:py-1.5 rounded-full">
              <Hash size={12} className="text-indigo-600 lg:w-4 lg:h-4" />
              <span className="font-bold text-slate-700 text-xs lg:text-base">{room.round}/{room.maxRounds}</span>
            </div>
            {room.totalTurnsInRound > 0 && (
              <div className="flex items-center gap-1 lg:gap-2 bg-purple-50 border border-purple-100 px-2 lg:px-3 py-1 lg:py-1.5 rounded-full">
                <Pencil size={12} className="text-purple-600 lg:w-4 lg:h-4" />
                <span className="font-bold text-purple-700 text-xs lg:text-base">Turn {room.turnInRound}/{room.totalTurnsInRound}</span>
              </div>
            )}
            <div className="hidden md:flex items-center gap-2 bg-amber-50 border border-amber-100 px-2 lg:px-3 py-1 lg:py-1.5 rounded-full">
              <Pencil size={12} className="text-amber-600 lg:w-4 lg:h-4" />
              <span className="font-bold text-amber-700 text-xs lg:text-base">{currentDrawerName} drawing</span>
            </div>
          </div>
        </div>

          <div className="flex items-center gap-1 lg:gap-3">
          <div className="flex items-center gap-1 lg:gap-2 bg-indigo-50 border border-indigo-100 px-2 lg:px-4 py-1 lg:py-2 rounded-lg lg:rounded-xl">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest hidden md:block">Room Code</span>
            <span className="font-mono font-bold text-indigo-700 text-xs lg:text-base">{roomCode}</span>
            <button
              onClick={copyRoomLink}
              aria-label="Copy room link"
              title={copied ? "Copied!" : "Copy room link"}
              className="ml-1 p-1 hover:bg-indigo-100 rounded transition-colors text-indigo-600"
            >
              {copied ? <Check size={12} /> : <Share2 size={12} />}
            </button>
          </div>
          <div className="relative" ref={shareMenuRef}>
            <button
              onClick={() => {
                playClick();
                setShareOpen((prev) => !prev);
              }}
              className="px-2 lg:px-4 py-1 lg:py-2 bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-100 rounded-lg lg:rounded-xl font-bold text-xs lg:text-sm transition-colors flex items-center gap-1.5"
            >
              <MessageCircle size={12} className="lg:w-4 lg:h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            {shareOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-40 min-w-[190px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    playClick();
                    setShareOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <MessageCircle size={16} />
                  Share on WhatsApp
                </a>
                <button
                  onClick={async () => {
                    playClick();
                    await copyRoomLink();
                    setShareOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <Copy size={16} />
                  Copy Invite Link
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleExit}
            className="px-2 lg:px-4 py-1 lg:py-2 text-slate-500 hover:text-slate-700 font-bold text-xs lg:text-sm transition-colors"
          >
            Leave
          </button>
        </div>
      </header>

      {/* ========== HINT / WORD BAR (Mobile: below header) ========== */}
      {room.gameState !== "waiting" && (
        <div className="lg:hidden bg-white border-b border-slate-200 px-3 py-2 shrink-0">
          <div className="mb-2 text-center">
            <span className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-amber-700">
              <Pencil size={12} />
              {currentDrawerName} drawing
            </span>
          </div>
          <div className="bg-slate-100 px-4 py-2 rounded-xl w-full">
            {gameState === "choosing" ? (
              isDrawer ? (
                <div className="text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Pick a word</span>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {wordChoices.map((word) => (
                      <button
                        key={word}
                        onClick={() => handleSelectWord(word)}
                        className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all active:scale-95 text-xs shadow-md"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center animate-pulse">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-tight">Drawer is choosing...</span>
                </div>
              )
            ) : isDrawer ? (
              <div className="text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Your Word</span>
                <span className="text-lg font-black text-indigo-600 uppercase tracking-widest">{secretWord || "WAITING..."}</span>
              </div>
            ) : (
              <div className="text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Guess This</span>
                <span className="text-lg font-black text-slate-700 tracking-[0.3em]">
                  {gameState === "playing" ? hint : "WAITING..."}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== DESKTOP LAYOUT ========== */}
      <main className="hidden lg:grid flex-1 p-6 grid-cols-12 gap-6 max-w-[1600px] mx-auto w-full overflow-hidden">
        {/* Left Sidebar - Players */}
        <div className="col-span-2 flex flex-col gap-6">
          <div className="flex flex-col h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-3 bg-white border-bottom border-slate-200 font-semibold text-slate-700 flex items-center gap-2">
              <Trophy size={18} className="text-amber-500" />
              Leaderboard
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sortedPlayers.map((player: any, index: number) => (
                <div
                  key={`${player.id}-${index}`}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg transition-all",
                    player.id === room.currentDrawer ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-700 shadow-sm border border-slate-100"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                      player.id === room.currentDrawer ? "bg-white/20" : "bg-slate-200 text-slate-500"
                    )}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-bold text-sm flex items-center gap-1">
                        {player.username}
                        {player.id === room.currentDrawer && (
                          <span className="text-[10px] uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded">Drawing</span>
                        )}
                      </div>
                      <div className={cn(
                        "text-xs",
                        player.id === room.currentDrawer ? "text-indigo-100" : "text-slate-400"
                      )}>
                        {player.score} pts
                      </div>
                    </div>
                  </div>
                  <User size={16} className={player.id === room.currentDrawer ? "text-white/60" : "text-slate-300"} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-700 font-bold mb-3 text-sm">
              <Trophy size={16} className="text-indigo-500" />
              Owner Actions
            </div>
            <div className="space-y-2">
              {isOwner && room.gameState === "waiting" ? (
                <button
                  onClick={handleStartGame}
                  disabled={room.players.length < 2}
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
                >
                  Start Game
                </button>
              ) : (
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight text-center">
                  {room.gameState === "waiting" ? "Waiting for owner..." : "Game in progress"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center Canvas */}
        <div className="col-span-7 flex flex-col gap-4 h-full min-h-0">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
            {room.gameState === "waiting" ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-6 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 p-4">
                <div className="p-6 bg-white rounded-full shadow-lg">
                  <User size={64} className="text-indigo-600" />
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tight">Game Lobby</h3>
                  <p className="text-slate-500 font-medium text-sm">
                    {room.players.length} {room.players.length === 1 ? 'player' : 'players'} connected
                  </p>
                </div>
                {isOwner ? (
                  <div className="space-y-3 flex flex-col items-center w-full max-w-xs">
                    {room.players.length < 2 ? (
                      <p className="text-amber-600 text-xs font-bold bg-amber-50 px-4 py-2 rounded-full border border-amber-100 text-center">
                        Need at least 2 players to start
                      </p>
                    ) : (
                      <button
                        onClick={handleStartGame}
                        className="w-full px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95 uppercase tracking-wider"
                      >
                        Start Game
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Waiting for host...</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center mb-4 min-h-[80px]">
                  <div className="bg-slate-100 px-8 py-3 rounded-2xl w-full max-w-2xl mx-auto">
                    <div className="mb-3 text-center">
                      <span className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-amber-700">
                        <Pencil size={12} />
                        {currentDrawerName} drawing
                      </span>
                    </div>
                    {gameState === "choosing" ? (
                      isDrawer ? (
                        <div className="text-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Pick a word</span>
                          <div className="flex gap-4 justify-center">
                            {wordChoices.map((word) => (
                              <button
                                key={word}
                                onClick={() => handleSelectWord(word)}
                                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all active:scale-95 text-base shadow-md"
                              >
                                {word}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center animate-pulse">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Drawer is choosing...</span>
                        </div>
                      )
                    ) : isDrawer ? (
                      <div className="text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Your Word</span>
                        <span className="text-2xl font-black text-indigo-600 uppercase tracking-widest">{secretWord || "WAITING..."}</span>
                      </div>
                    ) : (
                      <div className="text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Guess the Word</span>
                        <span className="text-2xl font-black text-slate-300 tracking-[0.5em]">
                          {gameState === "playing" ? hint : "WAITING..."}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-h-0">
                  <Canvas
                    isDrawer={isDrawer}
                    onDraw={handleDraw}
                    onClear={handleClear}
                    roomCode={roomCode}
                    socket={socket}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Sidebar - Chat */}
        <div className="col-span-3 flex flex-col h-full min-h-0">
          <div className="flex flex-col h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-3 bg-white border-bottom border-slate-200 font-semibold text-slate-700">
              Chat & Guesses
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "text-sm p-2 rounded-lg",
                    msg.isSystem ? "bg-slate-200 text-slate-600 text-center italic" :
                      msg.isCorrect ? "bg-emerald-100 text-emerald-700 font-bold text-center border border-emerald-200" :
                        msg.username === username ? "bg-indigo-50 text-indigo-700 ml-4 border border-indigo-100" :
                          "bg-white text-slate-700 mr-4 border border-slate-100 shadow-sm"
                  )}
                >
                  {!msg.isSystem && !msg.isCorrect && (
                    <span className="font-bold mr-2">{msg.username}:</span>
                  )}
                  {msg.message}
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = (e.target as HTMLFormElement).querySelector("input") as HTMLInputElement;
                if (input.value.trim()) {
                  handleSendMessage(input.value.trim());
                  input.value = "";
                }
              }}
              className="p-3 bg-white border-t border-slate-200 flex gap-2"
            >
              <input
                type="text"
                placeholder="Type your guess..."
                className="flex-1 px-3 py-2 bg-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
              />
              <button
                type="submit"
                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* ========== MOBILE LAYOUT (skribbl.io style - all in one view) ========== */}
      <div
        className="lg:hidden relative flex flex-col flex-1 min-h-0 overflow-hidden"
        style={{ paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
      >

        {/* Canvas Area — takes ~50% of viewport like skribbl.io */}
        <div className="shrink-0 bg-white border-b-2 border-slate-200" style={{ height: room.gameState === "waiting" ? "auto" : "38vh", minHeight: room.gameState === "waiting" ? "200px" : "200px" }}>
          {room.gameState === "waiting" ? (
            <div className="flex flex-col items-center justify-center space-y-4 p-6">
              <div className="p-4 bg-slate-50 rounded-full shadow-lg">
                <User size={36} className="text-indigo-600" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-black text-slate-800 mb-1 uppercase tracking-tight">Game Lobby</h3>
                <p className="text-slate-500 font-medium text-xs">
                  {room.players.length} {room.players.length === 1 ? 'player' : 'players'} connected
                </p>
              </div>
              {isOwner ? (
                <div className="w-full max-w-xs">
                  {room.players.length < 2 ? (
                    <p className="text-amber-600 text-xs font-bold bg-amber-50 px-4 py-2 rounded-full border border-amber-100 text-center">
                      Need at least 2 players to start
                    </p>
                  ) : (
                    <button
                      onClick={handleStartGame}
                      className="w-full px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-base hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95 uppercase tracking-wider"
                    >
                      Start Game
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Waiting for host...</p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full p-1">
              <Canvas
                isDrawer={isDrawer}
                onDraw={handleDraw}
                onClear={handleClear}
                roomCode={roomCode}
                socket={socket}
              />
            </div>
          )}
        </div>

        {/* ===== Bottom Split: Players (left) + Chat (right) — skribbl.io style ===== */}
        <div className="flex-1 min-h-0 flex flex-row overflow-hidden">

          {/* Left column: Player List */}
          <div className="w-[40%] border-r border-slate-200 bg-white overflow-y-auto">
            <div className="px-1.5 py-1.5 space-y-1">
              {sortedPlayers.map((player: any, index: number) => {
                const isCurrentDrawer = player.id === room.currentDrawer;
                const isMe = player.username === username;
                const displayRank = index + 1;

                return (
                  <div
                    key={`${player.id}-${index}`}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-2 rounded-lg transition-all",
                      isCurrentDrawer
                        ? "bg-indigo-600 text-white shadow-md"
                        : "bg-slate-50 border border-slate-100"
                    )}
                  >
                    {/* Rank */}
                    <span className={cn(
                      "text-[10px] font-black shrink-0",
                      isCurrentDrawer ? "text-indigo-200" : "text-slate-400"
                    )}>
                      #{displayRank}
                    </span>

                    {/* Avatar */}
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                      isCurrentDrawer ? "bg-white/20" : "bg-indigo-100"
                    )}>
                      <User size={12} className={isCurrentDrawer ? "text-white/80" : "text-indigo-500"} />
                    </div>

                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className={cn(
                          "font-bold text-[11px] truncate block",
                          isMe && !isCurrentDrawer ? "text-indigo-600" : "",
                          isCurrentDrawer ? "text-white" : "text-slate-700"
                        )}>
                          {player.username}
                        </span>
                        {isCurrentDrawer && (
                          <Pencil size={8} className="shrink-0 text-indigo-200" />
                        )}
                      </div>
                      <span className={cn(
                        "text-[10px] font-semibold",
                        isCurrentDrawer ? "text-indigo-200" : "text-slate-400"
                      )}>
                        {player.score} pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right column: Chat Messages */}
          <div className="w-[60%] flex flex-col bg-[#F8FAFC] overflow-hidden">
            <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1" ref={chatScrollRef}>
              {messages.length > 0 ? (
                messages.slice(-30).map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "text-[11px] px-2 py-1 rounded-md leading-tight",
                      msg.isSystem ? "text-slate-400 italic" :
                        msg.isCorrect ? "bg-emerald-100 text-emerald-700 font-bold border border-emerald-200" :
                          "text-slate-700"
                    )}
                  >
                    {!msg.isSystem && !msg.isCorrect && (
                      <span className="font-bold text-indigo-600 mr-1">{msg.username}:</span>
                    )}
                    {msg.isCorrect && (
                      <span className="font-bold text-emerald-600 mr-1">{msg.username} </span>
                    )}
                    {msg.message}
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">No messages yet</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fixed bottom chat input */}
        <form
          onSubmit={handleChatSubmit}
          className="absolute left-0 right-0 bottom-0 bg-white border-t-2 border-slate-200 px-3 py-2 flex gap-2 z-40"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type your guess here..."
            className="flex-1 px-4 py-2.5 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-[16px] transition-all font-medium"
          />
          <button
            type="submit"
            className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm active:scale-95"
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* ========== DESKTOP FOOTER ========== */}
      <footer className="hidden lg:flex bg-white border-t border-slate-200 px-6 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] justify-between items-center shrink-0">
        <div>Connected to Server: {socket.id?.substring(0, 8)}</div>
        <div className="flex gap-4">
          <span>Latency: 24ms</span>
          <span>Version 1.0.0</span>
        </div>
      </footer>

      {/* ========== GAME OVER MODAL ========== */}
      <AnimatePresence>
        {showGameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="bg-indigo-600 p-6 lg:p-8 text-center text-white">
                <Trophy size={48} className="mx-auto mb-3 lg:mb-4 text-amber-300 lg:w-16 lg:h-16" />
                <h2 className="text-2xl lg:text-3xl font-black uppercase tracking-tight">Game Over!</h2>
                <p className="text-indigo-100 font-medium text-sm">Amazing performance everyone!</p>
              </div>

              <div className="p-4 lg:p-6 space-y-3 lg:space-y-4">
                <div className="space-y-2">
                  {finalScores.map((player, i) => (
                    <div
                      key={`${player.id}-${i}`}
                      className={cn(
                        "flex items-center justify-between p-3 lg:p-4 rounded-xl lg:rounded-2xl border",
                        i === 0 ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-100"
                      )}
                    >
                      <div className="flex items-center gap-3 lg:gap-4">
                        <span className={cn(
                          "w-7 h-7 lg:w-8 lg:h-8 rounded-full flex items-center justify-center font-black text-xs lg:text-sm",
                          i === 0 ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-500"
                        )}>
                          {i + 1}
                        </span>
                        <span className="font-bold text-slate-700 text-sm lg:text-base">{player.username}</span>
                      </div>
                      <span className="font-black text-indigo-600 text-sm lg:text-base">{player.score} pts</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={isOwner ? handleContinueSamePlayers : handleExit}
                  className="w-full py-3 lg:py-4 bg-indigo-600 text-white rounded-xl lg:rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
                >
                  {isOwner ? "Continue With Same Players" : "Close Results"}
                </button>
                {!isOwner && (
                  <p className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Waiting for host to continue the room.
                  </p>
                )}
                <button
                  onClick={handleExit}
                  className="w-full py-3 lg:py-4 bg-slate-900 text-white rounded-xl lg:rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-[0.98]"
                >
                  Leave Room
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
