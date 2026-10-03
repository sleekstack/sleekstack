## Goal & Context
<!-- scope: business -->

Explore an Effect-native component framework: the Effect program is the host, and plain React components run inside it as guests. An Effect component can never be rendered inside a React component. The wedge is two features no React framework has: typed requirements and typed errors per component, checked at build time by the Analyzer.

This is an MVP spike to answer one question: does a host-first model with React guests deliver those two features with a small enough runtime to be worth building out? It is not a React replacement and makes no promise of full React compatibility.

The sketches and a working string-rendering MVP (`Component<P, E, R>`, `fromReact`, `mount`) already exist; this spec turns them into a package, an Analyzer pass and one demo.

## Architecture & Data Models
<!-- scope: technical -->

- **Package** `@sleekstack/ui` (working name, open decision). Depends on `effect`, `react` (guest rendering only) and `@sleekstack/core` for Layers and Scopes.
- **Component** = `(props: P) => Effect<Node, E, R>`. `R` is the Tags it needs; `E` is its tagged errors. `Node` is a small renderable tree (text, element, fragment, guest).
- **Host primitives:** `mount(app, { layer, onError })`, `Provide(layer, children)`, `Catch(tag, fallback, children)`, `fromReact(Cmp)`.
- **Guest rule:** `fromReact` returns `Component<P, never, never>`. React renders the guest with its own `react-dom`; the guest receives no Effect context and its subtree is opaque. An Effect component found under a guest is a build-time error.
- **Renderers:** a string renderer (SSR and tests) first, then a minimal DOM renderer. Fine-grained updates through atoms are out of scope for the MVP.
- **Analyzer pass** in `@sleekstack/analyze`, reusing the existing Layer type reader and fail-closed rule. It builds a tree per `mount` call: nodes `component`, `provide`, `catch` and `unresolved`. The check walks it once, carrying the provided Tags and caught errors downward, and reports `MissingDependency`, `UnhandledError`, `EffectInsideReact` and `Unresolved` with file:line. Data model and check are in the sketch `component-graph-model.ts`.

## API Contracts
<!-- scope: technical -->

```ts
type Component<P, E, R> = (props: P) => Effect.Effect<Node, E, R>

type Node = TextNode | ElementNode | FragmentNode | GuestNode
el(tag: string, attrs?: Record<string, string>, ...children: Array<Node | string>): Node
fragment(...children: Array<Node | string>): Node

renderToString<E, A, LE = never>(app: Effect<Node, E, A>, opts: { layer: Layer<A, LE, never>; onError?: (cause: Cause<unknown>) => void }): Promise<string>
mount<E, A, LE = never>(app: Effect<Node, E, A>, opts: { layer: Layer<A, LE, never>; container: Element; onError?: (cause: Cause<unknown>) => void }): Promise<Mounted>
interface Mounted { dispose(): Promise<void> }
Provide<A, LE, RL, E, R2>(layer: Layer<A, LE, RL>, children: Effect<Node, E, R2>): Effect<Node, E | LE, RL | Exclude<R2, A>>
Catch<E extends { readonly _tag: string }, R, K extends E["_tag"]>(tag: K, fallback: (e: Extract<E, { _tag: K }>) => Node, children: Effect<Node, E, R>): Effect<Node, Exclude<E, { _tag: K }>, R>
fromReact<P extends object>(Cmp: React.ComponentType<P>): Component<P, never, never>
```

- The mount layer must be fully satisfied (`RIn = never`); a layer that needs more is composed with `Layer.provide` before `mount`. `Catch` over `E = never` is uncallable by design.
- `renderToString` is the string renderer (SSR and tests); `mount` is the DOM renderer and resolves once the tree, including every guest root, is committed into `container` (guest roots render synchronously, so the DOM is complete when the promise resolves, with or without `act`). `dispose()` empties the container and unmounts the guest roots of its own mount only; see the re-mount rule.
- Rejection: a failure in `E` or in the layer (`LE`) rejects `renderToString`/`mount` with the original error taken from the `Exit`'s `Cause` (never a `FiberFailure`); a defect rejects with the defect. `onError`, when given, also receives the cause.
- Renderer failures (a throwing guest, a DOM error) never reject or throw: the failed guest renders as nothing, the rest of the tree renders, and the cause goes to `onError` or, when absent, to `console.error`.
- Re-mount: a later `mount` on the same container wins. An earlier in-flight `mount` that finishes after it must not touch the container or create guest roots. Each `Mounted` handle is bound to its own generation: disposing a superseded handle (including the eventual handle of a superseded in-flight mount) is a no-op for the container and for newer roots.

**Canonical `UserCard` example** (the sketch is not in the repo; this replaces it):

- Tag `UserRepo` with `get(id: string): Effect<{ name: string }, UserNotFound>`; `UserNotFound` is a `Data.TaggedError`. The test layer returns `{ name: "Ada" }` for id `"1"` and fails `UserNotFound` otherwise.
- `Avatar = fromReact(({ name }: { name: string }) => <span className="avatar">{name}</span>)`. (A plain `span`, not an `img`: React 19 adds a resource-hint `<link rel="preload">` for images, which would make the markup depend on the React version.)
- `UserCard({ id })` yields `UserRepo.get(id)`, then yields the guest (`const avatar = yield* Avatar({ name })`, because `Avatar(...)` is an Effect and `el` accepts only `Node | string`) and returns `el("div", { class: "card" }, el("h2", {}, name), avatar)`.
- `app(id) = Catch("UserNotFound", () => el("p", {}, "Not found"), UserCard({ id }))`.
- Expected markup: `app("1")` renders `<div class="card"><h2>Ada</h2><span class="avatar">Ada</span></div>`; `app("2")` renders `<p>Not found</p>`. `UserCard({ id: "2" })` without `Catch` rejects with the `UserNotFound` instance.

## Edge Cases & Constraints
<!-- scope: technical -->

- Conditional and list rendering: the Analyzer treats every branch as possibly rendered (conservative, may over-report).
- Dynamic components (`const C = pick(); <C />`), `any` types and widened arrays fail closed with `Unresolved`; there is no opt-out.
- A guest that calls React `useContext` needs a React provider; that is React's side and unchecked.
- No Next.js or React Server Components support in the MVP. A host-first runtime cannot be aliased into React's flight protocol.
- Out of scope: lifetimes and Scopes per component, interruption, time-slicing, fine-grained reactivity, devtools.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `Component`, `mount`, `Provide`, `Catch` and `fromReact` exist and render the sketch's `UserCard` example to the exact expected markup. Errors: an uncaught `E` rejects `mount` with the original tagged error.
- **R2:** A component that needs a Tag no `Provide` or mount layer supplies fails to compile, shown by a type test (`expectTypeOf` or a `// @ts-expect-error` file). Errors: no error surface beyond the compile error.
- **R3:** `Catch(tag, ...)` removes only that tag from `E`, shown by a type test; an unrelated tag stays in the type.
- **R4:** A plain React component wrapped by `fromReact` renders inside an Effect tree through `react-dom/server`, receives its props, and an Effect component placed under it is reported by the Analyzer.
- **R5:** The Analyzer builds one tree per `mount` call and reports `MissingDependency`, `UnhandledError`, `EffectInsideReact` and `Unresolved` with correct file:line on fixtures; clean fixtures report nothing. Errors: an unreadable declaration is `Unresolved`, never silently passed.
- **R6:** A minimal DOM renderer mounts the same example into a jsdom document and updates it when the root is re-mounted (no fine-grained updates). Errors: a render failure reaches `onError` and never throws from the renderer.
- **R7:** A runnable demo in `apps/` shows the example with one fixture per Analyzer error code.
- **R8:** `sleekstack check` runs the new pass in the existing CLI without changing its behavior for projects that do not use `@sleekstack/ui`.

## Boundaries
<!-- scope: business -->

- No claim of full React compatibility and no React replacement.
- No Next.js, RSC or streaming SSR.
- No per-component Scopes, fibers, interruption or time-slicing.
- No fine-grained atom reactivity or devtools.
- No change to kit, core, next, react or runtime packages' public APIs.

## Decision Context
<!-- scope: both -->

Chosen over options A (a dialect that compiles to real React) and B (a React-compatible renderer): option A cannot give interruption or scheduling beyond React's own, and option B means tracking every React release and cannot work with Next.js. The host-first model (a variant of option C) keeps the Effect type system as the source of truth, so typed requirements and errors come from the types, and the Analyzer checks them across files.

Open decisions: the package name; whether the framework sits beside kit (kit stays Effect-free) or replaces its React side later; whether to build the DOM renderer or reuse an existing one; and whether to ever support Next.js.

Phases, each leaving the tree green: (1) runtime core and string renderer, (2) type tests for requirements and errors, (3) Analyzer tree extraction and checks, (4) minimal DOM renderer, (5) demo and docs.

Maintainability (plan review): duplication - none identified; structure - task .5 adds UI gating, result merging, no-root branching and two output branches to `check.ts` `main()`, the module's sole control path; keep the ui branch in its own helper.

## Early proof point

Task fn-15-effect-native-component-framework-mvp.1 validates the core approach (a host-first `Component<P, E, R>` tree with `Provide`, `Catch` and a `fromReact` guest renders the `UserCard` example to exact markup, and an uncaught tagged error rejects `renderToString` unchanged; `mount` follows in .3 on the same run path). If it fails, re-evaluate the host-first model and the `Node` tree before continuing with .2+.

## Open Questions

- The sketches the spec cites (`component-graph-model.ts`, the string-rendering MVP) are not in the repo or its git history; API Contracts now carries the canonical `UserCard` and the render/mount contract in their place.
- Error code naming: `MissingDependency` is reused from the graph checks; `Unresolved` stays as the spec names it, distinct from the extractor's `Unresolvable`.
- Package name stays `@sleekstack/ui` until decided; the analyzer's library matcher keys on it, so a rename touches that matcher.
- fn-12 (not started) also edits `@sleekstack/analyze` and reserves ADR 0014. No hard dependency; whichever lands second rebases, and fn-15's ADR takes the next free number.

## Quick commands

```bash
pnpm --filter @sleekstack/ui test && pnpm --filter @sleekstack/ui typecheck
pnpm --filter @sleekstack/analyze test && pnpm --filter sleekstack test
```

## Resolved via Research
<!-- provenance: plan (docs-scout, practice-scout, docs-gap-scout, memory-scout) on 2026-10-02 -->

### docs-scout
- **effect 3.21.2 (declared ^3.15)** — `Effect.catchTag` narrows `E` only when `_tag` is a string literal; Provide's `R` should mirror `Effect.provide` (`Exclude<R2, A> | R`). Source: https://effect.website/docs/error-management/expected-errors/
- **effect Cause** — `runPromise` rejects with a `FiberFailure`; use `runPromiseExit` and read the failure from the `Cause` to reject with the original tagged error. Source: https://effect.website/docs/data-types/cause/
- **react-dom 19.2.6** — `renderToString` is synchronous and does not wait for Suspense; run the Effect tree to a `Node` first, then render guests. Source: https://react.dev/reference/react-dom/server/renderToString
- **react-dom/client 19.2.6** — one `createRoot` per container; `root.unmount()` before re-creating on the same container. Source: https://react.dev/reference/react-dom/client/createRoot
- **TypeScript 5.8 compiler API** — read `Effect<A, E, R>` via `checker.getTypeArguments` on the reference or `aliasTypeArguments`; unions via `type.isUnion()`; `TypeFlags.Any` maps to fail-closed. Source: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API

### practice-scout
- **Gotcha:** `K extends E["_tag"]` with `E = never` makes `Catch` uncallable; cover it in the type tests. Source: https://effect.website/docs/error-management/expected-errors/
- **Gotcha:** a bare `@ts-expect-error` passes on any error; pair each negative case with a compiling positive twin. Source: https://vitest.dev/guide/testing-types
- **Gotcha:** React 19 tests with manual `createRoot` need `IS_REACT_ACT_ENVIRONMENT = true` and `act` from `react`, and roots must be unmounted manually. Source: https://react.dev/reference/react/act
- **Security:** the string renderer must escape text and attribute values itself; only guest output gets React's escaping. Source: https://owasp.org/www-community/attacks/xss/

### docs-gap-scout
- **Docs that must change:** `CONTEXT.md` (new component-framework terms; Analyzer entry), `docs/adr/` (new ADR + README index row), `apps/docs/content/docs/errors.mdx` and `testing.mdx` (new codes, check behavior), `apps/docs/content/docs/meta.json`, `README.md` packages table, `packages/analyze/README.md`, `packages/cli/README.md`. Source: docs-gap-scout scan of those files.

### memory-scout
- **Showcase tests must not read the build-generated .sleekstack report** — demo and fixture tests run the analyzer directly. Source: memory showcase-tests-must-not-read-the-build-2026-10-02
- **Static list evaluation must key objects by evaluation instance** — list-built trees must not collapse nodes. Source: memory static-list-evaluation-must-key-object-2026-09-29

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | `Component`, `mount`, `Provide`, `Catch` and `fromReact` exist and render the sketch's `UserCard` example to the exact expected markup. Errors: an uncaught `E` rejects `mount` with the original tagged error. | fn-15-effect-native-component-framework-mvp.1, fn-15-effect-native-component-framework-mvp.3 | — |
| R2 | A component that needs a Tag no `Provide` or mount layer supplies fails to compile, shown by a type test (`expectTypeOf` or a `// @ts-expect-error` file). Errors: no error surface beyond the compile error. | fn-15-effect-native-component-framework-mvp.2 | — |
| R3 | `Catch(tag, ...)` removes only that tag from `E`, shown by a type test; an unrelated tag stays in the type. | fn-15-effect-native-component-framework-mvp.2 | — |
| R4 | A plain React component wrapped by `fromReact` renders inside an Effect tree through `react-dom/server`, receives its props, and an Effect component placed under it is reported by the Analyzer. | fn-15-effect-native-component-framework-mvp.1, fn-15-effect-native-component-framework-mvp.4 | — |
| R5 | The Analyzer builds one tree per `mount` call and reports `MissingDependency`, `UnhandledError`, `EffectInsideReact` and `Unresolved` with correct file:line on fixtures; clean fixtures report nothing. Errors: an unreadable declaration is `Unresolved`, never silently passed. | fn-15-effect-native-component-framework-mvp.4 | — |
| R6 | A minimal DOM renderer mounts the same example into a jsdom document and updates it when the root is re-mounted (no fine-grained updates). Errors: a render failure reaches `onError` and never throws from the renderer. | fn-15-effect-native-component-framework-mvp.3 | — |
| R7 | A runnable demo in `apps/` shows the example with one fixture per Analyzer error code. | fn-15-effect-native-component-framework-mvp.6 | — |
| R8 | `sleekstack check` runs the new pass in the existing CLI without changing its behavior for projects that do not use `@sleekstack/ui`. | fn-15-effect-native-component-framework-mvp.5 | — |
