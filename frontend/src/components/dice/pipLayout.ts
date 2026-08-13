export type PipPosition = { row: number; col: number }

export const PIP_LAYOUT: Record<number, PipPosition[]> = {
  1: [{ row: 2, col: 2 }],
  2: [
    { row: 1, col: 1 },
    { row: 3, col: 3 },
  ],
  3: [
    { row: 1, col: 1 },
    { row: 2, col: 2 },
    { row: 3, col: 3 },
  ],
  4: [
    { row: 1, col: 1 },
    { row: 1, col: 3 },
    { row: 3, col: 1 },
    { row: 3, col: 3 },
  ],
  5: [
    { row: 1, col: 1 },
    { row: 1, col: 3 },
    { row: 2, col: 2 },
    { row: 3, col: 1 },
    { row: 3, col: 3 },
  ],
  6: [
    { row: 1, col: 1 },
    { row: 1, col: 3 },
    { row: 2, col: 1 },
    { row: 2, col: 3 },
    { row: 3, col: 1 },
    { row: 3, col: 3 },
  ],
}
