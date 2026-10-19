---
satisfies: [R3, R7]
---
# fn-55-remove-kit-react-next-and-islands.4 analyzer: drop kit graph extraction

## Description
The analyzer reads kit's `tag`, `layer`, `effect`, `module`, `atom`, `defineEffect` / `defineQuery` / `runOperation`, `cachedQuery` and `mutation`. With kit gone it reads core modules, plain Layers, runtime roots and ui trees only.

**Size:** M
**Files:** packages/analyze/src/extract.ts, model.ts, index.ts, errorCodes.ts, components.ts if it names kit; packages/analyze/src/__tests__/ fixtures and tests that import kit (kit-app, actions, actions-roots and any other kit user); error-code docs
**Touches:** [packages/analyze/**]

### Approach
- First save the fixture graph check output and every non-kit analyzer fixture result; they are the equivalence pin and must be identical after.
- Remove the `kit/*` call tables and the kit/next action roots; keep the core `makeModule`, plain-Layer and runtime (`configureRuntime`, `runEffect`) paths. Where a kit-only concept has a core equivalent (atoms), keep reading the core one.
- Delete fixtures that exist only for kit; convert a fixture that exercises shared behavior to core or plain Layers instead of deleting its coverage.
- A code only the kit path raised is removed with its table row (closed `AnalyzeCode` rule); regenerate any docs derived from the codes.
- The server-operation roots (`defineEffect`, `defineQuery`) disappear until `@sleekstack/start` adds its own function roots; note this in the summary.

### Investigation targets
**Required**:
- `packages/analyze/src/extract.ts` (call tables near the top, `layer`/`effect` branches, atom family)
- `packages/analyze/src/model.ts`, `errorCodes.ts`, `index.ts`
- `packages/analyze/src/__tests__/fixtures.test.ts` and the fixtures importing kit
- AGENTS.md fixture graph check
**Optional**:
- `docs/adr/0011-static-build-time-dependency-graph.md`

## Acceptance
- [ ] No analyzer source or fixture imports or names kit; kit-only fixtures and codes are gone
- [ ] Every non-kit fixture's analyzer result is identical before and after (saved and diffed)
- [ ] The fixture graph check from AGENTS.md is updated to the remaining fixtures, and its output matches before/after for them
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack` is green

## Done summary
The analyzer now reads only core modules, plain Layers, runtime roots, ui trees and core atoms. The kit tag, layer, effect, module and atom tables are gone, and so are the kit/next action roots and the kit query/mutation fetchers. The kit-only codes `UnownedAction` and `UnnamedEffect` were removed, along with their table rows, their docs rows and the regenerated llms.md error section. Kit-only fixtures were deleted (kit-app, actions, actions-roots, queries, generator-layers, the `kit.ts` halves of the graph-error fixtures). Fixtures that covered shared behavior were converted to core: computed-lists, errors, module-cycle/root, plain-layers, plain-layers-generic, and the ported privacy cases.

- Equivalence pin: I dumped every non-kit analyzer fixture (`analyze`, lenient, components) at the base and at HEAD; all 23 are byte-identical. The AGENTS.md fixture graph check now covers only effect-app, and its output matches before and after.
- Atoms: there is a new core reader. `Atom.make` over an Effect, a Stream, or a Tag (also inside `Atom.family`) is an `atoms` node, with an edge for each Tag in its `R`. The kit deps-array reader was not ported.
- Server-operation roots (`defineEffect` / `defineQuery`) are gone until `@sleekstack/start` adds its own function roots.
- Edits outside the declared Touches:
  - CLI check fixtures (entry, multi, lenient, none) were converted to core and to runtime's `configureRuntime({ layer })`; without that the required `--filter=sleekstack` gate fails.
  - The CLI kit-app fixture and its test were deleted.
  - The llms.md error-section check moved from packages/analyze to `packages/cli/src/__tests__/llms.test.ts`. It still reads `packages/kit/llms.md`; task .5 should point it at the file's new home.
  - The `packages/kit/llms.md` generated section was regenerated.
  - AGENTS.md fixture check line.
  - `apps/docs/content/docs/errors.mdx` rows.
- Follow-ups:
  - The analyzer still reads `next/runtime#configureRuntime` / `runEffect` (task .6 removes next).
  - errors.mdx lines 6/12 and the kit llms test comment still describe kit (task .7 / .6).

baseline: green (task verify, turbo cache)
stage: impl-review - ran (codex: first fan-out NEEDS_WORK, finalize refused after fixes were committed early and the round was refunded; second fan-out NEEDS_WORK (2 findings, fixed); re-review SHIP)
## Evidence
- Commits: b85fb3d2ee4a046a265c5cbede7ec5d99bb449ec, 31562d4128e98428414320646140370ac0761e85, 74de1a9afa9953e8800bf5c41caea844c998ece5
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack, pnpm turbo run test typecheck --filter=@sleekstack/runtime... --filter=@sleekstack/devtools... --filter=@sleekstack/analyze --filter=sleekstack --filter=showcase --filter=docs, fixture graph check (effect-app) identical before/after; 23 non-kit analyzer fixtures identical before/after
- PRs: