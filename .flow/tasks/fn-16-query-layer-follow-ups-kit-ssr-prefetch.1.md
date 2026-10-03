---
satisfies: [R1, R2]
---
# fn-16-query-layer-follow-ups-kit-ssr-prefetch.1 kit: SSR prefetch facade (prefetch, HydrateQueries, codec option) with named errors

## Description
Add the Effect-free kit facade over core `Hydrate`. Names are fixed here against CONTEXT.md and fn-17's Snapshot/Serializable terms (record them in CONTEXT.md in the docs task).

**Size:** M
**Files:** packages/kit/src/query.ts, packages/kit/src/next/index.ts, packages/kit/src/react/index.ts, packages/kit/src/errors.ts, packages/kit/src/__tests__/ (new hydrate test, boundaries.test.tsx)
**Touches:** [packages/kit/src/**]

### Approach
- Follow the facade pattern in `packages/kit/src/query.ts:100` (`cachedQuery` wraps `CoreQuery.make`); map kit queries to core with `coreQuery` (:71) before calling core `prefetch` (`packages/next/src/query.ts:29`) and render `HydrateQueries` (`packages/react/src/HydrateQueries.tsx:38`) through the `kit()` wrapper (`packages/kit/src/react/index.ts:12`).
- Codec option is a plain `{encode, decode}` pair with a JSON default, adapted to core `Codec` (`packages/query/src/hydrate.ts:23`); never expose Effect Schema.
- Add codes for codec decode failure and missing server runner to `SleekStackErrorDetails` (`errors.ts:11-27`) and map them in `normalize` (:98).
- Read memory: kit-atom-pending-sentinel-must-be-caught-on-async-path, do-not-flatten-modules-for-next-per-call-provide.

### Investigation targets
**Required**:
- `packages/query/src/hydrate.ts` — core API being wrapped
- `packages/kit/src/query.ts` — facade pattern
- `packages/kit/src/__tests__/boundaries.test.tsx` — Effect-leak guard
**Optional**:
- `packages/react/src/__tests__/hydrate.test.tsx` — hydrate test shape

## Acceptance
- [ ] kit exports prefetch, HydrateQueries and a codec option; no Effect type reachable
- [ ] codec decode failure and missing server runner raise named kit codes, with tests
- [ ] boundary test and .d.ts emit check pass

## Done summary
Kit SSR prefetch facade: `prefetch` (kit/next, request-scoped, registers the kit server runner), `HydrateQueries` (kit/react via kit()), and the `serializable: true | QueryCodec` option on cachedQuery; new codes `QueryDecodeFailed` and `NoServerRunner`; an unserializable query fails closed naming its key. Tests: packages/kit/src/__tests__/hydrate.test.tsx. Dropped a `failures` option (kit has no error codec); follow-up if failed-query transfer is wanted.

Tier: opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK -> re-review SHIP)
## Evidence
- Commits: 844b7e1b01fd1a1f8fc95bbf885e22deb275eca9, f95f75e6163d96740993d91ee925ccbd531020f8
- Tests: pnpm typecheck && pnpm test, pnpm turbo run test typecheck --filter=@sleekstack/kit --filter=@sleekstack/query --filter=@sleekstack/react
- PRs: