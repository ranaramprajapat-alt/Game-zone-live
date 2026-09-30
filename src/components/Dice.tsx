import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils";

interface DiceProps {
  value: number | null;
  rolling: boolean;
  disabled?: boolean;
  onRoll?: () => void;
  accentClassName: string;
  label?: string;
}

function getRandomFace() {
  return 1 + Math.floor(Math.random() * 6);
}

export default function Dice({ value, rolling, disabled, onRoll, accentClassName, label = "Roll" }: DiceProps) {
  const [fake, setFake] = useState<number>(() => value ?? 1);

  useEffect(() => {
    if (!rolling) return;
    const id = window.setInterval(() => setFake(getRandomFace()), 80);
    return () => window.clearInterval(id);
  }, [rolling]);

  const shown = rolling ? fake : (value ?? 1);

  const pips = useMemo(() => {
    const pip = (key: string, cls: string) => (
      <div key={key} className={cn("w-2.5 h-2.5 rounded-full bg-slate-900", cls)} />
    );

    const map: Record<number, Array<ReturnType<typeof pip>>> = {
      1: [pip("c", "col-start-2 row-start-2")],
      2: [pip("tl", "col-start-1 row-start-1"), pip("br", "col-start-3 row-start-3")],
      3: [pip("tl", "col-start-1 row-start-1"), pip("c", "col-start-2 row-start-2"), pip("br", "col-start-3 row-start-3")],
      4: [pip("tl", "col-start-1 row-start-1"), pip("tr", "col-start-3 row-start-1"), pip("bl", "col-start-1 row-start-3"), pip("br", "col-start-3 row-start-3")],
      5: [pip("tl", "col-start-1 row-start-1"), pip("tr", "col-start-3 row-start-1"), pip("c", "col-start-2 row-start-2"), pip("bl", "col-start-1 row-start-3"), pip("br", "col-start-3 row-start-3")],
      6: [
        pip("tl", "col-start-1 row-start-1"),
        pip("tr", "col-start-3 row-start-1"),
        pip("ml", "col-start-1 row-start-2"),
        pip("mr", "col-start-3 row-start-2"),
        pip("bl", "col-start-1 row-start-3"),
        pip("br", "col-start-3 row-start-3"),
      ],
    };

    return map[shown] ?? map[1];
  }, [shown]);

  return (
    <div className="flex items-center gap-3">
      <motion.div
        animate={
          rolling
            ? {
                rotate: [0, 45, -35, 25, -10, 0],
                y: [0, -10, 4, -6, 2, 0],
                scale: [1, 1.12, 0.92, 1.06, 0.98, 1],
              }
            : { rotate: 0, y: 0, scale: 1 }
        }
        transition={{ duration: 0.75, ease: "easeInOut" }}
        className={cn(
          "relative w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center",
          rolling ? "shadow-xl shadow-amber-300/50" : ""
        )}
        aria-label={value ? `Dice: ${value}` : "Dice"}
      >
        {rolling && (
          <motion.div
            className="absolute inset-[-6px] rounded-[20px] bg-amber-300/25"
            animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.96, 1.08, 0.96] }}
            transition={{ duration: 0.75, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
        )}
        <div className="grid grid-cols-3 grid-rows-3 gap-1 w-8 h-8">{pips}</div>
      </motion.div>

      {onRoll && (
        <button
          onClick={onRoll}
          disabled={disabled}
          className={cn(
            "px-4 py-3 rounded-2xl font-black text-white shadow-lg transition-all active:scale-[0.99]",
            accentClassName,
            disabled ? "opacity-60" : "hover:brightness-110 ring-4 ring-amber-300/20"
          )}
        >
          {label}
        </button>
      )}
    </div>
  );
}
