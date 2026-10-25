# Class Controllers and Service classes

## Conversation Evidence

> user (turn 1): "What if we create services in realworld application instead of plain functions"
> user (turn 2): "try the Articles slice on a branch"
> user (turn 3): "can we put them in one class based service?"
> user (turn 4): "can each fn be a method of that class?"
> user (turn 5): "can each method be a generator function method?"
> user (turn 6): "can we write our own Effect.Service base class so that we can use more simple native idiomatin generator functions without any wiring"
> user (turn 7): "can we just yield Articles in controllers?"
> user (turn 8): "we want a controller class too just like Service"
> user (turn 9): answered Scope = framework feature, Shape = one default class per file, Services = declared deps on `this`
> user (turn 10): answered Lifetime = per request, Options = named exports beside the class, Exports = both from `@sleekstack/start`, docs show both
> user (turn 11): "write the spec and plan the tasks"

## Goal & Context

Server code is Effect functions that each restate their requirements. Realworld's `Articles` (branch `realworld-articles-service`) proved a smaller form: a base class whose subclass is plain generator methods, with its dependencies declared once. This spec makes that form a framework feature in `@sleekstack/start` and extends it to Controllers, so a Controller file is one default class of HTTP-named generator methods whose services are declared, not yielded.

Design record: ADR 0056 (Proposed; this spec accepts it), reversing the class-controller rejection of ADR 0053 and building on ADR 0054's wiring. Vocabulary: CONTEXT.md (Controller, Controller Method, Layer File, Server Service, Directory Defaults).

## Architecture & Data Models

- `Service<Self>()(key, deps?)` is a base class in `@sleekstack/start`, ported from `apps/realworld/server/service.ts`. It is the Tag of the service, builds `Default` from the declared Tag record, wraps each generator method as a spanned Effect, and puts each declared Tag on `this`. `accessors(Class)` maps the generator methods to the Effects they run as. A service is built once with the app's Layer.
- `Controller(deps?)` is a base class for a Controller file's default export. Method names are the HTTP methods. It is built per request: the request's Effect resolves each declared Tag from its context, builds the instance and calls the method. Each generator method is wrapped once per class, not once per instance, and called with the instance as `this`.
- `Gen<A, E = never, R = never>` is the written return type of a generator method. The analyzer reads its first argument as the success type and `E` and `R` as it reads them for `Effect`.
- The analyzer (`packages/analyze/src/controllers.ts`) reads a default-exported class that extends `Controller(...)` beside the named-export form, producing the same `ControllerMethod` records, plus the declared Tag record for the requirement check.
- `ui-vite` generates the same `ControllerEntry` for a class Controller; its `run` builds the instance and calls the method. The RPC Manifest and `callController` work over it unchanged.

## API Contracts

```
class Articles extends Service<Articles>()('app/Articles', { db: Db }) { *get(slug: string) {...} }
export default class extends Controller({ articles: Articles }) {
  *GET(input: { params: { slug: string } }): Gen<Schema.Schema.Type<typeof Article>, NotFound, Viewer> {...}
}
export const wrap = ...   // options stay named exports beside the class
```

New public names of `@sleekstack/start`: `Service`, `Controller`, `Gen`, `accessors`.

## Edge Cases & Constraints

- A file is one form: a default class together with a named Controller Method export is `ControllerMethodShape`.
- A class with no HTTP-named method, an HTTP-named member that is not a generator method, a method without a written `Gen`, or a default export that is not a `Controller(...)` subclass is `ControllerMethodShape` naming the file.
- A declared Tag that nothing provides (a `wrap`, a Layer File, `start({ layer })` or a request service) is `MissingDependency` naming the class.
- An option export (`wrap`, `bodyLimit`, `origins`) runs before the instance is built, so it cannot read the declared dependencies.
- A generator method must run as an Effect also when another method calls it with `yield* this.method()`.
- The `accessors` helper exists because a class cannot type its own statics from its own body.

## Acceptance Criteria

