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

## Component pass (`@sleekstack/ui`)

```ts
import { analyzeComponents } from '@sleekstack/analyze'

const { trees, errors } = analyzeComponents({ project: 'tsconfig.json' })
```

It builds one tree per `mount` call (nodes `component`, `provide`, `catch`, `unresolved`) and walks it once, carrying provided Tags and caught errors downward. Every branch counts as rendered. It reports, with file:line:

- `MissingDependency`: a Component needs a Tag no `Provide` or mount layer supplies.
- `UnhandledError`: a tagged error reaches `mount` without a `Catch`.
- `EffectInsideReact`: a Component sits under a `fromReact` guest (in its JSX or passed through its props).
- `Unresolved`: a component or Layer it cannot read (`any`, a dynamically picked component, an unread declaration). It fails closed.

`sleekstack check` runs it only when the nearest package.json lists `@sleekstack/ui` (any dependency field) and adds a `components` key to `--json`; other projects are unchanged. [`apps/ui-demo`](../../apps/ui-demo) has one fixture per code.
