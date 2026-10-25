# 0056. Class Controllers and Service Classes: generator methods, dependencies declared once

## Status

Proposed. Reverses the "Decorators and class controllers" rejection of ADR 0053 and extends ADR 0054's wiring. The named-export Controller of ADR 0053 stays valid.

## Context

ADR 0053 rejected class controllers because "a class adds a second way to provide services". That held while a class meant either decorators or a hand-built `Layer` per class. Realworld's `Articles` (branch `realworld-articles-service`) shows a smaller form: a base class whose subclass is plain generator methods (`*get(slug) { ... yield* ... }`). The base class makes each method an Effect (`Effect.fn`, spanned), is itself the Tag, takes its dependencies as a record of Tags (`{ db: Db }` on `this`) and builds `Default` from them. A service written this way has no `Effect.Service` options object, no per-method wrapper and no hand-written Layer. A Layer File default-exports `Articles.Default`, so ADR 0054 already finds and composes it.

A Controller written as a function still repeats the same preamble in every method (`const articles = yield* Articles`) and restates `Db | Articles | Viewer` in each signature.

## Decision

- **`Service` is a public base class of `@sleekstack/start`.** `class Articles extends Service<Articles>()(key, { db: Db }) { *get(...) {} }`. The record names the Tags the service needs; each is on `this` under its name. `Articles.Default` is the Layer. A generator method runs as an Effect, also when another method calls it with `yield* this.get(...)`. The class is its Tag. TypeScript types the method as a `Generator`, so a caller that is not itself a generator uses `accessors(Articles)`.
- **A Controller may be a class.** A `*.controller.ts` file may `export default class extends Controller({ articles: Articles }) { *GET(input) {} }` instead of named exports. The path sets the URL and the method names are the HTTP methods, as in ADR 0053. A file is one form or the other: a default class together with a named Controller Method export is `ControllerMethodShape`.
- **Dependencies are declared, not yielded.** The record names the Tags; the instance is built once when the app's Layer is built, so each is on `this` as the service value. The found Layers must provide them, and `sleekstack check` reports a dependency nobody provides as `MissingDependency` naming the class. A method's own requirements are then only the request's (`Viewer` from a `wrap`, `Request`, `Cookies`, `ResponseStatus`).
- **The method signature is written out, as in ADR 0053.** A generator method cannot return `Effect`, so `@sleekstack/start` exports `Gen<A, E = never, R = never>`, a `Generator` of yielded Effects ending in `A`. `*GET(input: { params: ... }): Gen<Schema.Schema.Type<typeof Article>, NotFound, Viewer>`. The analyzer reads `input` and the first `Gen` argument exactly as it reads the input and the `A` of an `Effect` today, and `E` and `R` as it reads them. TypeScript checks the body against the written `Gen`.
- **`_defaults.ts` is unchanged.** `wrap`, `bodyLimit` and `origins` keep applying by directory; a class Controller has no option exports of its own and may add them as named exports beside the default class.
- **A Controller class is not an RPC source.** The RPC Manifest (ADR 0054) keeps naming Controller Methods; the generated entry for a class method calls the instance's method.

## Consequences

- A new `AnalyzeCode` is not needed: `ControllerMethodShape` covers a class that has no HTTP-named method, a non-generator method with an HTTP name, a method without a written `Gen`, and mixed forms. `MissingDependency` covers declared dependencies.
- The analyzer reads class members and the `Controller(...)` call's record, which is new reading code beside the function reader.
- Realworld's Controllers each lose the `Effect.gen` preamble and the `Db | Articles | Viewer` repetition; `articles.controller.ts` becomes one class per file.
- `ADR 0053` names no class form; its "Rejected" bullet is superseded by this ADR for the form described here only. Decorators stay rejected.
- `accessors` exists only because a class cannot type its own statics from its own body (a base class whose static side maps over `Self` fails with "recursively references itself as a base type"). One line per service in a test or a non-generator caller.

## Rejected

- **Decorators.** Still rejected (ADR 0053).
- **Yielding the service in each method.** It keeps the analyzer simple but repeats the preamble and hides what a Controller needs from `check` until it reads the method bodies.
- **A directory `_defaults.ts` as a base class.** It would replace the inheritance of options by directory with class inheritance and needs its own decision.
- **`Effect.Service` with `accessors: true`.** Its accessors are typed from the constructor's return value, so methods written in the class body get none.
- **Making each method a class property wrapped in `Effect.fn`.** It works (`get = Effect.fn('...')(function* (this: Articles) {})`) but needs the wrapper and a `this` annotation on every method.

## To settle before Accepted

- Whether the Controller instance is built once or per request. Once is assumed above and gives the declared dependencies a place to live; a per-request value (the viewer) stays a method requirement.
- Whether `Controller(...)` also accepts the `wrap` of its directory as a method of the class.
- Where `accessors` is exported from, and whether `Service` replaces `Effect.Service` in docs for Server Services (ADR 0051).
