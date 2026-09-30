import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { MessageSquare, Plus, LogIn, Send, Copy, Check, Users, ArrowLeft, Shield, Sparkles } from "lucide-react";
import { socket } from "@/src/lib/socket";
import { buildInviteLink, navigate } from "@/src/lib/router";

interface GroupChatGameProps {
  roomCode?: string;
}

interface ChatMember {
  id: string;
  username: string;
  isOwner?: boolean;
  color?: string;
}

interface ChatMessage {
  id?: string;
  username: string;
  message: string;
  time?: string;
}

interface GroupRoomState {
  code: string;
  game: "group-chat";
  players: ChatMember[];
  messages: ChatMessage[];
  networkIP?: string;
  port?: number;
}

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

export default function GroupChatGame({ roomCode }: GroupChatGameProps) {
  const [username, setUsername] = useState(getStoredUsername);
  const [draftUsername, setDraftUsername] = useState(getStoredUsername);
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [room, setRoom] = useState<GroupRoomState | null>(null);
  const [socketId, setSocketId] = useState<string | null>(socket.id ?? null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onConnect = () => setSocketId(socket.id ?? null);
    socket.on("connect", onConnect);
    onConnect();
    return () => {
      socket.off("connect", onConnect);
    };
  }, []);

  useEffect(() => {
    const handleRoomUpdate = (updated: any) => {
      if (!updated || updated.game !== "group-chat") return;
      if (roomCode && updated.code !== roomCode) return;
      setRoom(updated as GroupRoomState);
    };

    const handleNewMessage = (msg: ChatMessage) => {
      if (!msg || !msg.message) return;
      setRoom((prev) => {
        if (!prev) return prev;
        if (msg.id && prev.messages.some((m) => m.id === msg.id)) return prev;
        return {
          ...prev,
          messages: [...prev.messages, msg],
        };
      });
    };

    const handleJoinError = (e: any) => {
      const msg = (e?.message || "").toString();
      if (msg) setError(msg);
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

    try {
      localStorage.setItem("mgp.username", cleanUser);
    } catch {}

    const emitJoin = () => {
      socket.emit("join-room", { game: "group-chat", roomCode: cleanRoom, username: cleanUser });
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
      socket.emit("leave-room", { game: "group-chat", roomCode: cleanRoom });
    };
  }, [roomCode, username]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [room?.messages]);

  const inviteLink = useMemo(() => {
    if (!roomCode) return "";
    return buildInviteLink("group-chat", roomCode, room?.networkIP, room?.port);
  }, [roomCode, room?.networkIP, room?.port]);

  const handleCopyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = () => {
    const text = messageInput.trim();
    if (!text || !roomCode || !username.trim()) return;
    socket.emit("send-message", { game: "group-chat", roomCode, message: text, username: username.trim() });
    setMessageInput("");
  };

  const sendReaction = (emoji: string) => {
    if (!roomCode || !username.trim()) return;
    socket.emit("send-message", { game: "group-chat", roomCode, message: emoji, username: username.trim() });
  };

  // LANDING PAGE (No roomCode in URL)
  if (!roomCode) {
    return (
      <div className="min-h-[var(--app-height)] lg:min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden text-white font-sans">
        {/* Glowing Background Glass Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/30 rounded-full blur-[120px] pointer-events-none animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/30 rounded-full blur-[120px] pointer-events-none animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="bg-slate-900/40 border border-white/15 p-6 lg:p-8 rounded-3xl max-w-md w-full shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl relative z-10"
        >
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 shadow-lg shadow-indigo-500/30 mb-4 -rotate-3 backdrop-blur-md">
              <MessageSquare size={32} />
            </div>
            <h2 className="text-3xl font-black tracking-tight text-white drop-shadow-md">
              Group <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300">Chat</span>
            </h2>
            <p className="mt-1.5 font-medium text-sm text-slate-300/80">
              Create a lounge or join via link / room code to chat live in a sleek glass theme.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-1.5">
                Your Nickname
              </label>
              <input
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setDraftUsername(e.target.value);
                }}
                placeholder="e.g. Alex"
                className="w-full px-4 py-3.5 bg-slate-950/50 border border-white/15 rounded-2xl outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 transition-all font-medium text-slate-100 placeholder:text-slate-500 text-[16px] backdrop-blur-xl shadow-inner"
              />
            </div>

            <button
              onClick={() => {
                const nameToUse = username.trim() || draftUsername.trim();
                if (!nameToUse) return setError("Please enter a nickname");
                try {
                  localStorage.setItem("mgp.username", nameToUse);
                } catch {}
                setUsername(nameToUse);
                const code = generateCode();
                navigate(`/group-chat/${code}`);
              }}
              className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl font-black transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 active:scale-[0.98] border border-white/20"
            >
              <Plus size={18} /> Create Glass Lounge
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest text-slate-400">
                <span className="bg-slate-950/80 px-3 rounded-full backdrop-blur-md border border-white/5">
                  Or Join Existing Room
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="ENTER ROOM CODE"
                className="w-full px-4 py-3.5 bg-slate-950/50 border border-white/15 rounded-2xl outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-500/20 transition-all font-medium text-center uppercase tracking-widest text-slate-100 placeholder:text-slate-500 text-[16px] backdrop-blur-xl shadow-inner"
              />
              <button
                onClick={() => {
                  const nameToUse = username.trim() || draftUsername.trim();
                  if (!nameToUse) return setError("Please enter a nickname");
                  if (!codeInput.trim()) return setError("Please enter a room code");
                  try {
                    localStorage.setItem("mgp.username", nameToUse);
                  } catch {}
                  setUsername(nameToUse);
                  navigate(`/group-chat/${codeInput.trim().toUpperCase()}`);
                }}
                className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-black transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 active:scale-[0.98] border border-white/20"
              >
                <LogIn size={18} /> Join Room
              </button>
            </div>

            {error && (
              <div className="text-xs font-black text-center text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl backdrop-blur-md">
                {error}
              </div>
            )}

            <button
              onClick={() => navigate("/")}
              className="flex items-center justify-center gap-2 w-full py-3 text-slate-400 hover:text-white rounded-2xl font-bold transition-all hover:bg-white/5"
            >
              <ArrowLeft size={16} /> Back to Games
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // NICKNAME PROMPT (If joining via direct link and no stored username exists)
  if (!username.trim()) {
    return (
      <div className="min-h-[var(--app-height)] lg:min-h-screen bg-slate-950 flex items-center justify-center p-4 text-white relative overflow-hidden font-sans">
        <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-indigo-600/30 rounded-full blur-[100px] pointer-events-none" />
        <div className="bg-slate-900/40 border border-white/15 p-6 rounded-3xl max-w-md w-full shadow-2xl backdrop-blur-2xl space-y-4 relative z-10">
          <h2 className="text-2xl font-black text-white">Join Glass Lounge</h2>
          <p className="text-sm text-slate-300">
            Enter a nickname to join chat room <span className="font-black text-indigo-300">{roomCode}</span>.
          </p>
          <input
            value={draftUsername}
            onChange={(e) => setDraftUsername(e.target.value)}
            placeholder="Your nickname"
            className="w-full px-4 py-3.5 bg-slate-950/50 border border-white/15 rounded-2xl outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 transition-all font-medium text-slate-100 text-[16px] backdrop-blur-xl shadow-inner"
          />
          <button
            onClick={() => {
              const cleaned = draftUsername.trim().slice(0, 24);
              if (!cleaned) return;
              try {
                localStorage.setItem("mgp.username", cleaned);
              } catch {}
              setUsername(cleaned);
            }}
            disabled={!draftUsername.trim()}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white rounded-2xl font-black transition-all shadow-lg shadow-indigo-500/30 active:scale-[0.98] border border-white/20"
          >
            Continue to Chat
          </button>
          <button
            onClick={() => navigate("/group-chat")}
            className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-bold border border-white/10 transition-all"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // ACTIVE GROUP CHAT ROOM VIEW (GLASSY THEME)
  return (
    <div className="min-h-[var(--app-height)] lg:min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-hidden">
      {/* Background Glowing Ambient Orbs */}
      <div className="absolute -top-24 left-1/4 w-96 h-96 bg-indigo-600/25 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 -right-20 w-96 h-96 bg-purple-600/25 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-20 left-1/3 w-[500px] h-[500px] bg-pink-600/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Glassy Room Header */}
      <header className="bg-slate-900/30 border-b border-white/10 px-4 py-3 sticky top-0 z-30 backdrop-blur-2xl flex items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/group-chat")}
            className="p-2.5 bg-white/5 hover:bg-white/15 border border-white/10 rounded-2xl text-slate-200 transition-all active:scale-95 shadow-md"
            title="Leave Lounge"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-black text-lg text-white drop-shadow-sm">Group Chat</span>
              <span className="px-3 py-0.5 bg-gradient-to-r from-indigo-500/30 to-purple-500/30 text-indigo-200 border border-indigo-400/40 rounded-full text-xs font-black tracking-widest shadow-sm backdrop-blur-md">
                {roomCode}
              </span>
            </div>
            <div className="text-[11px] text-slate-300/80 font-medium flex items-center gap-2 mt-0.5">
              <Users size={12} className="text-indigo-400 animate-pulse" /> {room?.players.length ?? 1} Members Online
            </div>
          </div>
        </div>

        {/* Invite Link & Copy Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600/30 to-purple-600/30 hover:from-indigo-600/50 hover:to-purple-600/50 border border-indigo-400/30 rounded-2xl text-xs font-black text-white transition-all shadow-md backdrop-blur-md active:scale-[0.97]"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-indigo-300" />}
            <span className="hidden sm:inline">{copied ? "Link Copied!" : "Invite Link"}</span>
          </button>
        </div>
      </header>

      {/* Main Glassy Chat Layout */}
      <div className="flex-1 max-w-6xl w-full mx-auto grid grid-cols-1 md:grid-cols-4 gap-4 p-3 lg:p-6 overflow-hidden relative z-10">
        {/* Active Members Sidebar (Glass Card) */}
        <div className="hidden md:flex flex-col bg-slate-900/40 border border-white/10 rounded-3xl p-4 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
          <div className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3">
            <Users size={14} className="text-indigo-400" /> Active Members ({room?.players.length ?? 0})
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {room?.players.map((member) => (
              <div
                key={member.id}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                  member.id === socketId
                    ? "bg-indigo-500/20 border-indigo-400/40 shadow-inner"
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center text-slate-950 shrink-0 shadow-md border border-white/20"
                    style={{ backgroundColor: member.color || "#6366f1" }}
                  >
                    {member.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-bold truncate text-slate-100">{member.username}</span>
                </div>
                {member.isOwner && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-black flex items-center gap-1 shadow-sm">
                    <Shield size={10} /> Host
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Chat Thread Area (Glass Container) */}
        <div className="md:col-span-3 flex flex-col bg-slate-900/40 border border-white/10 rounded-3xl backdrop-blur-2xl overflow-hidden h-[calc(100vh-140px)] lg:h-[calc(100vh-160px)] shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {room?.messages && room.messages.length > 0 ? (
              room.messages.map((msg, idx) => {
                const isMe = msg.username === username;
                return (
                  <div key={msg.id || idx} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-2 text-[10px] text-slate-300/80 font-bold mb-1 px-1">
                      <span>{msg.username}</span>
                      {msg.time && <span>• {msg.time}</span>}
                    </div>
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed break-words shadow-lg transition-all ${
                        isMe
                          ? "bg-gradient-to-r from-indigo-600/90 to-purple-600/90 text-white border border-indigo-400/30 rounded-br-none shadow-indigo-500/20"
                          : "bg-slate-800/60 backdrop-blur-md text-slate-100 border border-white/15 rounded-bl-none shadow-black/20"
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center space-y-3 p-6">
                <div className="p-4 bg-indigo-500/10 border border-indigo-400/30 rounded-3xl backdrop-blur-md">
                  <Sparkles size={36} className="text-indigo-300 animate-pulse" />
                </div>
                <p className="text-base font-black text-white">Welcome to Glass Lounge!</p>
                <p className="text-xs max-w-xs text-slate-300/80 leading-relaxed">
                  Share the link or code <span className="text-indigo-300 font-bold">{roomCode}</span> to invite friends to talk in real time.
                </p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Reaction Emoji Bar (Glassy Chips) */}
          <div className="px-4 py-2.5 border-t border-white/10 flex items-center gap-2 overflow-x-auto scrollbar-none bg-slate-950/40 backdrop-blur-md">
            {["👋", "🔥", "👑", "😂", "❤️", "🚀", "💬", "🎉"].map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/15 border border-white/10 rounded-xl text-base transition-all active:scale-90 hover:scale-105 shadow-sm"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Message Input Bar (Frosted Glass Input) */}
          <div className="p-3.5 bg-slate-950/60 border-t border-white/10 backdrop-blur-2xl flex items-center gap-2.5">
            <input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Type your message…"
              className="flex-1 bg-slate-900/60 border border-white/15 rounded-2xl px-4 py-3.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 transition-all font-medium backdrop-blur-xl shadow-inner"
            />
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim()}
              className="p-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white rounded-2xl transition-all shadow-lg shadow-indigo-500/30 border border-white/20 active:scale-95 shrink-0"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
