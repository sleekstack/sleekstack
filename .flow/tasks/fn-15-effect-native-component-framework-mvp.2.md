---
satisfies: [R2, R3]
---
# fn-15-effect-native-component-framework-mvp.2 ui type tests: missing requirements and Catch narrowing

## Description
Pin the two typed guarantees with type tests (R2, R3). Separate from .1 so the runtime lands first and the type contract is checked against the real exports.

**Size:** S
**Files:** `packages/ui/src/__tests__/requirements.test-d.ts`, `packages/ui/src/__tests__/errors.test-d.ts`
**Touches:** [packages/ui/src/__tests__/*.test-d.ts, packages/ui/src/component.ts]

## Approach
- Follow `packages/kit/src/__tests__/errors.test-d.ts` (`expectTypeOf` from vitest, enforced by `tsc --noEmit` because `include: ["src"]` covers `__tests__`).
- R2: a component needing Tag `B` under `Provide(layerA, ...)` keeps `B` in `R`; passing it to `renderToString` (same `layer` typing as `mount`) with a layer providing only `A` is a `// @ts-expect-error`, paired with a positive twin that compiles when `B` is provided. A layer providing more than needed compiles.
- R3: `Catch('A', ...)` over `E = A | B` leaves exactly `B` (`toEqualTypeOf`); catching every tag leaves `never`; `Catch` of a tag not in `E` is a `@ts-expect-error`.
- `fromReact` returns `Component<P, never, never>` and is assignable to any `Component<P, E, R>` slot.
- If a test exposes a typing bug in `Provide`/`Catch`, fix it in `component.ts`.

## Investigation targets
**Required**:
- `packages/kit/src/__tests__/errors.test-d.ts` — type-test pattern
- `packages/ui/src/component.ts` — signatures under test (from .1)


## Acceptance
- [ ] Missing Tag at `renderToString` (the shared layer typing) fails to compile, with a compiling twin (R2).
- [ ] `Catch` removes only its tag; the unrelated tag stays (R3).
- [ ] Catch-all leaves `never`; catching an absent tag fails to compile.
- [ ] Every `@ts-expect-error` has a positive twin.
- [ ] `pnpm --filter @sleekstack/ui typecheck` passes.

## Done summary
Added type tests pinning R2 (missing Tag at renderToString fails to compile, with compiling twins, over-providing layer compiles, fromReact fits any slot) and R3 (Catch removes only its tag, catch-all leaves never, absent tag rejected). No typing bug found in component.ts.

stage: impl-review - ran (codex fan-out NEEDS_WORK P3 comment fix -> SHIP)
Tier: session (jev-unavailable(no_key))
## Evidence
- Commits: a20e4106f415318ad5c580129a428758fee66e52, 57f9f4f82e9f703c853da45d5c4e5ee32bba59dc
- Tests: pnpm --filter @sleekstack/ui typecheck, pnpm --filter @sleekstack/ui test
- PRs: