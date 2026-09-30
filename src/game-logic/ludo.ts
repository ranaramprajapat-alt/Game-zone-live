import type { LudoColorKey } from "@/src/games/ludo/types";

export type LudoCell = { row: number; col: number };

export const LUDO_COLORS: Array<{ key: LudoColorKey; hex: string; startOffset: number }> = [
  { key: "red", hex: "#EF4444", startOffset: 0 },
  { key: "blue", hex: "#3B82F6", startOffset: 13 },
  { key: "yellow", hex: "#EAB308", startOffset: 26 },
  { key: "green", hex: "#22C55E", startOffset: 39 },
];

export const LUDO_SAFE_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export const START_INDEX_TO_COLOR: Record<number, LudoColorKey> = {
  0: "red",
  13: "blue",
  26: "yellow",
  39: "green",
};

export const HOME_ENTRY_INDEX_TO_COLOR: Record<number, LudoColorKey> = {
  51: "red",
  12: "blue",
  25: "yellow",
  38: "green",
};

export const TRACK_CELLS: LudoCell[] = [
  { row: 6, col: 1 },
  { row: 6, col: 2 },
  { row: 6, col: 3 },
  { row: 6, col: 4 },
  { row: 6, col: 5 },
  { row: 5, col: 6 },
  { row: 4, col: 6 },
  { row: 3, col: 6 },
  { row: 2, col: 6 },
  { row: 1, col: 6 },
  { row: 0, col: 6 },
  { row: 0, col: 7 },
  { row: 0, col: 8 },
  { row: 1, col: 8 },
  { row: 2, col: 8 },
  { row: 3, col: 8 },
  { row: 4, col: 8 },
  { row: 5, col: 8 },
  { row: 6, col: 9 },
  { row: 6, col: 10 },
  { row: 6, col: 11 },
  { row: 6, col: 12 },
  { row: 6, col: 13 },
  { row: 6, col: 14 },
  { row: 7, col: 14 },
  { row: 8, col: 14 },
  { row: 8, col: 13 },
  { row: 8, col: 12 },
  { row: 8, col: 11 },
  { row: 8, col: 10 },
  { row: 8, col: 9 },
  { row: 9, col: 8 },
  { row: 10, col: 8 },
  { row: 11, col: 8 },
  { row: 12, col: 8 },
  { row: 13, col: 8 },
  { row: 14, col: 8 },
  { row: 14, col: 7 },
  { row: 14, col: 6 },
  { row: 13, col: 6 },
  { row: 12, col: 6 },
  { row: 11, col: 6 },
  { row: 10, col: 6 },
  { row: 9, col: 6 },
  { row: 8, col: 5 },
  { row: 8, col: 4 },
  { row: 8, col: 3 },
  { row: 8, col: 2 },
  { row: 8, col: 1 },
  { row: 8, col: 0 },
  { row: 7, col: 0 },
  { row: 6, col: 0 },
];

export const HOME_PATH_CELLS: Record<LudoColorKey, LudoCell[]> = {
  red: [
    { row: 7, col: 1 },
    { row: 7, col: 2 },
    { row: 7, col: 3 },
    { row: 7, col: 4 },
    { row: 7, col: 5 },
  ],
  blue: [
    { row: 1, col: 7 },
    { row: 2, col: 7 },
    { row: 3, col: 7 },
    { row: 4, col: 7 },
    { row: 5, col: 7 },
  ],
  yellow: [
    { row: 7, col: 13 },
    { row: 7, col: 12 },
    { row: 7, col: 11 },
    { row: 7, col: 10 },
    { row: 7, col: 9 },
  ],
  green: [
    { row: 13, col: 7 },
    { row: 12, col: 7 },
    { row: 11, col: 7 },
    { row: 10, col: 7 },
    { row: 9, col: 7 },
  ],
};

