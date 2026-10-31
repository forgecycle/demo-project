// Checkers rules. Pure functions only: no DOM, no globals, no mutation.
// A state is { board, turn }. The board is 8 rows of 8 squares, row 0 at the
// top; each square is null or a piece { color: 'dark' | 'light' }.
// Dark starts at the bottom (rows 5-7), moves up, and moves first.

export const SIZE = 8;

const FORWARD = { dark: -1, light: 1 };

export function isPlayable(row, col) {
  return (row + col) % 2 === 1;
}

export function onBoard(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

export function opponent(color) {
  return color === 'dark' ? 'light' : 'dark';
}

export function initialState() {
  const board = [];
  for (let row = 0; row < SIZE; row++) {
    const cells = [];
    for (let col = 0; col < SIZE; col++) {
      let piece = null;
      if (isPlayable(row, col) && row < 3) piece = { color: 'light' };
      if (isPlayable(row, col) && row > 4) piece = { color: 'dark' };
      cells.push(piece);
    }
    board.push(cells);
  }
  return { board, turn: 'dark' };
}

export function pieceAt(state, row, col) {
  return onBoard(row, col) ? state.board[row][col] : null;
}

// Moves for the piece on (row, col). A move is
// { from: [row, col], to: [row, col], capture: [row, col] | null }.
// A piece steps one square diagonally forward, or jumps an adjacent
// opponent piece diagonally forward onto the empty square behind it.
export function movesFrom(state, row, col) {
  const piece = pieceAt(state, row, col);
  if (!piece) return [];
  const dr = FORWARD[piece.color];
  const moves = [];
  for (const dc of [-1, 1]) {
    const stepRow = row + dr;
    const stepCol = col + dc;
    if (!onBoard(stepRow, stepCol)) continue;
    const target = pieceAt(state, stepRow, stepCol);
    if (!target) {
      moves.push({ from: [row, col], to: [stepRow, stepCol], capture: null });
      continue;
    }
    const jumpRow = stepRow + dr;
    const jumpCol = stepCol + dc;
    if (
      target.color === opponent(piece.color) &&
      onBoard(jumpRow, jumpCol) &&
      !pieceAt(state, jumpRow, jumpCol)
    ) {
      moves.push({ from: [row, col], to: [jumpRow, jumpCol], capture: [stepRow, stepCol] });
    }
  }
  return moves;
}

// Every move the player to move can make.
export function legalMoves(state) {
  const moves = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const piece = pieceAt(state, row, col);
      if (piece && piece.color === state.turn) moves.push(...movesFrom(state, row, col));
    }
  }
  return moves;
}

function sameSquare(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

// Returns the state after `move`. Only from and to are read; the move must
// be one of legalMoves(state), or this throws.
export function applyMove(state, move) {
  const legal = legalMoves(state).find(
    (m) => sameSquare(m.from, move.from) && sameSquare(m.to, move.to),
  );
  if (!legal) throw new Error(`illegal move ${JSON.stringify(move)}`);

  const board = state.board.map((cells) => cells.slice());
  const [fromRow, fromCol] = legal.from;
  const [toRow, toCol] = legal.to;
  board[toRow][toCol] = board[fromRow][fromCol];
  board[fromRow][fromCol] = null;
  if (legal.capture) board[legal.capture[0]][legal.capture[1]] = null;

  return { board, turn: opponent(state.turn) };
}
