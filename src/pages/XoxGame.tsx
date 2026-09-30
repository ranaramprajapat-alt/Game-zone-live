import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { LogIn, Plus, Grid3X3 } from "lucide-react";
import Lobby, { LobbyMessage } from "@/src/components/Lobby";
import type { LobbyPlayer } from "@/src/components/PlayerList";
import { socket } from "@/src/lib/socket";
import { buildInviteLink, navigate } from "@/src/lib/router";
import XoxBoard from "@/src/games/xox/XoxBoard";
import type { XoxRoomState } from "@/src/games/xox/types";

interface XoxGameProps {
  roomCode?: string;
}

function generateCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function getStoredUsername() {
  try { return localStorage.getItem("mgp.username") ?? ""; } catch { return ""; }
}

export default function XoxGame({ roomCode }: XoxGameProps) {
  const [username, setUsername] = useState(() => (roomCode ? "" : getStoredUsername()));
  const [draftUsername, setDraftUsername] = useState(() => (roomCode ? getStoredUsername() : ""));
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<LobbyMessage[]>([]);
  const [room, setRoom] = useState<XoxRoomState | null>(null);
  const [socketId, setSocketId] = useState<string | null>(socket.id ?? null);
  const [gridSize, setGridSize] = useState(3);
  const joinedRef = useRef<string | null>(null);

  useEffect(() => {
    const onConnect = () => setSocketId(socket.id ?? null);
    socket.on("connect", onConnect);
    onConnect();
    return () => { socket.off("connect", onConnect); };
  }, []);

  useEffect(() => {
    if (!roomCode) return;
    setUsername("");
    setDraftUsername(getStoredUsername());
  }, [roomCode]);

  useEffect(() => {
    const handleRoomUpdate = (updated: any) => {
      if (!updated || updated.game !== "xox") return;
      if (roomCode && updated.code !== roomCode) return;
      setRoom(updated as XoxRoomState);
    };
    const handleNewMessage = (msg: any) => {
      if (!msg || typeof msg.message !== "string") return;
      setMessages((prev) => [...prev, msg]);
    };
    const handleJoinError = (e: any) => {
      const message = (e?.message || "").toString();
      if (message) setError(message);
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
      socket.emit("join-room", { game: "xox", roomCode: cleanRoom, username: cleanUser });
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
      socket.emit("leave-room", { game: "xox", roomCode: cleanRoom });
    };
  }, [roomCode, username]);

  const me = useMemo(() => {
    if (!room || !socketId) return null;
    return room.players.find((p) => p.id === socketId) ?? null;
  }, [room, socketId]);

  const playersForLobby: LobbyPlayer[] = useMemo(() => {
    if (!room) return [];
    return room.players.map((p) => ({
      id: p.id, username: p.username, isOwner: p.isOwner,
      color: p.color ?? undefined, isYou: socketId ? p.id === socketId : false,
      wins: p.wins,
    }));
  }, [room, socketId]);

  const canStart = !!room && room.gameState === "lobby" && !!me?.isOwner && room.players.length === 2;

  // Landing page — neon black theme
  if (!roomCode) {
    return (
      <div className="min-h-[var(--app-height)] lg:min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: "#050505", backgroundImage: "radial-gradient(ellipse at 50% 0%, rgba(255,7,58,0.08) 0%, transparent 60%), radial-gradient(ellipse at 50% 100%, rgba(0,212,255,0.08) 0%, transparent 60%)" }}>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-3xl max-w-md w-full"
          style={{ backgroundColor: "#0d0d0d", border: "1px solid #1a1a1a", boxShadow: "0 0 60px rgba(0,0,0,0.8)" }}>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl mb-4 -rotate-2"
              style={{ backgroundColor: "#111", border: "2px solid #FF073A", boxShadow: "0 0 20px rgba(255,7,58,0.3), 0 0 40px rgba(255,7,58,0.1)", color: "#FF073A" }}>
              <Grid3X3 size={32} />
            </div>
            <h2 className="text-3xl font-black tracking-tight" style={{ color: "#fff" }}>
              <span style={{ color: "#FF073A", textShadow: "0 0 20px rgba(255,7,58,0.5)" }}>X</span>
              <span style={{ color: "#555" }}>O</span>
              <span style={{ color: "#00D4FF", textShadow: "0 0 20px rgba(0,212,255,0.5)" }}>X</span>
            </h2>
            <p className="mt-1 font-medium text-sm" style={{ color: "#555" }}>Classic Tic-Tac-Toe with custom grid sizes.</p>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider" style={{ color: "#666" }}>Your Nickname</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. Rana"
                className="mt-2 w-full px-4 py-3 rounded-2xl outline-none transition-all font-medium text-[16px]"
                style={{ backgroundColor: "#111", border: "2px solid #222", color: "#eee", caretColor: "#FF073A" }} />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider" style={{ color: "#666" }}>Grid Size</label>
              <div className="mt-2 flex items-center gap-3">
                {[3, 4, 5, 6, 7, 8].map((s) => (
                  <button key={s} onClick={() => setGridSize(s)}
                    className="w-10 h-10 rounded-xl font-black text-sm transition-all"
                    style={{
                      backgroundColor: gridSize === s ? "#FF073A" : "#111",
                      color: gridSize === s ? "#fff" : "#555",
                      border: gridSize === s ? "2px solid #FF073A" : "2px solid #222",
                      boxShadow: gridSize === s ? "0 0 15px rgba(255,7,58,0.4)" : "none",
                    }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => {
              if (!username.trim()) return setError("Please enter a nickname");
              const code = generateCode();
              navigate(`/xox/${code}?grid=${gridSize}`);
            }}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-black transition-all active:scale-[0.99]"
              style={{ backgroundColor: "#FF073A", color: "#fff", boxShadow: "0 0 20px rgba(255,7,58,0.4), 0 4px 20px rgba(255,7,58,0.2)" }}>
              <Plus size={18} /> Create Room
            </button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center"><div className="w-full" style={{ borderTop: "1px solid #1a1a1a" }} /></div>
              <div className="relative flex justify-center text-[10px] uppercase font-black" style={{ color: "#444" }}>
                <span style={{ backgroundColor: "#0d0d0d", padding: "0 12px" }}>Or Join</span>
              </div>
            </div>

            <div className="space-y-2">
              <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="Enter Room Code"
                className="w-full px-4 py-3 rounded-2xl outline-none transition-all font-medium text-center uppercase tracking-widest text-[16px]"
                style={{ backgroundColor: "#111", border: "2px solid #222", color: "#eee" }} />
              <button onClick={() => {
                if (!username.trim()) return setError("Please enter a nickname");
                if (!codeInput.trim()) return setError("Please enter a room code");
                navigate(`/xox/${codeInput.trim().toUpperCase()}`);
              }}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-black transition-all active:scale-[0.99]"
                style={{ backgroundColor: "#00D4FF", color: "#000", boxShadow: "0 0 20px rgba(0,212,255,0.3)" }}>
                <LogIn size={18} /> Join Room
              </button>
            </div>

            {error && <div className="text-[11px] font-black text-center" style={{ color: "#FF073A" }}>{error}</div>}
            <button onClick={() => navigate("/")} className="w-full py-3 rounded-2xl font-black transition-colors" style={{ color: "#555" }}>
              Back to Games
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Username entry — neon black theme
  if (!username.trim()) {
    return (
      <div className="min-h-[var(--app-height)] lg:min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#050505" }}>
        <div className="p-6 rounded-3xl max-w-md w-full" style={{ backgroundColor: "#0d0d0d", border: "1px solid #1a1a1a" }}>
          <h2 className="text-xl font-black" style={{ color: "#eee" }}>Join XOX Room</h2>
          <p className="mt-1 text-sm" style={{ color: "#555" }}>
            Enter a nickname to join room <span className="font-black" style={{ color: "#FF073A" }}>{roomCode}</span>.
          </p>
          <div className="mt-4 space-y-3">
            <input value={draftUsername} onChange={(e) => setDraftUsername(e.target.value)} placeholder="Your nickname"
              className="w-full px-4 py-3 rounded-2xl outline-none transition-all font-medium text-[16px]"
              style={{ backgroundColor: "#111", border: "2px solid #222", color: "#eee" }} />
            <button onClick={() => {
              const cleaned = draftUsername.trim().slice(0, 24);
              if (!cleaned) return;
              try { localStorage.setItem("mgp.username", cleaned); } catch {}
              setUsername(cleaned);
            }} disabled={!draftUsername.trim()}
              className="w-full py-3 rounded-2xl font-black transition-all active:scale-[0.99]"
              style={{ backgroundColor: "#FF073A", color: "#fff", boxShadow: "0 0 20px rgba(255,7,58,0.3)" }}>
              Continue
            </button>
            <button onClick={() => navigate("/xox")}
              className="w-full py-3 rounded-2xl font-black transition-all active:scale-[0.99]"
              style={{ backgroundColor: "#111", color: "#888", border: "1px solid #222" }}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const inviteLink = buildInviteLink("xox", roomCode, room?.networkIP, room?.port);

  return (
    <Lobby
      title="XOX"
      roomCode={roomCode}
      inviteLink={inviteLink}
      players={playersForLobby}
      messages={messages}
      headerAccentClassName="bg-slate-900"
      canStart={canStart}
      startLabel="Start Game"
      onStart={() => {
        const params = new URLSearchParams(window.location.search);
        const g = parseInt(params.get("grid") || "3", 10);
        socket.emit("start-game", { game: "xox", roomCode, gridSize: g >= 3 && g <= 8 ? g : 3 });
      }}
      onLeave={() => {
        socket.emit("leave-room", { game: "xox", roomCode });
        navigate("/xox");
      }}
      onSendMessage={(message) => socket.emit("send-message", { game: "xox", roomCode, message, username })}
      chatPlaceholder="Chat…"
    >
      <div style={{ backgroundColor: "#0a0a0a" }}>
        {error && (
          <div className="px-4 pt-4">
            <div className="p-3 rounded-2xl font-black text-sm" style={{ backgroundColor: "#1a0508", border: "1px solid #FF073A33", color: "#FF073A" }}>{error}</div>
          </div>
        )}
        {room ? (
          <XoxBoard
            room={room}
            myId={socketId}
            onPlaceMove={(cell: number) => {
              if (!room || room.gameState !== "playing") return;
              if (!socketId || room.turn?.playerId !== socketId) return;
              socket.emit("xox-place", { roomCode, cell });
            }}
            onRestart={() => {
              socket.emit("xox-restart", { roomCode });
            }}
          />
        ) : (
          <div className="p-6">
            <div className="py-20 text-center">
              <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: "#FF073A", borderTopColor: "transparent" }} />
              <div className="mt-3 text-[10px] font-black uppercase tracking-widest" style={{ color: "#444" }}>Connecting…</div>
            </div>
          </div>
        )}
      </div>
    </Lobby>
  );
}