- **R1:** `@sleekstack/start` exports `Service`, `Controller`, `Gen` and `accessors`. `Service` builds `Default` from its declared Tags (built once with the app's Layer), is its own Tag, wraps every generator method as a spanned Effect (also for internal `yield* this.method()` calls and for inherited methods) and leaves a non-generator method alone. Errors: a method name `constructor` or a declared Tag name that collides with a method name is a defect at class definition.
- **R2:** `Controller` is built per request: the request's Effect resolves the declared Tags, builds the instance and runs the method, with each generator method wrapped once per class. A declared Tag may be a per-request service provided by a `wrap`. Errors: a missing declared Tag fails the request as any missing requirement does (the analyzer reports it earlier as R5).
- **R3:** The analyzer reads a `*.controller.ts` default-exported class extending `Controller(...)`: HTTP-named generator methods with a written `input` type and a written `Gen<A, E, R>`, as it reads a named-export Controller Method, and the declared Tag record. Errors: `ControllerMethodShape` for each shape in Edge Cases, naming file and line.
- **R4:** `sleekstack check` counts the declared Tags and each method's written `R` as the class's requirements and reports one nobody provides as `MissingDependency` naming the class. Errors: the existing diagnostics only.
- **R5:** The Vite plugin generates the `ControllerEntry` of a class Controller and the app serves it through `start()`: params, query and body decode, the method runs on a per-request instance, the answer encodes, `wrap` and Directory Defaults apply as today, and `HEAD` and `OPTIONS` defaults hold. Errors: a discovery error fails the build in build mode and is reported in dev, as for function Controllers.
- **R6:** An RPC Manifest entry may name a Method of a class Controller, and `callController` serves a generated class entry. Errors: no error surface beyond the existing Manifest and `callController` errors.
- **R7:** Realworld's Articles migrate: `Articles` is a `Service` from `@sleekstack/start` and the article Controllers are class Controllers declaring `Articles`. Behavior, routes, statuses and the 161 realworld tests are unchanged. Errors: no error surface beyond the existing tests.
- **R8:** ADR 0056 is Accepted. CONTEXT.md names Service Class, Class Controller and Declared Dependency. The Server Services and Controllers guides show `Effect.Service` and the class form side by side, with type-checked snippets; the READMEs, `llms.md` (under 8192 bytes) and the `errors.mdx` rows describe the new diagnostics' causes. Errors: no error surface beyond the generated API docs, which come from `generate:api` and are not hand-edited.

## Quick commands

- `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/start... --filter=@sleekstack/ui-vite... --filter=@sleekstack/testing --filter=realworld --filter=showcase`
- `pnpm --filter realworld check`
- `pnpm turbo run test typecheck build --filter=docs`
- `pnpm format:check`

## Early proof point

Task 1 (`Service` and `accessors` in `@sleekstack/start`) with `Articles` moved onto it must keep realworld's 161 tests green. If a class cannot keep the generator-method form and the declared-dependency record typed, stop and revisit ADR 0056 before building the analyzer reading.

## Boundaries

- Do not remove or change named-export Controllers, RPC Files, the Manifest or Layer Files.
- No decorators. No Controller dependency that is not a Tag.
- Do not stage the fn-70 files; they belong to another spec.

## Decision Context

- A Controller is built per request, against the recommendation, so a declared dependency can be the per-request viewer. The cost is one allocation per request; wrapping is done once per class to keep it small.
- Options stay named exports beside the class so the option reader is unchanged and a `wrap` composes as today.
- `accessors` is kept because the static side of a base class cannot be mapped over its own subclass.

## Requirement coverage

| Req | Description | Task(s) | Status |
| --- | --- | --- | --- |
| R1 | Service, accessors, Gen exports | | |
| R2 | per-request Controller runtime | | |
| R3 | analyzer reads class Controllers | | |
| R4 | check counts declared dependencies | | |
| R5 | codegen and serving | | |
| R6 | Manifest and callController | | |
| R7 | realworld migration | | |
| R8 | ADR, CONTEXT.md, docs | | |
