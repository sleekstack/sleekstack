# @sleekstack/analyze

The static dependency-graph analyzer behind [`sleekstack check`](../cli). It reads a tsconfig project's kit and core declarations through the TypeScript checker and returns the graph and every violation with file:line. It never imports or runs app code (ADR 0010, ADR 0011).

```ts
import { analyze } from '@sleekstack/analyze'

const report = analyze({ project: 'tsconfig.json', entries: ['src/runtime.ts'], lenient: false })
```

- `project`: path to a `tsconfig.json`.
- `entries`: limit the roots to the `configureRuntime` / `runEffect` calls in these files (otherwise every call outside test files).
- `lenient`: turn an unresolvable `runEffect` Layer into an opaque root instead of an error.

Roots are `configureRuntime` layers plus `runEffect` `request` and `overrides` Layers; each is checked as its own graph. A `Report` lists the roots' nodes, modules and `AnalyzeError`s (`code`, `message`, `file`, `line`).

## What it checks

`MissingDependency`, `DependencyCycle`, `CaptiveDependency` (lifetime matrix), `PrivateDependency` (module `exports`), `AmbiguousProvider`, `ModuleCycle`, `DuplicateModule`, and action bodies' yielded Tags. For `declareLayer` and plain Layers, provided and required Tags are read from the Layer type (`ROut`, `RIn`); kit `layer()` deps come from its array or generator `yield*`s.

It fails closed: a declaration it cannot read (`any`, a widened array, a non-literal key) is an error, with no opt-out. `typescript` is a peer dependency.
