---
satisfies: [R2]
---
# fn-55-remove-kit-react-next-and-islands.1 runtime: framework-agnostic devtools feed handler

## Description
Move the dev-only runtime-event feed (scopes, errors, live state, optional analyzer graph) out of the Next preset into `@sleekstack/runtime` as its own entry returning a web-standard `Request` to `Response` handler, so the panel keeps a feed once the Next package is removed and `@sleekstack/start` can mount it later. The Next package's copy stays until the packages are deleted.

**Size:** S
**Files:** new packages/runtime/src/devtools.ts, packages/runtime/package.json (`exports`), tests in packages/runtime/src/__tests__/; docs entry list for generated API docs if runtime entries are enumerated
**Touches:** [packages/runtime/**]

### Approach
- Port `devtoolsHandler` and `devtoolsSnapshot` with the same JSON body and options (`graph`, `allowRemote`) from the Next package's devtools entry; no behavior change, no Next imports.
- Keep it a separate entry so production server bundles never import it; answers 404 when dev tracing is off, loopback-only unless `allowRemote`.
- Port its tests; add one proving the handler works with a plain `Request` outside any framework.

### Investigation targets
**Required**:
- `packages/next/src/devtools.ts` and its tests under `packages/next/src/__tests__/`
- `packages/runtime/src/runtime.ts` (`devEnabled`, `devEvents`, `devLive`) and `internal.ts`
- `packages/runtime/package.json`
**Optional**:
- `docs/adr/0013-framework-agnostic-runtime-package.md`

## Acceptance
- [ ] The handler returns the same body shape as before for a plain `Request`, 404 in production, loopback-only by default
- [ ] A bundle importing only the runtime's main entry does not contain the handler
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/runtime...` is green

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
