import React, { useEffect } from "react";
import { navigate } from "@/src/lib/router";

interface RoyalKingsAdvangerGameProps {
  roomCode?: string;
}

export default function RoyalKingsAdvangerGame({ roomCode }: RoyalKingsAdvangerGameProps) {
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === "EXIT_GAME_ZONE") {
        navigate("/");
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div className="w-screen h-[var(--app-height)] lg:h-screen bg-black overflow-hidden relative">
      <iframe
        src="/royal-king/index.html"
        title="Royal King's Advanger"
        className="w-full h-full border-none"
        allow="autoplay; fullscreen"
      />
    </div>
  );
}
