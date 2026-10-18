---
satisfies: [R4, R5]
---
# fn-55-remove-kit-react-next-and-islands.5 CLI agent file relocation, playground and bench cleanup

## Description
Three dependents of kit/react: the CLI's agent-instructions command (copies a file bundled with kit), the playground app (React app on the React adapter) and the bench/showcase dependency lists.

**Size:** M
**Files:** packages/cli/src/initAgents.ts and tests, the agent-instructions markdown (moves from kit to the CLI package), packages/cli/package.json, packages/cli/src/__tests__/fixtures/kit-app (deleted or converted), apps/playground/**, apps/bench/package.json, apps/showcase/package.json
**Touches:** [packages/cli/**, apps/playground/**, apps/bench/package.json, apps/showcase/package.json, pnpm-lock.yaml]

### Approach
- Move the bundled agent-instructions file into the CLI package (shipped in its `files`), and make `initAgents` read it from there with the same idempotent behavior and exit codes; rewrite its content so it names only surviving packages (core, runtime, ui, router, start) and the project's vocabulary rules.
- Playground: compare what it demonstrates (tags vs implementations bundle split, modules) with the showcase; port anything the showcase lacks as a showcase page or test, then delete the app. Record the decision in the summary.
- Bench: keep React only as a benchmark comparison baseline if it measures against React; remove any dependency on removed packages. Check the showcase list.
- Check `git diff pnpm-lock.yaml` for stray `apps/sleek-codes` entries.

### Investigation targets
**Required**:
- `packages/cli/src/initAgents.ts`, `packages/cli/src/__tests__/` (init tests)
- `packages/kit/llms.md`, `packages/kit/src/__tests__/llms.test.ts`
- `apps/playground/README.md`, `src/api-example.tsx`, `src/__tests__/bundle.test.ts`
- `apps/bench/package.json`, `apps/showcase/package.json`
**Optional**:
- `packages/analyze/src/__tests__/llms.test.ts`

## Acceptance
- [ ] The agent-instructions command finds its file inside the CLI package, stays idempotent and keeps its exit codes; its text names no removed package
- [ ] Playground is ported or removed with the coverage decision recorded; nothing in apps depends on kit, react adapter, next or islands
- [ ] `pnpm turbo run test typecheck --filter=sleekstack --filter=showcase` is green

## Done summary
BLOCKED: TOOLING_FAILURE
Task: fn-55-remove-kit-react-next-and-islands.5
Summary: Implementation is committed and gates are green, but the Codex impl-review fan-out hung (no output after about 28 min). I killed this worktree's three `codex exec` processes. Every draw failed (nonzero_exit/timeout), and flowctl refunded the round as a transport failure.
Impact: Task .6 waits on this task's SHIP and `flowctl done`.
Suggested resolution: Re-run `/flow-next:impl-review fn-55-remove-kit-react-next-and-islands.5 --base master --review=codex` once Codex is healthy. On SHIP, run `flowctl done` with this evidence.

What was implemented (commit 4a2fa2f):
- Agent instructions now live in `packages/cli/llms.md` and ship through the CLI's `files`. `init-agents` resolves `node_modules/sleekstack/llms.md`, keeps the same idempotent marker handling, and exits 2 with "install sleekstack" when the file is missing. The new guide names only core, runtime, ui and router. Its error section is generated from ERROR_CODES.
- `packages/cli/src/__tests__/llms.test.ts` now reads the CLI's own llms.md. It also checks the size limit (under 8KB), that no removed package is named, and that `npm pack` lists the file (ported from kit's llms test). The init-agents tests now assert exit 2 on the missing file.
- The CLI's `@sleekstack/kit` devDependency was dropped. `packages/kit/llms.md` and kit's own llms test were left in place, so kit stays buildable until task .6 deletes the package.
- Playground removed. Coverage decision: it demonstrated the React adapter (LayerProvider, useService, the react STORES_KEY bundle test), plus a Tag/implementation bundle split and `module()`. The showcase architecture test already enforces the split, because only `layers` may import a module's `infrastructure`. `module()` is covered by core's tests. Nothing was ported.
- Bench and showcase package.json files already had no removed-package dependency, so they are unchanged. The lockfile only loses the playground and the CLI kit devDependency, with no apps/sleek-codes entries.
- Follow-up for task .6: the effect-app CLI fixture still imports `@sleekstack/next` (the analyzer's next/runtime read, as noted by .4).

baseline: green (turbo, pre-edit)
GATES: `pnpm turbo run test typecheck --filter=sleekstack --filter=showcase` green (9/9 tasks, sleekstack 26 tests, showcase 49 tests). Fixture graph check (effect-app) is identical before and after.
stage: impl-review - failed(codex fan-out transport failure: all 3 draws failed after ~28 min; round refunded)
Tier: opus at medium
## Evidence
- Commits: 4a2fa2fe74b44cd8554b418980aeda8cef2842ea
- Tests: pnpm turbo run test typecheck --filter=sleekstack --filter=showcase, AGENTS.md fixture graph check (effect-app): identical before/after
- PRs: