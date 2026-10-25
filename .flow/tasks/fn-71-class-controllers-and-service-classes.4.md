---
satisfies: [R5, R6]
---
# fn-71-class-controllers-and-service-classes.4 ui-vite and start: generate and serve class Controller entries

Touches: [packages/ui-vite/src/server-services.ts, packages/ui-vite/src/__tests__/server-services.test.ts, packages/ui-vite/src/__tests__/fixtures/**, packages/start/src/rpc.ts, packages/start/src/app.ts, packages/start/src/__tests__/**, packages/testing/src/__tests__/serverFn.test.ts]

## Description
Generate the `ControllerEntry` of a class Controller and serve it through `start()`, the RPC Manifest and `callController`.

**Size:** M
**Files:** `packages/ui-vite/src/server-services.ts`, its tests and fixtures, `packages/start/src/rpc.ts`, `packages/start/src/app.ts`, `packages/testing/src/__tests__/serverFn.test.ts`
**Touches:** [packages/ui-vite/src/server-services.ts, packages/ui-vite/src/__tests__/server-services.test.ts, packages/ui-vite/src/__tests__/fixtures/**, packages/start/src/rpc.ts, packages/start/src/app.ts, packages/start/src/__tests__/**, packages/testing/src/__tests__/serverFn.test.ts]

### Approach
- `readControllers` (`server-services.ts:431-438`) keeps only `{name, schema}`; carry the class kind and declared Tag keys from the analyzer report (task 2).
- The entries code (`:466-483`) emits `run: <ns>.<name>`; for a class file emit a `run` that calls the task 1 helper: build the instance from the request context and call the wrapped method with `this` bound. `ControllerEntry` and `serveController` (`controller.ts:198`) stay unchanged. The options chain (`:479-481`) is unchanged because options are named exports.
- Typing of a class module: `ControllerModules` is `typeof import(file)` (`:551`), which has `default` and no `GET`; `RpcRoute` in `packages/start/src/rpc.ts:70-72` uses `Extract<keyof ControllerModules[R], Method>`. Make the declaration expose the class's HTTP method keys so Manifest typing works for class modules.
- The Manifest implementations (`:308-320`, `:489-491`) emit `<ns>.<name>`; route a class Controller method through the same helper.
- Memory notes: the plugin memo resets per build; a new generated module needs a declaration; Set-Cookie and `ResponseStatus` writes must reach the response.
- Fixture `class-controller-app` next to the existing `controller-app` and a test next to "serves a generated entry through start()": referenced Schema, a declared Tag provided by a `wrap`, `HEAD`, `OPTIONS` and 405 `Allow` derived from the class's methods, a defect reaching `onError`. Add a Manifest fixture wrapping a class method and a `callController` test over a class entry.

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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
