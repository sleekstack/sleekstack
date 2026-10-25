---
satisfies: [R5, R6]
---
# fn-71-class-controllers-and-service-classes.4 ui-vite and start: generate and serve class Controller entries

Touches: [packages/start/src/class.ts, packages/ui-vite/src/server-services.ts, packages/ui-vite/src/__tests__/server-services.test.ts, packages/ui-vite/src/__tests__/fixtures/**, packages/start/src/rpc.ts, packages/start/src/app.ts, packages/start/src/__tests__/**, packages/testing/src/__tests__/serverFn.test.ts]

## Description
Generate the `ControllerEntry` of a class Controller and serve it through `start()`, the RPC Manifest and `callController`.

**Size:** M
**Files:** `packages/ui-vite/src/server-services.ts`, its tests and fixtures, `packages/start/src/rpc.ts`, `packages/start/src/app.ts`, `packages/testing/src/__tests__/serverFn.test.ts`
**Touches:** [packages/start/src/class.ts, packages/ui-vite/src/server-services.ts, packages/ui-vite/src/__tests__/server-services.test.ts, packages/ui-vite/src/__tests__/fixtures/**, packages/start/src/rpc.ts, packages/start/src/app.ts, packages/start/src/__tests__/**, packages/testing/src/__tests__/serverFn.test.ts]

### Approach
- `readControllers` (`server-services.ts:431-438`) keeps only `{name, schema}`; carry the class kind and declared Tag keys from the analyzer report (task 2).
- The entries code (`:466-483`) emits `run: <ns>.<name>`; for a class file emit a `run` that calls the task 1 helper: build the instance from the request context and call the wrapped method with `this` bound. `ControllerEntry` and `serveController` (`controller.ts:198`) stay unchanged. The options chain (`:479-481`) is unchanged because options are named exports.
- Typing of a class module: `ControllerModules` is `typeof import(file)` (`:551`), which has `default` and no `GET`; `RpcRoute` in `packages/start/src/rpc.ts:70-72` uses `Extract<keyof ControllerModules[R], Method>`. Make the declaration expose the class's HTTP method keys so Manifest typing works for class modules.
- The Manifest implementations (`:308-320`, `:489-491`) emit `<ns>.<name>`; route a class Controller method through the same helper.
- Memory notes: the plugin memo resets per build; a new generated module needs a declaration; Set-Cookie and `ResponseStatus` writes must reach the response.
- Fixture `class-controller-app` next to the existing `controller-app` and a test next to "serves a generated entry through start()": referenced Schema, a declared Tag provided by a `wrap`, `HEAD`, `OPTIONS` and 405 `Allow` derived from the class's methods, a defect reaching `onError`. Add a Manifest fixture wrapping a class method and a `callController` test over a class entry.
- <!-- Updated by conductor: fn-71.1 shipped. The per-request helper is a static method of the class: `static run(this: C, method)` returning `ControllerMethodEntry['run']`, so the generated entry is `GET: { run: <alias>.default.run('GET'), ...schemas }`. It checks the method name and declared names when called, so a bad class fails when the generated module loads. A missing declared Tag ends the request as a defect. Spans: `<ClassName>.<method>`; an anonymous default class reads `Controller.<method>`. Risk to settle here: the duplicate-Service-key registry lives as long as `@sleekstack/start`, so a dev reload that re-runs a Service file would throw 'already used'; make a dev reload of the same file not throw (and test it). -->
- <!-- Updated by conductor: fn-71.2 shipped. `ControllerDecl.kind` and `declared` (names in written order) tell the codegen which files are classes; the analyzer report fields are `{ name, tag, location }` per declared dependency. -->
- <!-- Updated by conductor: fn-71.3 shipped. `analyzeRpc` reports a class-backed Manifest entry with the same `controller: { route, method }` as a function entry and no `kind`; the Manifest codegen at `server-services.ts:315-319` currently emits a named import `{ file, name: verb }`, which does not exist for a class. Tell the two forms apart by looking up `ControllerDecl.kind` from `analyzeControllers` by route (or add `kind` to `RpcMethod.controller`), then emit the same `<alias>.default.run('<METHOD>')` call. The shared class reader is `defaultClassOf` in `packages/analyze/src/controllers.ts`. A Manifest entry naming a static generator method is not refused by the Manifest check (the Controller check reports that shape). -->

### Investigation targets
**Required**:
- `packages/ui-vite/src/server-services.ts:308-320, 431-438, 466-491, 551`
- `packages/start/src/rpc.ts:60-72`, `packages/start/src/app.ts:14-25`
- `packages/testing/src/serverFn.ts:158-165`
- `packages/ui-vite/src/__tests__/server-services.test.ts` - the `controller-app` fixture test

### Acceptance
- [ ] a class Controller is served by `start()` with decode, per-request instance, encode, `wrap` and `_defaults.ts` applied, and HEAD, OPTIONS and 405 behave as for a function Controller
- [ ] a declared Tag provided by a `wrap` resolves at run time; a missing one is a defect that reaches `onError`
- [ ] a Manifest service wrapping a class Controller method works and `callController` serves a class entry
- [ ] a discovery error fails the build in build mode and is reported in dev, as for function Controllers
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing` passes

## Acceptance
- [ ] TBD

## Done summary
The Vite plugin now generates class Controller entries and the app serves them: a class file's entry runs `<alias>.default.run('<METHOD>')`, and a Manifest entry that wraps a class method calls the same helper. `RpcMethod.controller` gained a `kind` field from the analyzer for this. The declaration types a class module as `import('@sleekstack/start').ControllerMethodsOf<typeof import(file).default>` in `ControllerModules` and in the Manifest Tag shape. `ControllerMethodsOf` is a new public type of start: the HTTP-named methods as Effect functions through `Call<never, G>`.

- Dev reload: the Service key registry now records which file defined each key (read from the V8 caller frame, query dropped). A file that runs again may define its key again. A key reused from another file still throws "already used". Known limit: two Services with one key in the same file are no longer caught (shortcut comment in class.ts). The existing duplicate-key test now defines the duplicate from a fixture file.
- Tests: packages/start/src/__tests__/class.test.ts (re-import under `?reload=1`, red without the fix); packages/ui-vite/src/__tests__/server-services.test.ts tests named "serves a class Controller through start()", "fails the build on an invalid class Controller ...", "runs a Service file again on a dev reload", plus the describe block "the RPC Manifest over a class Controller" (wire, in-process, committed declaration with consumer typecheck); packages/testing/src/__tests__/serverFn.test.ts "callController over a class Controller entry". Fixture: packages/ui-vite/src/__tests__/fixtures/class-controller-app.
- ui-vite tests run against start's dist: rebuild start (`pnpm --filter @sleekstack/start build`) before running them alone.

stage: impl-review - skipped(policy: user asked for one completion review at the end of the spec)
Tier: implementer opus at medium
## Evidence
- Commits: e3068e39, 37757c36
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=@sleekstack/analyze --filter=sleekstack --filter=realworld --filter=showcase, pnpm --filter realworld check, pnpm --filter showcase check, pnpm turbo run test typecheck build --filter=docs, pnpm format:check
- PRs: