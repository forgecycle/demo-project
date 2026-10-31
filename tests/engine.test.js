import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, legalMoves, movesFrom, applyMove, pieceAt } from '../src/engine.js';
import { boardFrom } from './board.js';

const destinations = (moves) => moves.map((m) => m.to).sort();

test('the initial board has 12 pieces per side on dark squares, dark to move', () => {
  const state = initialState();
  let dark = 0;
  let light = 0;
  state.board.forEach((cells, row) =>
    cells.forEach((piece, col) => {
      if (!piece) return;
      assert.equal((row + col) % 2, 1, `piece on a light square at ${row},${col}`);
      if (piece.color === 'dark') dark++;
      else light++;
    }),
  );
  assert.equal(dark, 12);
  assert.equal(light, 12);
  assert.equal(state.turn, 'dark');
});

test('dark has 7 opening moves, all single steps', () => {
  const moves = legalMoves(initialState());
  assert.equal(moves.length, 7);
  assert.ok(moves.every((m) => m.capture === null));
});

test('a piece steps diagonally forward only', () => {
  const state = boardFrom([
    '........',
    '........',
    '........',
    '........',
    '...d....',
    '........',
    '........',
    '........',
  ]);
  assert.deepEqual(destinations(movesFrom(state, 4, 3)), [[3, 2], [3, 4]]);
});

test('light moves down the board', () => {
  const state = boardFrom(
    [
      '........',
      '........',
      '..l.....',
      '........',
      '........',
      '........',
      '........',
      '........',
    ],
    'light',
  );
  assert.deepEqual(destinations(movesFrom(state, 2, 2)), [[3, 1], [3, 3]]);
});

test('a piece on the edge has one direction', () => {
  const state = boardFrom([
    '........',
    '........',
    '........',
    '........',
    '........',
    'd.......',
    '........',
    '........',
  ]);
  assert.deepEqual(destinations(movesFrom(state, 5, 0)), [[4, 1]]);
});

test('a piece jumps an adjacent opponent onto an empty square', () => {
  const state = boardFrom([
    '........',
    '........',
    '........',
    '....l...',
    '...d....',
    '........',
    '........',
    '........',
  ]);
  const jump = movesFrom(state, 4, 3).find((m) => m.capture);
  assert.deepEqual(jump, { from: [4, 3], to: [2, 5], capture: [3, 4] });
});

test('a piece cannot jump its own color or onto an occupied square', () => {
  const state = boardFrom([
    '........',
    '........',
    '.....l..',
    '..d.l...',
    '...d....',
    '........',
    '........',
    '........',
  ]);
  assert.deepEqual(movesFrom(state, 4, 3), []);
});

test('applyMove moves the piece and passes the turn', () => {
  const state = initialState();
  const next = applyMove(state, { from: [5, 0], to: [4, 1] });
  assert.equal(pieceAt(next, 5, 0), null);
  assert.deepEqual(pieceAt(next, 4, 1), { color: 'dark' });
  assert.equal(next.turn, 'light');
  assert.deepEqual(pieceAt(state, 5, 0), { color: 'dark' }, 'the old state is unchanged');
});

test('applyMove removes a captured piece', () => {
  const state = boardFrom([
    '........',
    '........',
    '........',
    '....l...',
    '...d....',
    '........',
    '........',
    '........',
  ]);
  const next = applyMove(state, { from: [4, 3], to: [2, 5] });
  assert.equal(pieceAt(next, 3, 4), null);
  assert.deepEqual(pieceAt(next, 2, 5), { color: 'dark' });
});

test('applyMove rejects an illegal move', () => {
  assert.throws(() => applyMove(initialState(), { from: [5, 0], to: [3, 0] }), /illegal move/);
  assert.throws(() => applyMove(initialState(), { from: [2, 1], to: [3, 0] }), /illegal move/);
});
