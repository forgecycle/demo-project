---
name: forgecycle
description: Operate the ForgeCycle CLI to onboard an existing project, assess decomposed tasks, run a task, and diagnose and recover a stopped, blocked, failed, or interrupted run. Use for ForgeCycle orchestration requests, and for any nontrivial implementation task in a ForgeCycle-configured repository, so the work goes through ForgeCycle's plan -> implement -> review loop rather than being done directly. Not for ordinary edits to ForgeCycle's own source code.
---

# Operate ForgeCycle

ForgeCycle is a CLI that runs a loop between model roles: Planner plans, Builder implements, and Reviewer reviews; Decomposer splits plans too large for one run into a roadmap of tasks. The CLI owns each turn, the isolated Git worktree, and the immutable handoffs between turns. You, the calling agent, own getting the run to an end state: you pick commands, read the output, status, and handoffs, and when a run stops you diagnose it and either recover or escalate. Work from the target Git repository. Commands are grouped by level: `forgecycle task <command>` acts on one *task run* (one Planner–Builder–Reviewer execution of a task file, called "run" for short below), `forgecycle roadmap <command>` acts on a roadmap, and project commands such as `init`, `doctor`, and `prune` stay at the top level. The old flat names (`forgecycle run`, `forgecycle resume`, …) are unknown commands. Task commands take the task run ID that `task run` prints, never a task file or a roadmap task ID such as `FC02`. Use `forgecycle help task <command>` or `forgecycle help <command>` for current options and read `docs/configuration.md`, `docs/recovery.md`, or `docs/protocol.md` when the ForgeCycle source is available and the task needs more detail.

## Which binary to invoke

Projects can pin their own ForgeCycle version by putting the binary from a GitHub Release archive directly into the project root instead of relying on a shared copy on `PATH`; this lets different projects run different ForgeCycle versions side by side. Before running any command below:

- If an executable `forgecycle` exists at the target repository's root, invoke it as `./forgecycle <command>` — that project has pinned its own version. Do not shadow it with a PATH lookup.
- Otherwise, invoke the `forgecycle` found on `PATH`.

Every command in this skill written as `forgecycle ...` means "whichever binary the rule above selects" — substitute `./forgecycle` when the project has a local one.

`forgecycle init` (or `forgecycle init skill` alone) also installs this skill into the project (`.claude/skills/forgecycle/` and `.agents/skills/forgecycle/`), from the same version as the binary, so a project copy of this skill describes that project's `./forgecycle`. `forgecycle update` replaces the binary that runs it with a release (`./forgecycle update` updates the project's pinned one) and then refreshes the project's skill; after replacing the binary any other way, `init skill` brings the skill to the same version. Run `update` only when the user asks: it changes the version every later command runs, and it refuses (exit 21) while a process advances a run. It keeps a copy that differs, lists the differences, and exits 65 unless given `--force`. Do not edit an installed copy to change ForgeCycle's behavior; the next `init skill --force` replaces it.

## Your job: drive the run to an end state

A run you started is your responsibility until it reaches one of these:

- `done` (exit 0): report the result (see "After a run finishes").
- An approval gate (`awaiting_plan_approval`, `awaiting_final_approval`, or a checkpoint pause): present the plan or review to the user for their decision.
- A stop that needs a human decision: escalate with a diagnosis (see "Escalate").
- Your recovery budget is used up: escalate.

A non-zero exit is where your work starts, not where it ends. Never end your turn by relaying an exit code or an error line. Read the stop block, diagnose the stop, and then recover or escalate, as "When a run stops" below describes.

### Running long commands

`task run`, `task resume`, `task approve`, `task reject`, `roadmap decompose`, `roadmap run`, and `roadmap resume` call models and can take many minutes; a roadmap run can take hours, because it runs every task. Give the command the longest timeout your tool allows, or run it in the background and wait for it to finish. If your tool's timeout killed the command, the run did not stop by itself: run `forgecycle task status <task-run-id>`, or `forgecycle status` if you no longer have the task run ID (it lists every unfinished task run with its state, stop kind, and first next command). `Stop kind: interrupted` means no process is advancing it, so `forgecycle task resume <task-run-id>` continues it. An active state (`planning`, `building`, `reviewing`) with no `Stop kind` line means a process is still advancing it: wait for it instead of starting another.

If a killed command was a `roadmap run` or `roadmap resume`, `forgecycle status` lists the roadmap run too; `forgecycle roadmap resume <roadmap-run-id>` continues it, including an interrupted task run.

Before you start a task run (`task run`) or a roadmap run (`roadmap run`), ask the user whether to pass `--auto-resume`, and say what it does and that every automatic resume is a billed model call; for a roadmap run, add that the choice covers all its task runs and that a later `roadmap resume` cannot turn it off. Pass it only when they say yes. Do not ask again when the user already gave a standing answer this session ("always" or "never"): apply it and say so in one line. A task run does not store the flag, so pass the same answer on that run's later `task resume`; if that answer is not in the conversation (a new session, for example), ask again before resuming. A roadmap run stores it: `roadmap status` shows `Auto-resume: true` or `false`, and its task runs inherit it, so follow that setting for `roadmap resume` and for any `task resume` of its task runs instead of asking. With `--auto-resume` on `task run`, `task resume`, `roadmap run`, or `roadmap resume` (a roadmap run passes it to every task run), ForgeCycle resumes the stops marked in the Recover table by itself, at most once between two accepted handoffs. The output shows `forgecycle: info: auto-resume: <stop-kind> …` after the stop's block, and the command exits with the stop that remains.

## Do not shortcut the loop

When a repository is configured for ForgeCycle (`.forgecycle/config.json` exists or the user asks for ForgeCycle orchestration), route nontrivial implementation work through `forgecycle task run` (or `roadmap decompose` first, for work too large for one task run) instead of planning, editing, and reviewing the change directly in this session. Planning the change yourself, editing the files yourself, and then calling the diff done is not a substitute for a run — it skips the independent Reviewer review a run guarantees.

- Never mark implementation work finished on the strength of your own read of the diff when ForgeCycle is the intended path for it. Completion requires a Reviewer handoff (`00N-reviewer-review.md`) with verdict `done`, per "How a run works" below — not the calling agent's own judgment.
- Never treat `building` as the end state. If a run is sitting in `building` with no review handoff yet, the next action is to let the run proceed to review, not to declare the task complete. `forgecycle task status <task-run-id>` shows whether a process is still advancing it or it was interrupted (see "Running long commands").
- Small, explicitly-scoped exceptions (a one-line fix the user asked for directly, work on ForgeCycle's own source, or a task the user explicitly says to do outside ForgeCycle) may bypass the loop — but default to routing through ForgeCycle, and say so if you're deviating from it.

## How a run works

`forgecycle task run <task.md>` starts one Planner–Builder–Reviewer run:

1. Planner reads the immutable task snapshot and repository, then writes `001-planner-plan.md` (status `planned` or `needs_human`).
2. Under a non-autonomous approval policy the run pauses at `awaiting_plan_approval` for a human decision: `forgecycle task approve` continues to building, `forgecycle task reject <task-run-id> <feedback.md>` returns written direction to Planner.
3. Builder implements in an isolated worktree on a `forgecycle/task/<task-run-id>` branch and writes `002-builder-result.md` (`completed`, `partial`, or `blocked`), creating exactly one descendant commit.
4. Reviewer reviews the diff against every acceptance criterion, reruns all required tests, and writes `003-reviewer-review.md` with verdict `done`, `changes_requested`, `blocked`, or `needs_human`, plus stable findings (`F001`) that stay open until explicitly resolved. When the project sets `review.evidence_reuse_paths` and only matching files (for example docs) changed since the last review, Reviewer may carry over that review's passed results (`reused: true`) instead of rerunning them. When a required test's command is a configured `review.gates` command, ForgeCycle runs that gate itself before the review, outside agent tool timeouts and once per reviewed HEAD, and Reviewer reports its result instead of rerunning it. While a gate runs, `forgecycle: info: running gate …` names its log under `RUN_DIR/gates/<head>/`; a long silence there is the suite running, not a hang.
5. `changes_requested` returns to building (Builder result, then review again; handoffs number upward). Three consecutive reviews with an unchanged open finding set pause the run as a no-progress cycle needing human feedback. `done` may pause at `awaiting_final_approval` per policy before the run finishes.

Stored states: `planning → awaiting_plan_approval → building → reviewing → awaiting_final_approval → done`, with `paused`, `blocked`, `failed`, and `abandoned` as stops. Handoffs are immutable numbered Markdown under `.forgecycle/task-runs/<task-run-id>/`; never edit them or `state.json` to force progress. `done` requires every acceptance criterion satisfied, all findings resolved, independent test evidence, a clean worktree, and valid commits — Reviewer is the completion authority, not the calling agent.

## When a run stops: diagnose, then recover or escalate

Exit `0` is success, `20` blocked, `21` waiting or paused, `22` failed, `64` a usage error, and `65` invalid setup. The exit code alone does not tell you what to do next. Every stop prints a stop block after its info line:

```text
forgecycle: info: Run blocked: all candidates failed: builder: quota_exhausted (...)
forgecycle: stop: status=blocked kind=agent_failure detail=quota_exhausted exit=20
forgecycle: stop: resumes into building (turn 4); feedback is read by Builder
forgecycle: stop: inspect .forgecycle/task-runs/<task-run-id>/003-reviewer-review.md
forgecycle: stop: inspect .forgecycle/task-runs/<task-run-id>/events.log
forgecycle: next: forgecycle task resume <task-run-id> --builder <candidate-id>  # continue building with a candidate that is not on a quota cooldown (forgecycle doctor lists them)
forgecycle: next: forgecycle task resume <task-run-id>  # after the provider quota resets
```

`forgecycle task status <task-run-id>` prints the same report later (`Reason`, `Stop kind`, `Resumes into`, `Latest handoff`, `Unaccepted head`, `Events log`, `Evidence`, `Next`). `state.json` stores the classification as `stop_kind` and `stop_detail`; base decisions on those, not on the wording of `reason`. A line labeled `next (human decision)` is never yours to take alone.

### Diagnose

Before acting, work out why the run stopped:

1. Read the stop block, or `forgecycle task status <task-run-id>` if you no longer have it.
2. Read the latest handoff it names. A review's findings, a Builder's `blocked` explanation, or a plan's `needs_human` questions usually state the cause.
3. Read the end of `events.log`: `validation_field=` names a rejected handoff field, `outcome=` gives each candidate's failure category, and `quota_cooldown` lines show cooldowns.
4. For test or build failures, read the logs in the evidence directory the report names.
5. For provider, adapter, or configuration stops, run `forgecycle doctor`. It is free; `--ping` is billed and needs the user's authorization.

### Recover

| Stop kind (detail) | What to do | Without asking? | `--auto-resume`? |
|---|---|---|---|
| `interrupted` | `forgecycle task resume <task-run-id>`; add the next role's flag (`--planner`, `--builder`, or `--reviewer <candidate-id>`, as the `next:` line shows) if the killed turn was too slow | Yes | No |
| `agent_failure` (`quota_exhausted`, `rate_limited`) | `task resume <task-run-id>` with `--planner`, `--builder`, or `--reviewer <candidate-id>`, the role the `next:` line names, with another configured candidate that is not on a cooldown (`doctor` lists cooldowns), or `task resume` after the reset | Yes | No |
| `agent_failure` (`timeout`, `unavailable`, `invocation_error`, `protocol_error`, `mixed`, `unknown`, `interrupted`) | `doctor`, then `task resume`; if the same failure comes back, `task resume <task-run-id>` with `--planner`, `--builder`, or `--reviewer <candidate-id>`, the role the `next:` line names | Yes | Yes |
| `agent_failure` (`config_error`) | `doctor`, fix the policy or candidate in `.forgecycle/config.json`, then `task resume` | Only for an obvious wiring fix such as a misspelled candidate ID; otherwise ask | No |
| `agent_failure` (`authentication_error`) | Ask the user to log in to the provider CLI, or `task resume <task-run-id>` with `--planner`, `--builder`, or `--reviewer <candidate-id>`, the role the `next:` line names, with a candidate on another adapter | Switching candidates yes; logging in is the user's | No |
| `unaccepted_head` | `forgecycle task resume <task-run-id>`; Builder re-emits the handoff for the kept commit | Yes | Yes |
| `builder_invariant` | `task resume --feedback FILE` restating the rule from the reason (for example "make exactly one commit and leave the worktree clean"), or `task resume <task-run-id> --builder <candidate-id>` | Yes | No |
| `review_invariant` | `task resume` to rerun the review, or `task resume <task-run-id> --reviewer <candidate-id>` | Yes | Yes |
| `gate_failure` (`interrupted`) | `forgecycle task resume <task-run-id>`; the gate reruns and finished gates for the same HEAD are reused | Yes | Yes |
| `gate_failure` (`start_failed`, `worktree_mutated`) | Report the reason and the gate log; the gate configuration or worktree needs a human fix before `task resume` | No | No |
| `needs_human` or `technical_block` caused by a missing Git-ignored local file (for example `local.properties`) | Add it to `worktree.copy_ignored`, run `doctor`, then `task resume`; resume copies it into the worktree | Yes | No |
| `needs_human` whose question the task file or the user already answered | `task resume --feedback FILE` quoting that answer and where it comes from | Yes | No |
| `approval_gate` | Present the plan or final review; `task approve` or `task reject <task-run-id> FEEDBACK.md` only on the user's decision | No | No |
| `needs_human` (any other question) | Present the Planner's or Reviewer's questions in full, with their context, options and consequences, and your recommendation; pass the user's answer with `task resume --feedback`. On a roadmap run's task run that answer is also recorded as an `H` decision for its later task runs, so write it to stand on its own | No | No |
| `technical_block` | Report the blocking findings. If the cause is purely local setup you can fix without changing scope, fix it and `task resume`; otherwise ask | Only for local setup | No |
| `no_progress` | Report the repeated findings and recommend direction; the user decides between `task resume --feedback` and `task abandon` | No | No |
| `read_only_mutation`, `agent_failure` (`worktree_mutated`) | Report what changed (`git -C <worktree> status`); ForgeCycle never resets it, and neither should you without the user | No | No |
| `unknown` (no stop kind recorded, such as a hand-edited `state.json`) | Read `reason` and `resume_state` in `task status --json` and map them onto this table | Treat as needing the user | No |

The `--auto-resume`? column marks the stops ForgeCycle resumes by itself when the command ran with `--auto-resume` (see "Running long commands"). It does so at most once between two accepted handoffs, so a stop you see in that column has already had its plain resume when the block says `auto_resume=used`.

"Without asking" covers only operational steps that change neither scope nor product decisions. These steps make billed model calls, so they stay within the user's cost authorization and the recovery budget below. Feedback you write yourself may only restate the task, the stop reason, or something the user already said. It must never add requirements, relax acceptance criteria, or answer product questions.

`task resume` prints where it re-enters and who reads your feedback (`resuming into building (turn 4); feedback 003-human-feedback.md will be read by Builder`), so address feedback to that role. An interrupted run (its command was killed) resumes into `planning` if it was planning, and into `reviewing` otherwise, where Reviewer reconciles an interrupted Builder turn. To switch agents, name the role (ADR 0029, ADR 0030): `--planner ID`, `--builder ID`, or `--reviewer ID` replaces that role's candidates, on `task run`, `task resume`, `roadmap run`, and `roadmap resume`, for that invocation only. Use the role that acts next, as the `next:` line shows; a killed Builder turn resumes into reviewing, so it takes `--reviewer`. A run whose Builder committed but whose handoff failed validation keeps the commit as `unaccepted_head`. Resuming lets Builder re-emit the handoff without a filler commit, or add one follow-up commit if your feedback requires changes. A candidate on a quota cooldown is skipped until its reset; to retry it early, remove its entry from `.forgecycle/adapter-cooldowns.json`.

### A roadmap run stopped

A roadmap run stops when a task run stops and never resolves the stop itself. Its stop block comes after the task run's own block: `forgecycle: stop: roadmap_run=<roadmap-run-id> task=FC02 task_run=<task-run-id> kind=task_run_stopped detail=<the task run's stop kind> …` and `forgecycle: next: forgecycle roadmap resume <roadmap-run-id>`. Recover the task run exactly as the table above says for its stop kind, with `task` commands on the `<task-run-id>` the block names; the recovery budget applies to it as for any task run. When the task run is done (its done message then prints the `roadmap resume` line) or you `task abandon` it (the task restarts with a new task run on the same base), run `forgecycle roadmap resume <roadmap-run-id>`. `roadmap resume` on a task run that is still stopped only reprints both blocks.

The roadmap run's own stop kinds: `task_run_start_failed` (the child `task run` exited without creating a task run; fix the error it printed, then `roadmap resume`; operational) and `integration_blocked` (`checked_out`: the integration branch is checked out in a worktree; `moved`: something else moved it; `not_descendant`: the task run's head is not a fast-forward). `integration_blocked` needs the user. `forgecycle roadmap status <roadmap-run-id>` shows the tasks, task runs, attempts, and the stop. To skip a task that cannot succeed, which is the user's decision, see `forgecycle help roadmap abandon`.

### Recovery budget

Make at most **two** consecutive recovery attempts on your own, counting every `task resume` you start without new direction from the user. The count resets once the run makes progress, meaning it writes a new accepted handoff, or when the user gives new direction. Never repeat the same action for the same stop kind twice in a row: if a plain `task resume` ends in the same stop, switch the next role's candidate with `--planner`, `--builder`, or `--reviewer`, or escalate. A stop block containing `forgecycle: stop: auto_resume=used turn=<n>` (or `Auto-resume: used at turn <n>` in `task status`) means ForgeCycle already made the plain resume for you: count it toward your budget, and do not run a plain `task resume` for that stop; switch the next role's candidate or escalate. When the budget is spent, escalate even if the table says "Yes".

### Escalate

When a stop needs the user, or the budget is spent, report:

- the run ID, state, and stop kind (with detail);
- the reason and the cause you found, citing the handoff, `events.log`, or evidence file;
- what you already tried and how each attempt ended;
- your recommended next step, with the exact command and, if feedback is needed, a draft of it.

Never edit numbered handoffs or `state.json` to force progress.

### Stop and clean up

- `forgecycle task abandon <task-run-id>` stops a run and keeps its artifacts and branch. `forgecycle task clean <task-run-id>` removes only a clean worktree of a terminal run. Use them only when the user asks or it is actually necessary.
- `forgecycle prune` is irreversible: it deletes all task run artifacts and worktrees, including uncommitted changes in dirty worktrees. Run it only when the user explicitly asks to prune, and pass `--force` only when they have already confirmed what will be deleted, including its size; otherwise let the prompt reach them. Prefer `task clean <task-run-id>` for a single finished run.

## Commands

Project commands:

- `forgecycle status [--json]` — the project overview: which task run reserves the repository, and every task run that is not done or abandoned with its state, stop kind (`interrupted` included), and first next command. Read-only, no model call. Use it to find task run IDs.
- `forgecycle init [config|skill] [--check|--force]` — `init config` creates `.forgecycle/config.json` (`--check` validates it, `--force` backs it up and replaces it); `init skill [--force]` installs or updates this skill in the project; a bare `init` does both. Replacing a differing skill copy with `--force` loses local edits, so do it only when the user asks.
- `forgecycle doctor [--ping] [--ping-timeout SECONDS]` — check configuration (including every policy's `decomposer`, `planner`, `builder`, and `reviewer` lists) and adapter availability; no paid model call. `--ping` also sends one tiny read-only prompt to every candidate those lists use and fails (exit 65) for any that does not answer; each ping is a billed model call, so use it only with the user's authorization.
- `forgecycle prune [--worktrees] [--runs] [--force]` — delete every task run worktree and/or every stored task run (both when neither option is given). Shows the entry count and size of each directory and the total, then prompts `[y/N]` unless `--force`; refuses with exit 21 while a task run reserves the repository. Task run branches are kept.
- `forgecycle observe --summary [--workflow ID] [--json]` — per-candidate quality from the journal: first-pass valid handoffs, repairs, normalizations, quota cooldowns, mean duration.
- `forgecycle update [vX.Y.Z] [--check] [--force]` — replace this binary with the latest or a named release and refresh the project's skill. `--check` only reports. Only when the user asks.

Task commands, each acting on one task run:

- `forgecycle task run <task.md> [--policy NAME] [--base REF] [--approval POLICY] [--planner ID] [--builder ID] [--reviewer ID] [--auto-resume]` — start one run; approval policies are `autonomous`, `plan-and-final`, `every-turn`, or custom. `--planner`, `--builder`, and `--reviewer` each replace that role's candidate list with one configured candidate for this invocation only (not persisted in state); a read-only candidate cannot be `--builder`.
- `forgecycle task status <task-run-id> [--json]` — state, branch, and worktree; for a stopped or interrupted run also the reason, stop kind, resume target, files to inspect, and suggested next commands. `--json` prints the raw `state.json`.
- `forgecycle task approve <task-run-id>` / `forgecycle task reject <task-run-id> <feedback.md>` — decide an approval gate.
- `forgecycle task resume <task-run-id> [--feedback FILE] [--planner ID] [--builder ID] [--reviewer ID] [--auto-resume]` — continue a paused, blocked, failed, or interrupted run in the phase it records; an interrupted run re-enters planning if it was planning, and reviewing otherwise. `--planner`, `--builder`, and `--reviewer` work as on `task run`. `--auto-resume` (also on `task run`) resumes input-free stops by itself, at most once between two accepted handoffs.
- `forgecycle task abandon <task-run-id>` / `forgecycle task clean <task-run-id>` — stop a run / remove a terminal run's worktree.

Roadmap commands:

- `forgecycle roadmap decompose <plan.md> [--policy NAME] [--decomposer ID] [--output DIR]` — assess a large plan, write `roadmap.md`, `roadmap.json`, `decisions.md`, `source-plan.md`, and ordered task files. Does not implement anything. It uses the policy's required `decomposer` candidates, never `planner`; `--decomposer ID` replaces them for one invocation.
- `forgecycle roadmap questions <DIR|roadmap.json> [--policy NAME] [--decomposer ID]` — ask the `decomposer` candidates, read-only, to rewrite every decision marked `Unclear:` so it answers what was asked, and for decisions the roadmap's Planners and Reviewers would still stop for, appended to `decisions.md` as open decisions. Billed.
- `forgecycle roadmap run <DIR|roadmap.json> [--policy NAME] [--base REF] [--approval POLICY] [--planner ID] [--builder ID] [--reviewer ID] [--skip ID[,ID...]] [--auto-resume] [--accept-defaults]` — run every task in order as task runs on a ForgeCycle-owned integration branch; refuses to start while `decisions.md` has an open decision; stops at the first task run stop.
- `forgecycle roadmap status <roadmap-run-id> [--json]` — tasks, task runs and attempts, integration head, and the stop with its next command.
- `forgecycle roadmap resume <roadmap-run-id> [--planner ID] [--builder ID] [--reviewer ID] [--auto-resume]` — continue after the stopped task run is done or abandoned, or after a crash.
- `forgecycle roadmap abandon <roadmap-run-id>` — stop the roadmap run only; its integration branch and task runs are kept.

## Handoffs

Handoffs are produced by Planner, Builder, and Reviewer, not by the calling agent. ForgeCycle normalizes recognizable serialization defects (a preamble before `---`, a glued `---schema_version:`, a missing closing `---`, full-width key colons) and fills facts it owns (`run_id`, `turn`, `base_revision`, `head_revision`, required-test commands) before validating, then stores the canonical artifact. A stated value that is wrong is still rejected, and the single repair call usually fixes it within the same turn. `events.log` records each normalization (`detail=normalized(...)`) and the failing field of each rejection (`validation_field=...`). Each turn's manifest names an `EVIDENCE_DIR` under the run directory for logs and probes. Review-added tests must not run `/tmp` scripts, and projects can add their own command lint rules (`lint.command_rules`).

## Before a run

- Check that the target repository has at least one commit. `forgecycle init` creates `.forgecycle/config.json`, Git ignore entries, and the project copies of this skill even when development is already underway; edit the generated model placeholders and candidate policy before a real run. Use `forgecycle init config --check` when ForgeCycle is already configured in the project.
- Run `forgecycle doctor` after configuration changes. It checks setup and adapter availability without a paid model call (unless `--ping` is given), verifies that every `worktree.copy_ignored` file is Git-ignored and untracked, warns about `instructions` files that are not committed at HEAD, and lists candidates on a quota cooldown. A governing file that exists in the repository but not in the task run worktree is invisible to agents; `task run` and `task resume` warn about it.
- If builds need Git-ignored local files (for example `local.properties`), list them in `worktree.copy_ignored`; fresh worktrees otherwise lack them and Builder stops with `needs_human`. A real `task run` or `roadmap decompose` invokes configured model providers; follow the user's authorization and cost constraints.
- Write a self-contained Markdown task file with objective, boundaries, and acceptance criteria. Task YAML front matter may set `forgecycle.approval`, `base`, and `checkpoints`. The default approval and routing policy come from the project's effective config; do not assume a particular policy.
- Source-checkout uncommitted changes are not copied into the run worktree. A run uses the selected base revision and creates a `forgecycle/task/<task-run-id>` branch. If the task depends on current uncommitted work, first arrange for an appropriate committed base with the user's scope in mind.

## Choose the entry point

- For a task that fits one run: `forgecycle task run path/to/task.md [--policy NAME] [--base REF] [--approval POLICY]`.
- For a plan too large for one run: `forgecycle roadmap decompose path/to/plan.md [--policy NAME] [--output DIR]`. It warns about tasks above the acceptance-criteria budget (`decompose.max_acceptance_criteria`, default 6); split those before running them. The decomposition agent investigates relevant code and records repository-grounded technical context and component-level guidance in each task. Review the generated `roadmap.md` with the user. Decomposition does not implement the plan or replace the task Planner's exact planning against the selected base.
- Before a roadmap run, get every decision in the roadmap's `decisions.md` answered, so the run does not stop halfway to ask. Present each open decision to the user in full, as `decisions.md` states it (its context, what depends on it, every option with its consequences, and the recommendation with its reason), without shortening it to labels, and write the user's answers after its `Answer:` line; never answer one yourself. When the user does not understand a decision, write what they asked after its `Unclear:` line and run `roadmap questions`, which rewrites it to answer them; do not paraphrase an answer for them. After the answers, `forgecycle roadmap questions path/to/roadmap-dir`, within the user's cost authorization, finds decisions the answers or the task files still leave open; get those answered too. `roadmap run` exits 65 and lists the decisions that are unanswered or marked unclear while any remain; pass `--accept-defaults` only when the user explicitly accepts every recommended answer. The answers reach every task's Planner, Builder, and Reviewer as `ROADMAP_DECISIONS`.
- For a reviewed roadmap: `forgecycle roadmap run path/to/roadmap-dir [--policy NAME] [--base REF] [--approval POLICY] [--skip ID,...] [--auto-resume]`. It runs every task as an ordinary task run, strictly in `roadmap.json` order, each on a base that already contains the earlier tasks' accepted work, and fast-forwards its own branch `forgecycle/roadmap/<roadmap-run-id>` after each `done` verdict. Choose the approval policy with the user, because it decides how unattended the roadmap run is and so what it spends: `autonomous` pauses only at stops; `--approval custom` with `approval.checkpoints: ["final"]` in the config pauses once per task, before it finishes, so each task is reviewed before the next starts; `plan-and-final` pauses twice per task. There is no budget guard beyond that, `--auto-resume`'s progress rule, and the no-progress check. A preflight rejects (exit 65, naming the task) a task with invalid front matter or one that sets `forgecycle.base`, before anything is created. To run one task at a time instead, use `task run` on a base that already contains the task's prerequisites.
- Before either command, ask the user whether to pass `--auto-resume` (see "Running long commands").
- Keep the ID that `task run` (`Started run <task-run-id>`) or `roadmap run` (`Started roadmap run <roadmap-run-id>`) prints; `forgecycle status` lists them again. When the command returns, follow "When a run stops" for any non-zero exit.

## Tasks in an already-started project

`roadmap decompose` writes `roadmap.md`, `roadmap.json` (the machine-readable task order, files, prerequisites, and decisions document; read it instead of parsing the Markdown roadmap), `decisions.md` (the decisions a human answers before `roadmap run`), `source-plan.md`, and one standalone task file per stable ID, with objectives, repository-grounded context, component-level change guidance, acceptance criteria, and prerequisite IDs. Its investigation informs task boundaries but does not certify task status or automatically skip completed work. `task run` snapshots one selected task, and Planner re-investigates and Reviewer judges that task run against its exact base commit. With `task run`, dependency ordering in the roadmap is guidance and you must choose a base containing prerequisite work; `roadmap run` chooses every base itself, in `roadmap.json` order.

After `roadmap decompose`, assess *every* task before starting the next task run when the project already has relevant work. Pin the assessment to a named branch and exact commit (`git rev-parse HEAD`); distinguish committed code from uncommitted or unmerged work, which a new run will not see. Read the source plan, roadmap, and each task file. For each acceptance criterion, inspect the implementation and run relevant checks where practical. Record code, test, or documentation evidence and any unmet criteria; the existence of a feature or an old commit alone does not prove the current criterion is satisfied. Check that each prerequisite's outcome is present on the chosen base.

Write a reviewable `onboarding-assessment.md` beside the roadmap, naming the assessed branch and commit and listing each task ID, one assessment (`satisfied`, `partial`, `not_started`, or `uncertain`), criterion-level evidence or gaps, prerequisite status, and the next action. Get the roadmap's open decisions answered in `decisions.md` before treating an affected task as ready. This assessment is triage, not a ForgeCycle `done` result: Reviewer decides completion only inside a task run.

- For `satisfied` tasks, leave them out of the implementation queue if the current base already contains their outcomes: with `roadmap run`, pass their IDs to `--skip` (their dependents still run, on the roadmap run's base). If the user needs a ForgeCycle completion record for preexisting work, create a separate verification task preserving the original acceptance criteria, set `forgecycle.change_expected: false`, and run it against that base. A failed criterion then calls for a normal implementation task.
- For `partial` tasks, make the selected task describe the existing work and the missing outcome while retaining the full acceptance criteria. For `not_started` tasks, use the generated task as the starting point. Investigate `uncertain` tasks before deciding to skip or run them.
- Run a task only when its prerequisites are satisfied on the selected base or their ForgeCycle branches have been integrated there. Put the base revision, existing work, and prerequisite evidence into the selected task's context so its snapshot gives Planner and Reviewer the onboarding findings. Reassess remaining tasks if the base changes; an earlier assessment does not certify a later commit.

## After a run finishes

For a completed run, read `.forgecycle/task-runs/<task-run-id>/result.md`, report its branch and verification evidence, and leave integration into the source branch as a separate explicit action. For a completed roadmap run, read `.forgecycle/roadmap-runs/<roadmap-run-id>/result.md`, report the integration branch `forgecycle/roadmap/<roadmap-run-id>`, its head, each task's task runs and results, any skipped tasks, and whether the source branch advanced meanwhile. Merging it (`git merge --ff-only forgecycle/roadmap/<roadmap-run-id>`) is the user's decision; never do it yourself. Reviewer is the completion authority. Deployment, publication, remote mutation, and communication need explicit authority naming the action and target in the task or later human feedback.
