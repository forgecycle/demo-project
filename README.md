# Checkers: a ForgeCycle demo project

A small two-player checkers game for the browser, and a ready-made demo of
[ForgeCycle](https://github.com/forgecycle/forgecycle). The game is
deliberately incomplete: [`plans/full-rules.md`](plans/full-rules.md) is the
next feature, waiting to be built by ForgeCycle's Decomposer, Planner,
Builder, and Reviewer.

## Play it

Open `index.html` in a browser. There is nothing to install, build, or
serve.

## How to play

Two players share one screen. Dark moves first. Click one of your pieces to
select it, then click the square to move it to. A piece moves one square
diagonally forward, or jumps an opponent's piece diagonally forward onto the
empty square behind it, removing that piece.

What is missing on purpose: kings, multi-jump captures, a capture rule, and
an end of the game. A player left without a move is simply stuck. That is
the feature plan.

## Run the tests

```bash
node --test tests/
```

The rules live in `src/engine.js` and are tested with Node's built-in test
runner (Node 22 or later; no npm, no packages). The page in `src/ui.js` only
draws the board and calls the engine.

## The ForgeCycle demo

ForgeCycle is configured in `.forgecycle/config.json` with real agent CLIs:
Codex, Claude Code, OpenCode, and Antigravity's `agy`. Every run below calls
paid models. Check the setup first:

```bash
forgecycle doctor
```

Use `./forgecycle` instead of `forgecycle` if a project-local binary sits in
the repository root.

### Demo 1: one task run

[`tasks/highlight-moves.md`](tasks/highlight-moves.md) is a small task that
fits one run: highlight where the selected piece can move. It pauses for your
approval after the plan and again before it finishes.

```bash
forgecycle task run tasks/highlight-moves.md --auto-resume
```

Watch Planner plan it, approve the plan, then watch Builder implement it and
Reviewer review it. The work lands on a `forgecycle/task/<task-run-id>`
branch. Merging it is up to you.

### Demo 2: a roadmap from a feature plan

[`plans/full-rules.md`](plans/full-rules.md) is too large for one run. First
let the Decomposer split it into ordered tasks and list the decisions only a
person can make:

```bash
forgecycle roadmap decompose plans/full-rules.md
```

The plan leaves the rule variants open on purpose (is capturing mandatory,
how far kings move, whether games can be drawn, whether a multi-jump can
stop partway or ends when a piece is crowned, how a multi-jump is played),
so `decisions.md` has real questions to answer. Answer each one after its
`Answer:` line, then run the whole roadmap unattended:

```bash
forgecycle roadmap run tasks/<generated-dir> --auto-resume
```

Each task runs as its own task run on a base that contains the earlier
tasks' work. When the last one is done, review and merge one branch:

```bash
git merge --ff-only forgecycle/roadmap/<roadmap-run-id>
```

`forgecycle serve --open` shows every run as it happens.
