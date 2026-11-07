# Working in this repository

A small two-player checkers web app: one HTML page with plain CSS and
JavaScript, with no dependencies, no build step, and no package manager.
The game runs by opening `index.html` as a file, so the scripts are plain
`<script>` tags, not ES modules (browsers block modules on `file://`).

## Layout

- `src/engine.js`: every game rule, as pure functions over a `{ board, turn }`
  state. No DOM access, no mutation of the state it is given. It defines the
  `Checkers` global in the browser and `module.exports` in Node; add new
  functions to its `api` object.
- `src/ui.js`: draws the board and turns clicks into engine calls. It holds
  no rules; it asks the engine what is legal.
- `src/style.css`, `index.html`: the page. `index.html` loads `engine.js`
  before `ui.js`.
- `tests/engine.test.js`: engine tests for Node's built-in runner, written
  with `require()`. `tests/board.js` builds a state from a picture of the
  board; use it for new positions.

## ForgeCycle setup

- `./initialize-project.sh` asks whether to use Codex or Claude Code, copies
  `.forgecycle/config.codex.json` or `.forgecycle/config.claude.json` to
  `.forgecycle/config.json`, and downloads the `forgecycle` binary into the
  repository root. `config.json` and `forgecycle` are Git-ignored.
- Change shared ForgeCycle settings in `config.codex.json` and
  `config.claude.json` (keep them in step), never only in `config.json`.
- `./reset.sh` clears ForgeCycle's runs, worktrees, and branches so the demo
  can be tested again.

## Rules for changes

- Run `node --test tests/` before calling work done. It needs only Node 22
  or later, and nothing to install.
- Every rule change gets engine tests in the same change.
- Keep the engine free of DOM code, and keep rules out of `src/ui.js`.
- Do not add dependencies, a `package.json`, a bundler, a framework, or ES
  module syntax (`import`/`export`, `type="module"`).
- UI changes are checked by hand: open `index.html` in a browser and say in
  your handoff what to click to see the change.
- Update `README.md` in the same change when the rules or the controls
  change.
