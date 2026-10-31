---
forgecycle:
  approval: plan-and-final
  change_expected: true
---

# Highlight where the selected piece can move

When the player selects one of their pieces, mark every square that piece
can legally move to, so the player can see their options before clicking.

Today `src/ui.js` outlines the selected square, but nothing shows where the
piece can go. The player has to guess, and a click on a wrong square just
clears the selection.

## Boundaries

- Take the destinations from the engine's existing `movesFrom` or
  `legalMoves`. Do not add rules to `src/ui.js`.
- Mark a capture's destination differently from a plain step, so a player
  can tell the two apart.
- No dependencies, no package manager, and no build step.

## Acceptance criteria

1. Selecting a piece marks each of its legal destination squares, and only
   those.
2. A destination reached by a capture looks different from one reached by a
   plain step.
3. The marks disappear when the piece moves, when the selection is cleared,
   and when another piece is selected.
4. A piece with no legal moves can still be selected and shows no marks.
5. `node --test tests/` passes. If you add an engine helper for this, it has
   tests.
6. The game still works when `index.html` is opened as a file, with no
   server.
7. `README.md` mentions the highlighting under "How to play".
