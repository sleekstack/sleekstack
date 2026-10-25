---
satisfies: [R1, R2]
---
# fn-71-class-controllers-and-service-classes.1 start: Service, accessors, Gen and the per-request Controller runtime; Articles moves onto them

Touches: [packages/start/src/class.ts, packages/start/src/index.ts, packages/start/src/__tests__/class.test.ts, apps/docs/content/docs/api/start/**, apps/realworld/server/service.ts, apps/realworld/server/articles.ts, apps/realworld/test/articles-effects.ts]

## Description
Port the prototype of `apps/realworld/server/service.ts` into `@sleekstack/start` and add the per-request `Controller` base and the `Gen` type. This is the early proof point: realworld's `Articles` runs on the library `Service` with all 161 realworld tests green.

**Size:** M
**Files:** `packages/start/src/class.ts` (new), `packages/start/src/index.ts`, `packages/start/src/__tests__/class.test.ts`, generated `apps/docs/content/docs/api/start/**`, `apps/realworld/server/service.ts` (deleted), `apps/realworld/server/articles.ts`, `apps/realworld/test/articles-effects.ts`
**Touches:** [packages/start/src/class.ts, packages/start/src/index.ts, packages/start/src/__tests__/class.test.ts, apps/docs/content/docs/api/start/**, apps/realworld/server/service.ts, apps/realworld/server/articles.ts, apps/realworld/test/articles-effects.ts]

### Approach
- Move `Service`, `accessors`, `Call` and `Accessors` from `apps/realworld/server/service.ts` (102 lines) into a new `packages/start/src/class.ts`; `packages/start/src/service.ts` already exists for Server Services, so do not reuse that file. Export them and `Gen` from `index.ts`.
- `Gen<A, E = never, R = never>` is a `Generator` of yielded Effects ending in `A` (the shape `Effect.gen` accepts), so a generator method written with `Gen` is checked by TypeScript.
- `Controller(deps?)` returns a base whose per-request build is a helper the generated entry calls: resolve each declared Tag from the request context, construct the instance, call the HTTP-named method with `this` bound. Wrap each generator method once per class (cache on the prototype in a WeakMap), not once per instance; `Service` keeps wrapping per instance. Name spans `<key>.<method>`; for a Controller use the class's route-free name.
- Define the class-definition defects of R1: a declared name equal to `constructor` or to a method of the class, and a duplicate Service key (a module-level registry of keys).
- A non-generator method is left alone. `super` calls are not supported (record in TSDoc).
- Write TSDoc with a type-checked `@example` for `Service`, `Controller`, `Gen` and `accessors` (`apps/docs/test/examples.test.ts` typechecks every `@example`; the api-coverage test requires a non-empty summary). Run `generate:api`; never hand-edit `api/*.md`.
- Repoint `apps/realworld/server/articles.ts` and `test/articles-effects.ts` to `@sleekstack/start` and delete the prototype file.
- Memory notes: Set-Cookie and ResponseStatus writes must survive a method run (same fiber and context); a generator method must run as an Effect also for `yield* this.method()`.

### Investigation targets
**Required**:
- `apps/realworld/server/service.ts` - the prototype to port
- `packages/start/src/app.ts:14-25` - `ControllerMethodEntry.run`, which the generated entry will wrap
- `packages/start/src/controller.ts:198` - where `run` is called per request, inside `wrap`
- `packages/start/src/index.ts` - export list
**Optional**:
- `apps/docs/test/api-coverage.test.ts`, `apps/docs/scripts/entry-points.mjs`

### Acceptance
- [ ] tests for `Service`: `Default` from declared Tags, Tag identity (`yield* Articles`), spans, internal `yield* this.method()`, inherited methods, non-generator methods untouched, the three class-definition defects, a Service depending on a Service
- [ ] tests for the `Controller` runtime: per-request instance, a declared Tag provided by a surrounding Effect (as a `wrap` does), `Controller({})`, `this` bound, wrapping once per class (two instances share the wrapped function)
- [ ] `Service`, `Controller`, `Gen`, `accessors` are exported with TSDoc and appear in the generated api docs
- [ ] `apps/realworld/server/service.ts` is gone and `pnpm turbo run test typecheck --filter=realworld` passes with the same 161 tests
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/start...` and `pnpm turbo run test typecheck build --filter=docs` pass

## Acceptance
- [ ] TBD

## Done summary
`@sleekstack/start` now exports `Service`, `Controller`, `Gen` and `accessors` (plus the `Call`/`Accessors` types) from `packages/start/src/class.ts`; realworld's `Articles` runs on the library `Service` and `apps/realworld/server/service.ts` is deleted, with the 161 realworld tests unchanged and green.

- `Controller(deps?)` returns a base whose static `run(method)` is the generated entry's `run`: per request it resolves the declared Tags with `Effect.all`, builds the instance (own properties point at the once-per-class `Effect.fn` wrappers, spanned `<ClassName>.<method>`, `Controller` for an anonymous `default` class) and calls the method with `this` bound. `run` checks the method exists and the declared names at call time, so a generated `{ run: C.run('GET') }` fails at module load.
- Defects: a declared name `constructor`, equal to a class method, or (Controller) an HTTP method name throws "collides"; a duplicate Service key throws "already used". The type checker also refuses a declared-name/method collision.
- Tests: packages/start/src/__tests__/class.test.ts (14 cases, one per AC item and defect).
- Follow-up note: a class field initializer followed by a `*GET` generator method needs a `;` (ASI reads `x = 1 *GET(...)` as multiplication); prettier keeps it.
- Risk: the duplicate-key registry is module-level; a dev HMR re-evaluation of a Service file without re-evaluating `@sleekstack/start` would throw "already used".

stage: impl-review - skipped(policy: user asked for one completion review at the end of the spec)
## Evidence
- Commits: f2f1382999718f03573098e022a137a1649dbbc0
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=realworld --filter=showcase, pnpm --filter realworld check, pnpm --filter showcase check, pnpm turbo run test typecheck build --filter=docs, pnpm format:check
- PRs: