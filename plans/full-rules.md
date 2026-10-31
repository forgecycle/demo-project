# Full checkers rules: implementation plan

## Outcome and scope

Today the game is playable but incomplete. Pieces step or jump one square
diagonally forward, and that is all. This plan adds the rules that make it a
real game of checkers:

1. **Kings.** A piece that reaches the far row becomes a king. A king can
   also move and capture backward. The board shows kings differently from
   ordinary pieces.
2. **Multi-jump captures.** After a capture, if the same piece can capture
   again, it can go on jumping in the same turn. The turn passes when the
   chain ends. When a chain ends is one of the rule questions below.
3. **Capture rule.** Settle whether a player who can capture must capture,
   and enforce whatever is decided.
4. **End of game.** A player with no pieces left, or no legal move on their
   turn, loses. The page announces the winner and offers a "New game"
   button.

Out of scope: a computer opponent, undo, saving a game, online play,
timers, and any build step or dependency.

## Where things stand

- `src/engine.js` holds every rule as pure functions over a `{ board, turn }`
  state. `legalMoves(state)` lists the moves for the player to move;
  `applyMove(state, move)` returns the next state and passes the turn.
  A move is `{ from, to, capture }`, with `capture` the one jumped square or
  `null`.
- `src/ui.js` draws the board and turns clicks into engine calls. It holds
  no rules: it asks the engine which moves are legal.
- `tests/engine.test.js` covers the engine with Node's built-in test runner
  (`node --test tests/`). `tests/board.js` builds states from a picture of
  the board.
- The game runs by opening `index.html` as a file. The scripts are plain
  `<script>` tags: `engine.js` defines a `Checkers` global for `ui.js`, and
  `module.exports` for the tests.
- When a player has no legal move, the game currently just sits there with
  "Dark to move" showing.

## Rule questions to settle first

Checkers has many regional variants, and these choices change what the
engine does. Each must be decided before the work that depends on it:

- **Is capturing mandatory?** In American checkers, a player who can capture
  must. Casual games often leave it optional.
- **How far does a king move?** One square at a time, like an ordinary piece
  but in all four directions, or any distance along an empty diagonal
  ("flying kings", as in international draughts)?
- **Can a game be drawn?** For example by agreement, by repeating the same
  position, or after a number of moves with no capture. Or does every game
  end with a winner?
- **Can a player stop a multi-jump partway?** After a capture, when the same
  piece could capture again, must it keep jumping, or may the player end the
  turn there? This can be decided differently from whether the first capture
  is mandatory.
- **Does being crowned end a multi-jump?** When a piece reaches the far row
  during a chain, does the turn end there (as in American checkers), or does
  the new king keep jumping if it can?
- **How does the player play a multi-jump?** By clicking each landing square
  in turn, or does the chain finish by itself, and if so when?

## Constraints

- All rules stay in `src/engine.js`, as pure functions with no DOM access.
  The UI must not re-implement any rule.
- Every rule change comes with engine tests in `tests/engine.test.js`, using
  `boardFrom` for positions. Extend `boardFrom` (for example with `D` and
  `L` for kings) rather than building boards by hand.
- No dependencies, no package manager, and no build step.
  `node --test tests/` must keep passing, and the game must keep working
  when `index.html` is opened as a file, with no server.
- UI changes are checked by hand in a browser. Keep them small and describe
  in the handoff how to see each one.

## Done when

- A full game can be played from the opening position to a win, by the
  decided rules, in the browser.
- `node --test tests/` covers kinging, king movement, multi-jump chains
  (including stopping partway, if allowed, and a chain that crowns a piece),
  the decided capture rule, and every way a game can end.
- `README.md` describes the rules the game now plays by.
