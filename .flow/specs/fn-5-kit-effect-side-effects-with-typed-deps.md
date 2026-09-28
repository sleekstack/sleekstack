# kit effect(): side effects with typed deps and useEffect-style cleanup

## Overview
Add `effect(fn, deps, opts?)` to `@sleekstack/kit`: a side effect (a job, a subscription, a warm-up) that runs when its scope opens and whose returned function runs when the scope closes, like `useEffect`. It is sugar over an anonymous Layer, with no core changes.

## Quick commands
```bash
pnpm --filter @sleekstack/kit typecheck && pnpm --filter @sleekstack/kit test
```

## Boundaries / non-goals
- No re-run on dependency change, and no React hook (React already has `useEffect`).
- No new core primitive: core builds every Layer in a scope when the scope opens.

## Decision context
- Rejected: requiring a dummy Tag per side effect (the status quo; too awkward).

## Acceptance Criteria
- **R1:** `effect(fn, deps?, opts?)` returns a value accepted in any provide set (a `module`'s `provide`, `configureRuntime`, `LayerProvider`, per-call `provide`). `fn(...deps)` runs once when the owning scope opens; deps are typed from the tuple as in `layer()`. `fn` may return nothing, a cleanup function, or a Promise of either; the cleanup runs when the scope closes. `opts` is `{ name?: string, lifetime?: 'app' | 'request' | 'component' }`. Errors: a throw or reject from `fn` surfaces as `SleekStackError` code `LayerFailed`, naming the effect; a cleanup throw reaches `onFinalizerError` with `tag` set to the effect name; graph rules (missing dependency, captive lifetime, privacy) apply to its deps.
- **R2:** An effect provides no user-visible Tag and exposes no Effect type (the dts test stays green). In the snapshot it appears as a node named `effect:<name>` (default `effect:<n>`). Errors: no error surface beyond R1.
- **R3:** The kit README documents `effect()`. Errors: n/a.
