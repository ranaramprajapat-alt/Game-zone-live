export type SnakeLadderGameState = "lobby" | "playing" | "ended";

export interface SnakeLadderPlayer {
  id: string;
  username: string;
  isOwner: boolean;
  colorKey: "red" | "green" | "yellow" | "blue" | null;
  color: string | null;
}

export type SnakeLadderTurnPhase = "roll" | "move";

export interface SnakeLadderTurn {
  playerId: string;
  phase: SnakeLadderTurnPhase;
  dice: number | null;
}

export interface SnakeLadderLastRoll {
  by: string;
  dice: number;
  id: number;
}

export interface SnakeLadderLastMove {
  by: string;
  tokenIndex: number;
  from: number;
  dice: number;
  to: number;
  final: number;
  effect: "snake" | "ladder" | null;
  id: number;
}

export interface SnakeLadderRoomState {
  code: string;
  game: "snake-ladder";
  gameState: SnakeLadderGameState;
  players: SnakeLadderPlayer[];
  turn: SnakeLadderTurn | null;
  positions: Record<string, number[]>;
  turnOrder: string[];
  turnIndex: number;
  winnerId?: string | null;
  lastEventId: number;
  lastRoll: SnakeLadderLastRoll | null;
  lastMove: SnakeLadderLastMove | null;
  snakes: Record<number, number>;
  ladders: Record<number, number>;
  networkIP?: string;
  port?: number;
}
