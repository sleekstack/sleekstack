# Showcase: one app, all of @sleekstack/ui

## Goal & Context
`apps/ui-demo` becomes `apps/showcase`, the only showcase app and its final name. The Next.js `apps/showcase` and `apps/showcase-kit` are deleted. The new showcase demos every `@sleekstack/ui` feature that exists today, so a reader sees them working in one place.

## Scope
- Rename `apps/ui-demo` to `apps/showcase` (package name `showcase`, Vite app).
- Delete the old `apps/showcase` and `apps/showcase-kit` (user decision: coverage moves into packages as fixtures, not kept as apps).
- Add demos for typed DOM, `lazy`, forms and actions, transitions and deferred atoms, `Portal` and `Boundary` reset, the router, the devtools panel and component testing.

## Acceptance
- **R1:** `apps/showcase` is the former `apps/ui-demo` (history kept by a rename); no `apps/ui-demo`, old Next.js `apps/showcase` or `apps/showcase-kit` directory exists, and the workspace has one package named `showcase`.
- **R2:** No file in the repo (code, tests, CI, docs, ADRs, READMEs, AGENTS.md, CONTEXT.md) still points to `showcase-kit`, `ui-demo` or the old Next.js showcase, except history in `.flow/` and closed specs.
- **R3:** The CLI `check` tests and the analyzer fixtures that used the two Next.js apps run against fixtures under `packages/cli` or `packages/analyze` that cover the same cases (valid JSON only on stdout with exit 0; `RequestLive`/`DemoLive` request and overrides roots with `--entry`), and they pass.
- **R4:** AGENTS.md's export-name rule names a command that still works: the `sleekstack check --json` before-and-after comparison runs in a path that exists, and the Verify table matches the repo.
- **R5:** CI has no step for a deleted app; its build, bundle test and e2e steps run for `showcase` where they apply, and the "Require test/typecheck scripts" list names only existing packages.
- **R6:** The docs guides test and `showcases.mdx` describe the one showcase and only allow files that exist.
- **R7:** The showcase has a page or section for each of: typed host elements, `lazy`, form actions (`useAction`, `useFormStatus`, `useOptimistic`), `startTransition` and `useDeferredAtom`, `Portal`, `Boundary` reset, the router (loader, `Link`, prefetch), the devtools panel (dev only) and a component test using `@sleekstack/testing`.
- **R8:** Each demo is reachable from the showcase shell, runs in the SSR, hydration and resume paths the app already supports where the feature supports them, and has a test.
- **R9:** The showcase architecture test, size budget test (ADR 0022) and `sleekstack check` (no diagnostics) stay green, and the ADR 0022 text names `apps/showcase`.
- **R10:** `apps/showcase/README.md` lists every demo and how to run the app; the root README and the package READMEs link to it.
- **R11:** No error surface beyond the existing app and test failures: a missed reference fails typecheck, tests, the docs guides test or CI, and no runtime behaviour of any package changes.

## Boundaries
- No change to the behaviour of any package under `packages/`; only fixtures and docs there.
- Keep the app Vite only; do not reintroduce Next.js.
- Do not hand-edit generated API docs.
