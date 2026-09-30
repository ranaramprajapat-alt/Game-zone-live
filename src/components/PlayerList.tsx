import React from "react";
import { Crown, User } from "lucide-react";
import { cn } from "@/src/lib/utils";

export interface LobbyPlayer {
  id: string;
  username: string;
  isOwner?: boolean;
  color?: string;
  isYou?: boolean;
  wins?: number;
}

interface PlayerListProps {
  players: LobbyPlayer[];
}

export default function PlayerList({ players }: PlayerListProps) {
  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="p-3 bg-white border-b border-slate-200 font-black text-[11px] tracking-wider uppercase text-slate-700">
        Players ({players.length})
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {players.map((player) => (
          <div
            key={player.id}
            className={cn(
              "flex items-center justify-between p-3 rounded-xl transition-all border",
              player.isYou ? "bg-indigo-50 border-indigo-100" : "bg-white border-slate-100"
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                <User size={16} className="text-slate-500" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  {player.color && (
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: player.color }}
                      aria-hidden
                    />
                  )}
                  <span className="font-bold text-sm text-slate-800 truncate">
                    {player.username}
                  </span>
                  {player.wins !== undefined && (
                    <span className="text-xs font-bold text-slate-400 shrink-0">
                      ({player.wins} {player.wins === 1 ? "win" : "wins"})
                    </span>
                  )}
                  {player.isYou && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                      You
                    </span>
                  )}
                </div>
                {player.isOwner && (
                  <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                    <Crown size={12} className="text-amber-500" /> Host
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {players.length === 0 && (
          <div className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
            Waiting for players...
          </div>
        )}
      </div>
    </div>
  );
}

