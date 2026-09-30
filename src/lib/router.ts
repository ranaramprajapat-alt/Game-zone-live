import { useEffect, useMemo, useState } from "react";

export type GamePath = "drawing-game" | "ludo" | "snake-ladder" | "xox" | "royal-kings-advanger" | "group-chat";

export type Route =
  | { name: "home" }
  | { name: "game"; game: GamePath; roomCode?: string }
  | { name: "not-found" };

function normalizePathname(pathname: string) {
  if (!pathname) return "/";
  const withoutQuery = pathname.split("?")[0] ?? "/";
  const trimmed = withoutQuery.replace(/\/+$/, "") || "/";
  return trimmed;
}

export function matchRoute(pathname: string): Route {
  const path = normalizePathname(pathname);
  if (path === "/") return { name: "home" };

  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return { name: "home" };

  const [game, roomCode] = parts;
  if (
    game === "drawing-game" ||
    game === "ludo" ||
    game === "snake-ladder" ||
    game === "xox" ||
    game === "royal-kings-advanger" ||
    game === "group-chat"
  ) {
    return { name: "game", game, roomCode: roomCode?.toUpperCase() };
  }

  return { name: "not-found" };
}

export function navigate(to: string) {
  const next = to.startsWith("/") ? to : `/${to}`;
  window.history.pushState({}, "", next);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useRoute(): Route {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return useMemo(() => matchRoute(pathname), [pathname]);
}

export function buildInviteLink(game: string, roomCode: string, serverIP?: string, serverPort?: number) {
  let origin = window.location.origin;
  if ((window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && serverIP && serverIP !== "localhost") {
    const port = serverPort || window.location.port || 3000;
    origin = `http://${serverIP}:${port}`;
  }
  return `${origin}/${game}/${roomCode}`;
}

