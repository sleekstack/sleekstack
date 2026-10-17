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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
