export type XoxGameState = "lobby" | "playing" | "ended";

export interface XoxPlayer {
  id: string;
  username: string;
  isOwner: boolean;
  symbol: "X" | "O" | null;
  color: string | null;
  wins?: number;
}

export interface XoxTurn {
  playerId: string;
}

export interface XoxRoomState {
  code: string;
  game: "xox";
  gameState: XoxGameState;
  players: XoxPlayer[];
  turn: XoxTurn | null;
  board: (string | null)[];
  gridSize: number;
  winLength: number;
  turnOrder: string[];
  turnIndex: number;
  winnerId?: string | null;
  isDraw?: boolean;
  lastEventId: number;
  lastMove: { by: string; cell: number; id: number } | null;
  networkIP?: string;
  port?: number;
}
