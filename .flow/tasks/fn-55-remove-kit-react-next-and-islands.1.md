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
Added `@sleekstack/runtime/devtools`, a framework-agnostic dev-only `Request` to `Response` feed handler (`devtoolsHandler`, `devtoolsSnapshot`, same JSON body and `graph`/`allowRemote` options as the Next preset's copy), as a separate package export; ported the Next devtools tests and added a plain-Request test and a test that the main entry's import graph never reaches the devtools module.

Behavior change from the Next copy, from review: the handler now takes `(request, { remoteAddress })` and, unless `allowRemote`, answers 403 unless the server passes a loopback peer address and the URL host is loopback (the old check trusted the client-supplied Host header). Task .2/.3 and a future `start` mount must pass the peer address. The Next package's copy is unchanged until task .6 deletes it.

Outside packages/runtime/**: pnpm-lock.yaml gains `@types/node` for the runtime package (needed by the import-graph test; no sleek-codes entries). Generated API docs are gitignored; `apps/docs/scripts/entry-points.mjs` picks the new export up automatically and generate:api produces `api/runtime/devtools.md`.

Tests: `pnpm turbo run test typecheck --filter=@sleekstack/runtime...` (green, 15 tests).
baseline: none run pre-edit (new package entry; runtime suite green post-change)

stage: impl-review - ran (codex fan-out NEEDS_WORK -> 2 re-reviews -> SHIP)
## Evidence
- Commits: 4d9327fc409cda1ad3852774b55d75db151253dd, 2cfec5325593d1bd56d6070bf6390e36766b89f0, 8cd71d5ebb2b6b92e2d70da0444f8a6d1003b494, 5474b55227e84c9ab34a5edbcd328d0e674a2dfd, fa5a878fe30826f64ab415edee2e4b441ae8243d
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/runtime...
- PRs: