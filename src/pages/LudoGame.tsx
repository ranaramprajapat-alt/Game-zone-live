import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Dices, LogIn, Plus } from "lucide-react";
import Lobby, { LobbyMessage } from "@/src/components/Lobby";
import type { LobbyPlayer } from "@/src/components/PlayerList";
import { socket } from "@/src/lib/socket";
import { buildInviteLink, navigate } from "@/src/lib/router";
import LudoBoard from "@/src/games/ludo/LudoBoard";
import type { LudoRoomState } from "@/src/games/ludo/types";
import { cn } from "@/src/lib/utils";
import { playClick, playError, playLudoDiceRoll } from "@/src/lib/sounds";

interface LudoGameProps {
  roomCode?: string;
}

const LUDO_ACCENT_CLASS =
  "bg-[linear-gradient(90deg,#EAB308_0%,#22C55E_33%,#3B82F6_66%,#EF4444_100%)]";

function generateCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function getStoredUsername() {
  try {
    return localStorage.getItem("mgp.username") ?? "";
  } catch {
    return "";
  }
}

export default function LudoGame({ roomCode }: LudoGameProps) {
  const [username, setUsername] = useState(() => (roomCode ? "" : getStoredUsername()));
  const [draftUsername, setDraftUsername] = useState(() => (roomCode ? getStoredUsername() : ""));
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<LobbyMessage[]>([]);
  const [room, setRoom] = useState<LudoRoomState | null>(null);
  const [rolling, setRolling] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(socket.id ?? null);
  const joinedRef = useRef<string | null>(null);

  useEffect(() => {
    const onConnect = () => setSocketId(socket.id ?? null);
    socket.on("connect", onConnect);
    onConnect();
    return () => {
      socket.off("connect", onConnect);
    };
  }, []);

  useEffect(() => {
    if (!roomCode) return;
    if (username.trim()) return;
    setDraftUsername((prev) => prev || getStoredUsername());
  }, [roomCode, username]);

  useEffect(() => {
    const handleRoomUpdate = (updated: any) => {
      if (!updated || updated.game !== "ludo") return;
      if (roomCode && updated.code !== roomCode) return;
      setRoom(updated as LudoRoomState);
      setRolling(false);
    };

    const handleNewMessage = (msg: any) => {
      if (!msg || typeof msg.message !== "string") return;
      setMessages((prev) => [...prev, msg]);
    };

    const handleJoinError = (e: any) => {
      const message = (e?.message || "").toString();
      if (message) setError(message);
      setRolling(false);
    };

    socket.on("room-update", handleRoomUpdate);
    socket.on("new-message", handleNewMessage);
    socket.on("join-error", handleJoinError);
    return () => {
      socket.off("room-update", handleRoomUpdate);
      socket.off("new-message", handleNewMessage);
      socket.off("join-error", handleJoinError);
    };
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode || !username.trim()) return;
    const cleanRoom = roomCode.trim().toUpperCase();
    const cleanUser = username.trim();

    setError("");
    setMessages([]);

    try {
      localStorage.setItem("mgp.username", cleanUser);
    } catch {}

    const emitJoin = () => {
      socket.emit("join-room", { game: "ludo", roomCode: cleanRoom, username: cleanUser });
    };

    if (socket.connected) {
      emitJoin();
    }

    const onConnect = () => {
      setSocketId(socket.id ?? null);
      emitJoin();
    };

    socket.on("connect", onConnect);

    return () => {
      socket.off("connect", onConnect);
      socket.emit("leave-room", { game: "ludo", roomCode: cleanRoom });
    };
  }, [roomCode, username]);

  const me = useMemo(() => {
    if (!room || !socketId) return null;
    return room.players.find((p) => p.id === socketId) ?? null;
  }, [room, socketId]);

  const playersForLobby: LobbyPlayer[] = useMemo(() => {
    if (!room) return [];
    return room.players.map((p) => ({
      id: p.id,
      username: p.username,
      isOwner: p.isOwner,
      color: p.color ?? undefined,
      isYou: socketId ? p.id === socketId : false,
    }));
  }, [room, socketId]);

  const canStart = !!room && room.gameState === "lobby" && !!me?.isOwner && room.players.length >= 2;

  if (!roomCode) {
    return (
      <div className="min-h-[var(--app-height)] lg:min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100 max-w-md w-full"
        >
          <div className="text-center">
            <div
              className={cn(
                "inline-flex items-center justify-center w-16 h-16 text-white rounded-3xl shadow-xl shadow-slate-200 mb-4 rotate-2",
                LUDO_ACCENT_CLASS
              )}
            >
              <Dices size={32} />
            </div>
            <h2 className="text-3xl font-black tracking-tight text-slate-900">
              Ludo
              <span className={cn(LUDO_ACCENT_CLASS, "bg-clip-text text-transparent")}>Party</span>
            </h2>
            <p className="mt-1 text-slate-500 font-medium text-sm">Create a room or join with a code.</p>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">Your Nickname</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Rana"
                className="mt-2 w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 transition-all font-medium text-[16px]"
              />
            </div>

            <button
              onClick={() => {
                if (!username.trim()) {
                  playError();
                  return setError("Please enter a nickname");
                }
                playClick();
                const code = generateCode();
                navigate(`/ludo/${code}`);
              }}
              className={cn(
                "flex items-center justify-center gap-2 w-full py-3.5 text-white rounded-2xl font-black transition-all shadow-lg shadow-slate-200 active:scale-[0.99] hover:brightness-110",
                LUDO_ACCENT_CLASS
              )}
            >
              <Plus size={18} /> Create Room
            </button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-black text-slate-400">
                <span className="bg-white px-3">Or Join</span>
              </div>
            </div>

            <div className="space-y-2">
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Enter Room Code"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 transition-all font-medium text-center uppercase tracking-widest text-[16px]"
              />
              <button
                onClick={() => {
                  if (!username.trim()) {
                    playError();
                    return setError("Please enter a nickname");
                  }
                  if (!codeInput.trim()) {
                    playError();
                    return setError("Please enter a room code");
                  }
                  playClick();
                  navigate(`/ludo/${codeInput.trim().toUpperCase()}`);
                }}
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-[0.99]"
              >
                <LogIn size={18} /> Join Room
              </button>
            </div>

            {error && <div className="text-rose-500 text-[11px] font-black text-center">{error}</div>}

            <button
              onClick={() => navigate("/")}
              className="w-full py-3 rounded-2xl font-black text-slate-600 hover:text-slate-800 transition-colors"
            >
              Back to Games
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!username.trim()) {
    return (
      <div className="min-h-[var(--app-height)] lg:min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200 max-w-md w-full">
          <h2 className="text-xl font-black text-slate-900">Join Ludo Room</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter a nickname to join room <span className="font-black text-slate-900">{roomCode}</span>.
          </p>
          <div className="mt-4 space-y-3">
            <input
              value={draftUsername}
              onChange={(e) => setDraftUsername(e.target.value)}
              placeholder="Your nickname"
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 transition-all font-medium text-[16px]"
            />
            <button
              onClick={() => {
                const cleaned = draftUsername.trim().slice(0, 24);
                if (!cleaned) {
                  playError();
                  return;
                }
                playClick();
                try {
                  localStorage.setItem("mgp.username", cleaned);
                } catch {
                  // ignore
                }
                setUsername(cleaned);
              }}
              disabled={!draftUsername.trim()}
              className={cn(
                "w-full py-3 text-white rounded-2xl font-black transition-all shadow-lg shadow-slate-200 active:scale-[0.99] hover:brightness-110",
                LUDO_ACCENT_CLASS,
                !draftUsername.trim() ? "opacity-60" : ""
              )}
            >
              Continue
            </button>
            <button
              onClick={() => {
                playClick();
                navigate("/ludo");
              }}
              className="w-full py-3 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-[0.99]"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const inviteLink = buildInviteLink("ludo", roomCode, room?.networkIP, room?.port);

  return (
    <Lobby
      title="Ludo"
      roomCode={roomCode}
      inviteLink={inviteLink}
      players={playersForLobby}
      messages={messages}
      headerAccentClassName={LUDO_ACCENT_CLASS}
      canStart={canStart}
      startLabel="Start Ludo"
      onStart={() => socket.emit("start-game", { game: "ludo", roomCode })}
      onLeave={() => {
        socket.emit("leave-room", { game: "ludo", roomCode });
        navigate("/ludo");
      }}
      onSendMessage={(message) => socket.emit("send-message", { game: "ludo", roomCode, message, username })}
      chatPlaceholder="Say hi..."
    >
      <div className={cn(room?.gameState === "lobby" ? "bg-white" : "bg-white")}>
        {error && (
          <div className="px-4 pt-4">
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 font-black text-sm">
              {error}
            </div>
          </div>
        )}

        {room ? (
          <LudoBoard
            room={room}
            myId={socketId}
            rolling={rolling}
            onRollDice={() => {
              if (!room || room.gameState !== "playing") return;
              if (!socketId || room.turn?.playerId !== socketId || room.turn?.phase !== "roll") return;
              setRolling(true);
              playLudoDiceRoll();
              socket.emit("ludo-roll-dice", { roomCode });
            }}
            onMoveToken={(tokenIndex) => {
              if (!room || room.gameState !== "playing") return;
              if (!socketId || room.turn?.playerId !== socketId || room.turn?.phase !== "move") return;
              socket.emit("ludo-move-token", { roomCode, tokenIndex });
            }}
            onRestart={() => {
              if (!room || room.gameState !== "ended" || !me?.isOwner) return;
              playClick();
              socket.emit("ludo-restart", { roomCode });
            }}
          />
        ) : (
          <div className="p-6">
            <div className="py-20 text-center">
              <div className="w-7 h-7 border-2 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Connecting...</div>
            </div>
          </div>
        )}
      </div>
    </Lobby>
  );
}
