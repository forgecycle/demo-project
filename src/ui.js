// Draws the board and turns clicks into engine calls. All rules live in
// engine.js; this file only keeps the current state and the selected square.

import { SIZE, initialState, isPlayable, pieceAt, legalMoves, applyMove } from './engine.js';

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');

let state = initialState();
let selected = null; // [row, col] of the piece the player picked, or null

function movesForSelected() {
  if (!selected) return [];
  return legalMoves(state).filter((m) => m.from[0] === selected[0] && m.from[1] === selected[1]);
}

function onSquareClick(row, col) {
  const move = movesForSelected().find((m) => m.to[0] === row && m.to[1] === col);
  if (move) {
    state = applyMove(state, move);
    selected = null;
  } else {
    const piece = pieceAt(state, row, col);
    selected = piece && piece.color === state.turn ? [row, col] : null;
  }
  render();
}

function render() {
  boardEl.replaceChildren();
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const square = document.createElement('button');
      square.className = `square ${isPlayable(row, col) ? 'playable' : 'plain'}`;
      square.dataset.row = row;
      square.dataset.col = col;
      square.disabled = !isPlayable(row, col);

      const piece = pieceAt(state, row, col);
      if (piece) {
        const pieceEl = document.createElement('span');
        pieceEl.className = `piece ${piece.color}`;
        square.append(pieceEl);
        square.setAttribute('aria-label', `${piece.color} piece, row ${row + 1}, column ${col + 1}`);
      } else {
        square.setAttribute('aria-label', `empty, row ${row + 1}, column ${col + 1}`);
      }
      if (selected && selected[0] === row && selected[1] === col) square.classList.add('selected');

      square.addEventListener('click', () => onSquareClick(row, col));
      boardEl.append(square);
    }
  }
  statusEl.textContent = `${state.turn === 'dark' ? 'Dark' : 'Light'} to move`;
}

render();
