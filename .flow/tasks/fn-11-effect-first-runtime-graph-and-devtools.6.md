---
satisfies: [R4]
---
# fn-11-effect-first-runtime-graph-and-devtools.6 devtools: @sleekstack/devtools package with dev-only panel, mounted in the showcase

## Description
New package with `<SleekStackDevtools />` polling the dev handler and showing graph, live scopes, atom store contents (read-only) and last errors; mount it in the showcase layout.

**Size:** M
**Files:** packages/devtools/** (new; follow packages/next/package.json conventions), apps/showcase/app/layout.tsx, apps/showcase/next.config.ts, apps/showcase/src/__tests__/bundle.test.ts, pnpm-workspace/CI lists
**Touches:** [packages/devtools/**, apps/showcase/app/layout.tsx, apps/showcase/src/__tests__/bundle.test.ts, .github/workflows/ci.yml]

### Approach
- Package layout per repo convention (private 0.0.1, src/index.ts main/types, vitest, typecheck).
- Panel renders an empty state when the handler is off; reads atoms through the react package's store access.
- Production: mount only under `process.env.NODE_ENV !== 'production'`; add a bundle-test marker check that client chunks lack the panel.
- Add the package to CI test/typecheck lists (.github/workflows/ci.yml:35).

## Acceptance
- [ ] Panel shows graph, scopes, atoms, errors against the showcase in dev
- [ ] Production `next build` client chunks contain no devtools marker (bundle test)
- [ ] Empty-state render test

## Done summary
@sleekstack/devtools: dev-only polling panel (graph, live scopes, errors, passed atoms), mounted in the showcase layout behind a NODE_ENV dead-branch import; bundle test asserts absence from production client chunks.
## Evidence
- Commits: c9995e6, f86ec60
- Tests: pnpm --filter @sleekstack/devtools test, pnpm --filter showcase test
- PRs: