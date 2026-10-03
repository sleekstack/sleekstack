# Agent evals

Does shipping `@sleekstack/kit/llms.md` (plus the `sleekstack init-agents` block in AGENTS.md) help a coding agent? Manual runner, not CI: each run calls `claude -p` and costs money.

## Layout

- `fixture/`: a tiny kit app (`Data` module with `Clock` and `Db`) that passes `sleekstack check` and `tsc`.
- `tasks.json`: 11 tasks. `files` overwrite fixture files to plant a bug (the `fix-*` tasks); `match` / `forbid` are regexes per file that prove the task was done, not skipped.
- `run.mjs`: per task, condition and run: copies the fixture to a temp dir, links `@sleekstack/kit` from this repo, runs the agent there, judges, and deletes the dir.
- `results/`: one JSON per baseline (`<date>-<model>.json`).

## Conditions

- `with`: `@sleekstack/kit` includes `llms.md`, and `sleekstack init-agents` wrote the AGENTS.md block pointing at it.
- `without`: `llms.md` removed from the linked package; no AGENTS.md.

## Judge

A run passes when `sleekstack check` exits 0, `tsc -p tsconfig.json` exits 0, and every `match`/`forbid` pattern holds. A judge that cannot run (spawn error, timeout) reports `unjudged`, which is left out of the pass rate.

## Run

```sh
node evals/run.mjs --selfcheck                    # no agent: the base passes and every task starts failing
node evals/run.mjs                                # 1 run per task and condition, model sonnet
node evals/run.mjs --runs 3 --model opus --tasks fix-captive,add-module --conditions with
```

Tokens are input + output + cache read + cache creation from `claude -p --output-format json`.
