---
satisfies: [R1, R4]
---
# fn-15-effect-native-component-framework-mvp.1 ui package: Component, Provide, Catch, fromReact, string renderer and mount

## Description
Create `@sleekstack/ui` with the `Node` tree, the five host primitives and the string renderer, and render the `UserCard` example to exact markup (R1). The guest half of R4 (a `fromReact` component rendered through `react-dom/server` with its props) lands here; the Analyzer half is task .4. This is the early proof point.

**Size:** M
**Files:** `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/vitest.config.ts`, `packages/ui/src/index.ts`, `packages/ui/src/node.ts`, `packages/ui/src/component.ts`, `packages/ui/src/string.ts`, `packages/ui/src/__tests__/fixtures/user-card.ts`, `packages/ui/src/__tests__/string.test.ts`, `packages/ui/README.md`
**Touches:** [packages/ui/**, pnpm-lock.yaml]

## Approach
- Scaffold by copying `packages/runtime/package.json` and `tsconfig.json` (private, source-exported, `tsc --noEmit`); take the React devDeps and peer from `packages/react/package.json` (`react`/`react-dom` ^19.2.6, `@types/react*`). `react`/`react-dom` are peers so guests share the app's React. Depend on `effect` only; `@sleekstack/core` only if actually used. Run `pnpm install` to register the workspace package.
- `Node`: text, element (tag, attributes, children), fragment, guest (component + props). No events, keys or refs in the MVP.
- `Provide`, `Catch`, `fromReact` exactly per spec API Contracts. `Catch` uses `Effect.catchTag`; `Provide` uses `Effect.provide` so the types fall out of Effect's own.
- Implement every signature in spec API Contracts exactly, including `el`, `fragment` and `renderToString`. `mount` (DOM) is task .3; do not export a placeholder.
- `renderToString`: build the layer, run the tree to a `Node` with `runPromiseExit`, then serialize. Escape text and attribute values (`& < > " '`); attributes keep insertion order. Guests serialize through `react-dom/server` `renderToString`.
- Error contract per spec API Contracts: `E`/`LE` failures reject with the original error from the `Exit`'s `Cause`; defects reject with the defect; a throwing guest renders as nothing, the rest renders, cause to `onError` or `console.error`. Put the run-and-unwrap step in one shared helper task .3 reuses.
- Write the canonical `UserCard` from spec API Contracts in the test fixtures and assert both expected markups verbatim.

## Investigation targets
**Required** (read before coding):
- `packages/runtime/package.json`, `packages/runtime/tsconfig.json` — package shape to copy
- `packages/react/package.json`, `packages/react/vitest.config.ts` — React deps and test env
- `tsconfig.base.json` — strict, `jsx: react-jsx`, Bundler resolution

**Optional**:
- `packages/runtime/README.md` — README table style

## Key context
- Untracked compiled `*.js`/`*.d.ts` siblings exist in other packages; keep `noEmit` so this package never emits beside sources.
- `renderToString` from react-dom is sync and ignores Suspense; guests must be leaves.


## Acceptance
- [ ] `app("1")` and `app("2")` render exactly the spec's two expected markups through `renderToString` (R1).
- [ ] Uncaught `UserCard({ id: "2" })` rejects with the original `UserNotFound` instance, not a `FiberFailure` (R1).
- [ ] A failing layer (`Layer<A, LE, never>`) rejects with its `LE`; a defect rejects with the defect.
- [ ] A `fromReact` guest receives its props and its react-dom/server markup appears inline (R4).
- [ ] Text and attribute values containing `<script>` and quotes are escaped.
- [ ] A throwing guest renders as nothing, its siblings render, the cause reaches `onError` (or `console.error` when absent), and the promise resolves.
- [ ] `pnpm --filter @sleekstack/ui test` and `typecheck` pass.

## Done summary
Added `@sleekstack/ui` with the `Node` tree (`el`, `fragment`), `Provide`, `Catch`, `fromReact` and `renderToString`; the UserCard example renders the spec's exact markups, failures reject with the original error or defect via the shared `runToNode` helper (for task .3), throwing guests render as nothing and report to `onError`/`console.error`. Codex review added a guarded `onError` sink and tag/attribute name validation at serialization. Tests: packages/ui/src/__tests__/string.test.ts.

stage: impl-review - ran (codex, 3 rounds: NEEDS_WORK, NEEDS_WORK, SHIP)
Tier: session (jev-unavailable(no_key))
## Evidence
- Commits: 52638a8e6bb8f7d1e52a26121f042a8453df0d9e, 109d88f204f785305fd83bf263cd05cfdbc8656f, 4bf5afcd5a7dbc93dd5db65943879eef960f20f3
- Tests: pnpm --filter @sleekstack/ui test && pnpm --filter @sleekstack/ui typecheck, pnpm --filter @sleekstack/analyze test && pnpm --filter sleekstack test
- PRs: