import React, { useState, useEffect } from "react";
import { cn } from "@/src/lib/utils";
import { Play, Plus, LogIn, Palette, Trophy, User as UserIcon, LogOut } from "lucide-react";
import { motion } from "motion/react";
import { auth } from "../firebase";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from "firebase/auth";
import { firebaseService } from "../services/firebaseService";

interface HomeProps {
  onJoin: (roomCode: string, username: string) => void;
  onCreate: (username: string, maxRounds: number) => void;
}

export default function Home({ onJoin, onCreate }: HomeProps) {
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [maxRounds, setMaxRounds] = useState(3);

  useEffect(() => {
    const roomFromUrl = new URLSearchParams(window.location.search).get("room");
    if (roomFromUrl) setRoomCode(roomFromUrl.toUpperCase());

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && !username) {
        setUsername(currentUser.displayName || "");
      }
    });

    const fetchLeaderboard = async () => {
      try {
        const topPlayers = await firebaseService.getTopPlayers(5);
        setLeaderboard(topPlayers || []);
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
      } finally {
        setLoadingLeaderboard(false);
      }
    };

    fetchLeaderboard();
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Auth error:", err);
      setError("Failed to sign in with Google");
    }
  };

  const handleSignOut = () => signOut(auth);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return setError("Please enter a username");
    if (!roomCode.trim()) return setError("Please enter a room code");
    onJoin(roomCode.toUpperCase(), username);
  };

  const handleCreate = () => {
    if (!username.trim()) return setError("Please enter a username");
    onCreate(username, maxRounds);
  };

  return (
    <div className="min-h-[var(--app-height)] lg:min-h-screen bg-white/60 backdrop-blur-sm flex flex-col lg:flex-row items-center justify-start lg:justify-center p-4 gap-8 lg:gap-16">
      <div className="max-w-md w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 text-white rounded-3xl shadow-xl shadow-indigo-200 mb-4 rotate-3">
            <Palette size={32} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-1">
            Sketch<span className="text-indigo-600">Guess</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm">The ultimate multiplayer drawing battle</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100"
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Your Nickname
              </label>
              {user ? (
                <button
                  onClick={handleSignOut}
                  className="text-[10px] font-bold text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
                >
                  <LogOut size={10} /> Sign Out
                </button>
              ) : (
                <button
                  onClick={handleSignIn}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                >
                  <LogIn size={10} /> Sign In with Google
                </button>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Rana"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
              />
              {user && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                  <UserIcon size={12} className="text-indigo-600" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Game Length</label>
                <div className="flex gap-2">
                  {[3, 5, 10].map((rounds) => (
                    <button
                      key={rounds}
                      onClick={() => setMaxRounds(rounds)}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                        maxRounds === rounds
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                          : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                      )}
                    >
                      {rounds} Rounds
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreate}
                className="flex items-center justify-center gap-3 w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
              >
                <Plus size={18} />
                Create Private Room
              </button>
            </div>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400">
                <span className="bg-white px-2 lg:px-4">Or Join a Room</span>
              </div>
            </div>

            <form onSubmit={handleJoin} className="space-y-2 lg:space-y-3">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="Enter Room Code"
                className="w-full px-4 py-2.5 lg:py-3 bg-slate-50 border-2 border-slate-100 rounded-xl lg:rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-center uppercase tracking-widest text-[16px] lg:text-base"
              />
              <button
                type="submit"
                className="flex items-center justify-center gap-2 lg:gap-3 w-full py-3 lg:py-3.5 bg-slate-900 text-white rounded-xl lg:rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-[0.98] text-sm lg:text-base"
              >
                <LogIn size={16} className="lg:w-[18px]" />
                Join Game
              </button>
            </form>

            {error && (
              <p className="text-rose-500 text-[10px] font-bold text-center animate-pulse">
                {error}
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Global Leaderboard Section */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-sm"
      >
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <Trophy size={20} className="text-amber-400" />
              </div>
              <div>
                <h3 className="font-black uppercase tracking-tight text-sm">Global Hall of Fame</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Top 5 Artists</p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-2">
            {loadingLeaderboard ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading...</span>
              </div>
            ) : leaderboard.length > 0 ? (
              leaderboard.map((player, i) => (
                <div
                  key={player.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl transition-all",
                    i === 0 ? "bg-amber-50 border border-amber-100" : "bg-slate-50 border border-slate-100"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black",
                      i === 0 ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-500"
                    )}>
                      {i + 1}
                    </span>
                    <span className="font-bold text-slate-700 text-sm">{player.username}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-indigo-600 text-xs">{player.totalScore}</div>
                    <div className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{player.gamesPlayed} games</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No legends yet...</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Sign in to save your scores!
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
