# Runtime package, request-aware graph, richer devtools

## Goal & Context
<!-- scope: business -->

fn-11 made `@sleekstack/next` a plain-Layer runtime manager with kit owning the module system, but an Opus 5.5 design review (2026-10-01) left three things open: the runtime is generic yet lives in a package named "next"; the analyzer sees only the `configureRuntime` root, so `request`/`overrides` Layers passed to `runEffect` are invisible in the graph; and devtools data is thin (hand-placed `record()` calls, `app` the only acquire/release, panel cannot see real atom stores).

Depends on fn-11 (merged). Unblocks the RR7 and TanStack Start adapters, which should reuse the runtime without depending on Next.

## Architecture & Data Models
<!-- scope: technical -->

- **Runtime package**: move `configureRuntime`/`runEffect`/`getRuntime`, the error sink contract and the event buffer into a framework-agnostic package (working name `@sleekstack/runtime`) with a pluggable `isControlFlow` classifier. `@sleekstack/next` becomes a thin preset: Next's digest classifier, the devtools route handler, re-exports. Kit imports the runtime package. The versioned `globalThis` slot key stays, so old and new copies of a module do not split state.
- **Analyzer roots**: treat each `runEffect({ request, overrides })` call site as a root whose requirements are checked against the app root's provides plus the layer's own, instead of a standalone graph. The graph Report gains per-root `kind: 'app' | 'request' | 'overrides'`. Unresolvable layers stay fail-closed by default; add an opt-in `--lenient` that downgrades them to an opaque node with file:line (decision to be confirmed in task 1: a build error must never silently become an empty graph).
- **Devtools data**: replace hand-placed `record()` calls with Effect's Tracer/Supervisor so per-service acquire/release, fiber id and the owning request scope are captured; errors link to their scope. Keep polling (SSE adds little at dev volume). Expose atom stores for inspection through a read-only registry in `@sleekstack/react` that `LayerProvider` registers into in dev; the panel lists every registered store, not only atoms passed as props.
- **Decision Context**: keep `@sleekstack/devtools` a separate package (production exclusion still rests on the caller's dead-branch import and the bundle test); revisit folding it into `@sleekstack/react/devtools` only if publishing cost bites.

## API Contracts
<!-- scope: technical -->

- New package re-exports what `@sleekstack/next` exports today; `@sleekstack/next` keeps the same public names (re-exports) so fn-11 users do not break.
- `registerAtomStore` (dev-only, `@internal`) in `@sleekstack/react`; no production export condition.
- Report schema: additive `kind` field.

## Edge Cases & Constraints
<!-- scope: technical -->

- Two module copies (RSC vs action bundle) must still share one runtime across old and new package layouts.
- Tracer/Supervisor hooks must add no work when `NODE_ENV` is production (guarded at the layer that installs them).
- Request-root analysis must not report an app singleton as missing just because the request layer requires it.
- Not in scope: SSR/hydration of atoms, the RR7 and TanStack adapters themselves, a codemod.

## Acceptance Criteria
<!-- scope: business -->

- **R1:** The runtime lives in a framework-agnostic package; `@sleekstack/next` and kit pass their existing tests importing from it; a non-Next classifier can be supplied. Errors: control flow classified by the supplied function, never by Next digests, outside the Next preset.
- **R2:** The analyzer reports `runEffect({ request, overrides })` layers as request/overrides roots with edges into the app graph; the showcase's `RequestLive` and `DemoLive` appear on `/graph`. Errors: a request layer requiring a Tag nobody provides fails with file:line; an unresolvable layer still fails closed unless `--lenient` is set.
- **R3:** The devtools panel shows per-service acquire/release and links each error to its request scope. Errors: with the handler off or tracing disabled the panel renders an empty state; production builds record nothing.
- **R4:** The panel lists atoms from every `LayerProvider` store in dev, including component-scope atoms such as the showcase's draft editor. Errors: a store disposed mid-poll disappears without throwing; production bundles contain no registry code (bundle test).
- **R5:** Docs, ADR 0013 (supersedes the package-boundary part of ADR 0012) and CONTEXT.md describe the new boundary. No error surface beyond stale references.

## Early proof point
Task 1 (move the runtime, keep every consumer green) validates that nothing depended on the runtime living in `@sleekstack/next`. If kit or the showcase need Next-only hooks, re-evaluate the preset split before the analyzer and devtools work.

## Quick commands
```bash
pnpm typecheck && pnpm test
pnpm --filter showcase build && pnpm --filter showcase test
```

## Boundaries
<!-- scope: business -->

Not doing: new sugar in next or react; atom SSR; other framework adapters; a codemod.
