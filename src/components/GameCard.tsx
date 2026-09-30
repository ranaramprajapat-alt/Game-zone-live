import React from "react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils";

type GameEffect = "drawing" | "ludo" | "snake-ladder" | "xox" | "royal-king" | "group-chat";

interface GameCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  accentClassName: string;
  onPlay: () => void;
  effect: GameEffect;
}

const effectStyles: Record<GameEffect, {
  shell: string;
  glow: string;
  particles: string[];
}> = {
  drawing: {
    shell: "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_18%_18%,rgba(99,102,241,0.18),transparent_30%),radial-gradient(circle_at_82%_24%,rgba(236,72,153,0.16),transparent_28%),radial-gradient(circle_at_55%_78%,rgba(56,189,248,0.14),transparent_30%)] before:opacity-0 before:transition-opacity before:duration-300 group-hover:before:opacity-100",
    glow: "bg-[conic-gradient(from_180deg_at_50%_50%,rgba(99,102,241,0.16),rgba(236,72,153,0.12),rgba(56,189,248,0.12),rgba(99,102,241,0.16))]",
    particles: [
      "left-[12%] top-[22%] bg-pink-400/80",
      "right-[18%] top-[30%] bg-sky-400/80",
      "left-[22%] bottom-[18%] bg-indigo-400/80",
    ],
  },
  ludo: {
    shell: "before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(135deg,rgba(239,68,68,0.08)_0%,rgba(239,68,68,0.08)_24%,transparent_24%,transparent_26%,rgba(59,130,246,0.08)_26%,rgba(59,130,246,0.08)_49%,transparent_49%,transparent_51%,rgba(34,197,94,0.08)_51%,rgba(34,197,94,0.08)_74%,transparent_74%,transparent_76%,rgba(234,179,8,0.08)_76%,rgba(234,179,8,0.08)_100%)] before:opacity-0 before:transition-opacity before:duration-300 group-hover:before:opacity-100",
    glow: "bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.18),transparent_55%)]",
    particles: [
      "left-[16%] top-[24%] bg-red-500/75",
      "right-[16%] top-[24%] bg-blue-500/75",
      "left-[16%] bottom-[18%] bg-green-500/75",
      "right-[16%] bottom-[18%] bg-yellow-400/85",
    ],
  },
  "snake-ladder": {
    shell: "before:pointer-events-none before:absolute before:inset-0 before:bg-[repeating-linear-gradient(135deg,rgba(16,185,129,0.10)_0px,rgba(16,185,129,0.10)_12px,transparent_12px,transparent_24px),repeating-linear-gradient(45deg,rgba(245,158,11,0.10)_0px,rgba(245,158,11,0.10)_12px,transparent_12px,transparent_24px)] before:opacity-0 before:transition-opacity before:duration-300 group-hover:before:opacity-100",
    glow: "bg-[radial-gradient(circle_at_50%_20%,rgba(16,185,129,0.18),transparent_45%),radial-gradient(circle_at_50%_90%,rgba(245,158,11,0.16),transparent_40%)]",
    particles: [
      "left-[14%] top-[26%] bg-emerald-500/80",
      "right-[18%] top-[44%] bg-amber-400/80",
      "left-[26%] bottom-[16%] bg-emerald-300/80",
    ],
  },
  xox: {
    shell: "before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(rgba(139,92,246,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.08)_1px,transparent_1px)] before:bg-[size:34px_34px] before:opacity-0 before:transition-opacity before:duration-300 group-hover:before:opacity-100",
    glow: "bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.16),transparent_55%)]",
    particles: [
      "left-[18%] top-[22%] bg-violet-400/80",
      "right-[20%] top-[40%] bg-fuchsia-400/75",
      "left-[28%] bottom-[16%] bg-indigo-400/80",
    ],
  },
  "royal-king": {
    shell: "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_20%,rgba(245,158,11,0.18),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(255,215,0,0.14),transparent_40%)] before:opacity-0 before:transition-opacity before:duration-300 group-hover:before:opacity-100",
    glow: "bg-[radial-gradient(circle_at_50%_50%,rgba(245,158,11,0.18),transparent_55%)]",
    particles: [
      "left-[15%] top-[20%] bg-amber-400/80",
      "right-[18%] top-[35%] bg-yellow-400/80",
      "left-[25%] bottom-[15%] bg-orange-400/80",
    ],
  },
  "group-chat": {
    shell: "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.18),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(99,102,241,0.18),transparent_40%)] before:opacity-0 before:transition-opacity before:duration-300 group-hover:before:opacity-100",
    glow: "bg-[radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.18),transparent_55%)]",
    particles: [
      "left-[16%] top-[20%] bg-purple-400/80",
      "right-[16%] top-[35%] bg-indigo-400/80",
      "left-[24%] bottom-[16%] bg-pink-400/80",
    ],
  },
};

export default function GameCard({ title, description, icon, accentClassName, onPlay, effect }: GameCardProps) {
  const currentEffect = effectStyles[effect];

  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "group relative overflow-hidden rounded-3xl border bg-white shadow-xl shadow-slate-200/70",
        currentEffect.shell,
        "transition-all hover:shadow-2xl hover:shadow-slate-200/80"
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-1.5", accentClassName)} />
      <div className={cn("pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-300 group-hover:opacity-100", currentEffect.glow)} />

      {currentEffect.particles.map((particleClassName, index) => (
        <motion.span
          key={`${title}-particle-${index}`}
          className={cn("pointer-events-none absolute h-2.5 w-2.5 rounded-full blur-[1px]", particleClassName)}
          initial={{ opacity: 0.35, scale: 0.9 }}
          animate={{
            y: [0, index % 2 === 0 ? -12 : 10, 0],
            x: [0, index % 2 === 0 ? 8 : -8, 0],
            opacity: [0.28, 0.72, 0.28],
            scale: [0.9, 1.15, 0.9],
          }}
          transition={{
            duration: 2.6 + index * 0.35,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      <div className="relative z-10 p-6 lg:p-7">
        <div className="flex items-start justify-between gap-4">
          <motion.div
            className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg", accentClassName)}
            animate={
              effect === "drawing"
                ? { rotate: [0, -8, 8, 0], scale: [1, 1.06, 1] }
                : effect === "ludo"
                  ? { rotate: [0, 0, 90, 90, 180, 180, 0], scale: [1, 1.04, 1] }
                  : effect === "snake-ladder"
                    ? { y: [0, -10, 8, -4, 0], rotate: [0, 4, -4, 0] }
                    : { scale: [1, 1.08, 1], rotate: [0, 6, 0, -6, 0] }
            }
            transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
          >
            {icon}
          </motion.div>
          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Multiplayer</div>
          </div>
        </div>

        <h3 className="mt-5 text-xl lg:text-2xl font-black tracking-tight text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-500 font-medium leading-relaxed">{description}</p>

        <button
          onClick={onPlay}
          className={cn(
            "mt-5 w-full py-3 rounded-2xl font-black text-white",
            "shadow-lg active:scale-[0.99] transition-all",
            accentClassName,
            "hover:brightness-110"
          )}
        >
          Play
        </button>
      </div>
    </motion.div>
  );
}
