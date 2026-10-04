---
satisfies: [R2, R4]
---
# fn-26-built-private-package-for-sleekstackui.4 tarball consumer test: pack all three, install in a temp project, typecheck and run

## Description
Automated version of the spike: pack core, query and ui, install in a temp project with overrides, typecheck a JSX component, run `mount`, `renderToString` and `./query` in jsdom.

**Size:** M
**Files:** packages/ui/src/__tests__/pack.test.ts (new) or scripts/pack-consumer.mjs, root turbo wiring
**Touches:** [packages/ui/src/__tests__/pack*, scripts/**]

### Approach
- Follow packages/kit/src/__tests__/dts.test.ts (execFileSync pnpm, 60s+ timeout). `pnpm pack` rewrites `workspace:*` to 0.0.1, so the temp project needs `overrides`/`file:` entries for core and query or it hits the registry.
- Assert no `workspace:*` in any packed manifest, effect is a peer, one `effect` copy, source maps resolve, `./query` works (needs `@tanstack/query-core` installed), React guest (react/react-dom installed).

### Investigation targets
**Required** (read before coding):
- packages/kit/src/__tests__/dts.test.ts
- packed manifest fields

## Acceptance
- [ ] Temp-project typecheck and jsdom run pass (R2).
- [ ] A leaked `workspace:*` fails the test; two `effect` copies are called out in README as unsupported (R4).

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
