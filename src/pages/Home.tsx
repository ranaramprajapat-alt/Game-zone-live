import React, { useEffect } from "react";
import { Palette, Dices, Route as RouteIcon, Grid3X3, Crown, MessageSquare } from "lucide-react";
import { motion } from "motion/react";
import GameCard from "@/src/components/GameCard";
import { navigate } from "@/src/lib/router";

export default function Home() {
  useEffect(() => {
    const room = new URLSearchParams(window.location.search).get("room");
    if (room) navigate(`/drawing-game/${room.toUpperCase()}`);
  }, []);

  return (
    <div className="min-h-[var(--app-height)] lg:min-h-screen bg-white/60 backdrop-blur-sm px-4 py-10">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 text-white rounded-3xl shadow-xl shadow-slate-200 mb-4">
            <RouteIcon size={32} />
          </div>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-slate-900">
            Mini<span className="text-indigo-600">Game</span> Platform
          </h1>
          <p className="mt-2 text-slate-500 font-medium text-sm lg:text-base">
            Pick a game, create a room, invite friends — play in real time.
          </p>
        </motion.div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 lg:gap-6">

          <GameCard
            title="Royal King's Advanger"
            description="Reclaim the lost treasury of your ancestors in this 3D kingdom action adventure!"
            icon={<Crown size={26} />}
            accentClassName="bg-amber-500"
            effect="royal-king"
            onPlay={() => navigate("/royal-kings-advanger")}
          />
          <GameCard
            title="Drawing Guess Game"
            description="Draw a secret word and race your friends to guess it first."
            icon={<Palette size={26} />}
            accentClassName="bg-indigo-600"
            effect="drawing"
            onPlay={() => navigate("/drawing-game")}
          />
          <GameCard
            title="Ludo Game"
            description="Roll the dice, move your tokens, capture opponents — first home wins."
            icon={<Dices size={26} />}
            accentClassName="bg-[linear-gradient(90deg,#EAB308_0%,#22C55E_33%,#3B82F6_66%,#EF4444_100%)]"
            effect="ludo"
            onPlay={() => navigate("/ludo")}
          />
          <GameCard
            title="Snake & Ladder Game"
            description="Climb ladders, slide down snakes — the first to reach 100 wins."
            icon={<RouteIcon size={26} />}
            accentClassName="bg-emerald-600"
            effect="snake-ladder"
            onPlay={() => navigate("/snake-ladder")}
          />
          <GameCard
            title="XOX Game"
            description="Classic Tic-Tac-Toe with custom grid sizes — challenge a friend!"
            icon={<Grid3X3 size={26} />}
            accentClassName="bg-violet-600"
            effect="xox"
            onPlay={() => navigate("/xox")}
          />
          <GameCard
            title="Group Chat"
            description="Create a group chat room, share the link or code, and chat live with friends!"
            icon={<MessageSquare size={26} />}
            accentClassName="bg-purple-600"
            effect="group-chat"
            onPlay={() => navigate("/group-chat")}
          />
        </div>
      </div>
    </div>
  );
}
