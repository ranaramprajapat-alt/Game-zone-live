export type LudoColorKey = "red" | "green" | "yellow" | "blue";

export type LudoGameState = "lobby" | "playing" | "ended";

export interface LudoPlayer {
  id: string;
  username: string;
  isOwner: boolean;
  colorKey: LudoColorKey | null;
  color: string | null;
}

export type LudoTurnPhase = "roll" | "move";

export interface LudoTurn {
  playerId: string;
  phase: LudoTurnPhase;
  dice: number | null;
}

export interface LudoLastRoll {
  by: string;
  dice: number;
  id: number;
}

export interface LudoCaptureEvent {
  playerId: string;
  tokenIndex: number;
}

export type LudoLastMove =
  | { type: "pass"; by: string; dice: number; id: number }
  | {
      type: "move";
      by: string;
      tokenIndex: number;
      from: number;
      to: number;
      dice: number;
      path: number[];
      captured: LudoCaptureEvent[];
      id: number;
    }
  | null;

export interface LudoRoomState {
  code: string;
  game: "ludo";
  gameState: LudoGameState;
  players: LudoPlayer[];
  turn: LudoTurn | null;
  tokens: Record<string, number[]>;
  turnOrder: string[];
  turnIndex: number;
  winnerId?: string | null;
  scores?: Record<string, number>;
  lastEventId: number;
  lastRoll: LudoLastRoll | null;
  lastMove: LudoLastMove;
  networkIP?: string;
  port?: number;
}
