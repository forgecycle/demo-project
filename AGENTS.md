# Working in this repository

A small two-player checkers web app: static HTML, CSS, and JavaScript
modules, with no dependencies and no build step.

## Layout

- `src/engine.js`: every game rule, as pure functions over a `{ board, turn }`
  state. No DOM access, no globals, no mutation of the state it is given.
- `src/ui.js`: draws the board and turns clicks into engine calls. It holds
  no rules; it asks the engine what is legal.
- `src/style.css`, `index.html`: the page.
- `tests/engine.test.js`: engine tests for Node's built-in runner.
  `tests/board.js` builds a state from a picture of the board; use it for
  new positions.

## Rules for changes

- Run `npm test` before calling work done. It needs only Node 22 or later,
  and nothing to install.
- Every rule change gets engine tests in the same change.
- Keep the engine free of DOM code, and keep rules out of `src/ui.js`.
- Do not add dependencies, a bundler, or a framework.
- UI changes are checked by hand: serve the folder with
  `python3 -m http.server 8000`, open http://localhost:8000, and say in your
  handoff what to click to see the change.
- Update `README.md` in the same change when the rules or the controls
  change.
