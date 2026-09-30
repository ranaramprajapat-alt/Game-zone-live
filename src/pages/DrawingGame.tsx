import React, { useMemo, useState } from "react";
import DrawingLobby from "@/src/games/drawing-game/DrawingLobby";
import DrawingRoom from "@/src/games/drawing-game/DrawingRoom";
import { navigate } from "@/src/lib/router";

interface DrawingGameProps {
  roomCode?: string;
}

function getStoredUsername() {
  try {
    return localStorage.getItem("mgp.username") ?? "";
  } catch {
    return "";
  }
}

export default function DrawingGame({ roomCode }: DrawingGameProps) {
  const [username, setUsername] = useState(getStoredUsername);
  const [draftUsername, setDraftUsername] = useState("");

  const maxRounds = useMemo(() => {
    if (!roomCode) return undefined;
    const raw = sessionStorage.getItem(`mgp.drawing.${roomCode}.maxRounds`);
    const parsed = raw ? Number(raw) : undefined;
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [roomCode]);

  if (!roomCode) {
    return (
      <DrawingLobby
        onJoin={(code, user) => {
          try {
            localStorage.setItem("mgp.username", user);
          } catch {
            // ignore
          }
          setUsername(user);
          navigate(`/drawing-game/${code}`);
        }}
        onCreate={(user, rounds) => {
          const code = Math.random().toString(36).substring(2, 8).toUpperCase();
          try {
            localStorage.setItem("mgp.username", user);
          } catch {
            // ignore
          }
          setUsername(user);
          sessionStorage.setItem(`mgp.drawing.${code}.maxRounds`, String(rounds));
          navigate(`/drawing-game/${code}`);
        }}
      />
    );
  }

  if (!username.trim()) {
    return (
      <div className="min-h-[var(--app-height)] lg:min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200 max-w-md w-full">
          <h2 className="text-xl font-black text-slate-900">Join Drawing Room</h2>
          <p className="mt-1 text-sm text-slate-500">Enter a nickname to join room <span className="font-black text-slate-900">{roomCode}</span>.</p>
          <div className="mt-4 space-y-3">
            <input
              value={draftUsername}
              onChange={(e) => setDraftUsername(e.target.value)}
              placeholder="Your nickname"
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-[16px]"
            />
            <button
              onClick={() => {
                const cleaned = draftUsername.trim().slice(0, 24);
                if (!cleaned) return;
                try {
                  localStorage.setItem("mgp.username", cleaned);
                } catch {
                  // ignore
                }
                setUsername(cleaned);
              }}
              disabled={!draftUsername.trim()}
              className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-[0.99]"
            >
              Continue
            </button>
            <button
              onClick={() => navigate("/drawing-game")}
              className="w-full py-3 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-[0.99]"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DrawingRoom
      roomCode={roomCode}
      username={username}
      maxRounds={maxRounds}
      onExit={() => navigate("/drawing-game")}
    />
  );
}
