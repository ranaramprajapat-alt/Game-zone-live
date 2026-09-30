import React from "react";
import Home from "@/src/pages/Home";
import NotFound from "@/src/pages/NotFound";
import DrawingGame from "@/src/pages/DrawingGame";
import LudoGame from "@/src/pages/LudoGame";
import SnakeLadderGame from "@/src/pages/SnakeLadderGame";
import XoxGame from "@/src/pages/XoxGame";
import RoyalKingsAdvangerGame from "@/src/pages/RoyalKingsAdvangerGame";
import GroupChatGame from "@/src/pages/GroupChatGame";
import { useRoute } from "@/src/lib/router";

export default function App() {
  const route = useRoute();

  if (route.name === "home") return <Home />;
  if (route.name === "not-found") return <NotFound />;

  switch (route.game) {
    case "drawing-game":
      return <DrawingGame roomCode={route.roomCode} />;
    case "ludo":
      return <LudoGame roomCode={route.roomCode} />;
    case "snake-ladder":
      return <SnakeLadderGame roomCode={route.roomCode} />;
    case "xox":
      return <XoxGame roomCode={route.roomCode} />;
    case "royal-kings-advanger":
      return <RoyalKingsAdvangerGame roomCode={route.roomCode} />;
    case "group-chat":
      return <GroupChatGame roomCode={route.roomCode} />;
    default:
      return <NotFound />;
  }
}