export const BASE_CELLS: Record<LudoColorKey, LudoCell[]> = {
  red: [
    { row: 2, col: 2 },
    { row: 2, col: 4 },
    { row: 4, col: 2 },
    { row: 4, col: 4 },
  ],
  blue: [
    { row: 2, col: 10 },
    { row: 2, col: 12 },
    { row: 4, col: 10 },
    { row: 4, col: 12 },
  ],
  green: [
    { row: 10, col: 2 },
    { row: 10, col: 4 },
    { row: 12, col: 2 },
    { row: 12, col: 4 },
  ],
  yellow: [
    { row: 10, col: 10 },
    { row: 10, col: 12 },
    { row: 12, col: 10 },
    { row: 12, col: 12 },
  ],
};

export function getLudoStartOffset(colorKey: LudoColorKey) {
  return LUDO_COLORS.find((c) => c.key === colorKey)?.startOffset ?? 0;
}

export function ludoGlobalIndex(colorKey: LudoColorKey, progress: number) {
  return (getLudoStartOffset(colorKey) + progress) % 52;
}

export function canMoveWithDice(progress: number, dice: number) {
  if (progress === 57) return false;
  if (progress === -1) return dice === 6;
  return progress + dice <= 57;
}

export function getMovePath(from: number, dice: number) {
  if (!canMoveWithDice(from, dice)) return [];
  const path: number[] = [];
  if (from === -1) {
    path.push(0);
    return path;
  }
  for (let next = from + 1; next <= from + dice; next++) path.push(next);
  return path;
}

export function getCellForProgress(colorKey: LudoColorKey, progress: number, tokenIndex: number): LudoCell {
  if (progress === -1) return BASE_CELLS[colorKey][tokenIndex] ?? { row: 7, col: 7 };
  if (progress === 57) return { row: 7, col: 7 };
  if (progress >= 52 && progress <= 56) return HOME_PATH_CELLS[colorKey][progress - 52] ?? { row: 7, col: 7 };
  if (progress >= 0 && progress <= 51) return TRACK_CELLS[ludoGlobalIndex(colorKey, progress)] ?? { row: 7, col: 7 };
  return { row: 7, col: 7 };
}

export function getCellCoordinates(row: number, col: number, cellSize: number) {
  return {
    x: col * cellSize + cellSize / 2,
    y: row * cellSize + cellSize / 2,
  };
}

export function getCenteredTokenPosition(row: number, col: number, boardSize: number, totalCellsPerRow = 15) {
  const cellSize = boardSize / totalCellsPerRow;
  return getCellCoordinates(row, col, cellSize);
}

export function getCellCenter(row: number, col: number, boardSize: number, totalCellsPerRow = 15) {
  return getCenteredTokenPosition(row, col, boardSize, totalCellsPerRow);
}

export function getHomeTokenPositions(colorKey: LudoColorKey, boardSize: number) {
  return BASE_CELLS[colorKey].map((cell) => getCenteredTokenPosition(cell.row, cell.col, boardSize, 15));
}

export function getTokenPixelPosition(colorKey: LudoColorKey, progress: number, tokenIndex: number, boardSize: number) {
  if (progress === -1) {
    return getHomeTokenPositions(colorKey, boardSize)[tokenIndex] ?? getCenteredTokenPosition(7, 7, boardSize, 15);
  }
  const cell = getCellForProgress(colorKey, progress, tokenIndex);
  return getCenteredTokenPosition(cell.row, cell.col, boardSize, 15);
}

export function cornerForCell(row: number, col: number): LudoColorKey | null {
  if (row <= 5 && col <= 5) return "red";
  if (row <= 5 && col >= 9) return "blue";
  if (row >= 9 && col <= 5) return "green";
  if (row >= 9 && col >= 9) return "yellow";
  return null;
}

export function cornerOrigin(colorKey: LudoColorKey) {
  switch (colorKey) {
    case "red":
      return { row: 0, col: 0 };
    case "blue":
      return { row: 0, col: 9 };
    case "green":
      return { row: 9, col: 0 };
    case "yellow":
      return { row: 9, col: 9 };
  }
}

export function isCornerInnerCell(row: number, col: number, colorKey: LudoColorKey) {
  const origin = cornerOrigin(colorKey);
  const rr = row - origin.row;
  const cc = col - origin.col;
  return rr >= 1 && rr <= 4 && cc >= 1 && cc <= 4;
}

export function getTrackProgressesFromPath(path: number[]) {
  return path.filter((step) => step >= 0 && step <= 51);
}
