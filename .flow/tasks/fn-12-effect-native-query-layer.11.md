---
satisfies: [R12]
---
# fn-12-effect-native-query-layer.11 ADR, CONTEXT, docs guides, TanStack mapping page, API reference

Touches: [docs/adr/**, CONTEXT.md, apps/docs/**, packages/*/README.md]

## Description
Write the decision record and user docs for the query layer (spec R12); BLOCKED until fn-11.7 (docs for fn-11) is done: run `flowctl show fn-11-effect-first-runtime-graph-and-devtools.7` first and stop with NEEDS_HUMAN if it is not `done`, to avoid conflicting edits.

**Size:** M
**Files:** docs/adr/*, CONTEXT.md, apps/docs/content/docs/*.mdx, apps/docs/snippets/*, packages/query/README.md, packages/kit/README.md, packages/react/README.md
**Touches:** [docs/adr/**, CONTEXT.md, apps/docs/**, packages/*/README.md]

### Approach
- ADR number: take the next free number after fn-11.7 lands (0010 and 0011 exist; fn-11.7 is planned as 0012 -> use 0013 if so). Record: query layer on native atoms, rejection of a TanStack wrapper/standalone client, supersedes the earlier no-TanStack-package note, known limits (gcTime per family, staleTime semantics, server-only vs client buffers).
- CONTEXT.md terms: Query (cache), Mutation, QueryCache, Dehydrated; keep distinct from kit Next Query/Action.
- Docs: guide with kit/effect snippet pairs (typechecked by apps/docs/test/examples.test.ts), SSR/hydration guide, TanStack-to-SleekStack mapping page; SSR guide must document: Hydrate lives in `@sleekstack/query`, `prefetch` in `@sleekstack/next` (depends on `@sleekstack/query`), `<HydrateQueries>` in `@sleekstack/react`; lazily fetched entries ship in a useId-keyed JSON script; typed failures are opt-in at prefetch; and the contract that a lazy server read of an un-prefetched query uses the configured runtime only (no per-call request/overrides Layers), so queries needing request-scoped services MUST be prefetched via `prefetch(..., { request, overrides })` (ADR known limit too). <!-- Updated by plan-sync: fn-12.6 -->
- regenerate the API reference with `query` in entry-points (anchors: `.flow/memory/bug/integration/typedoc-markdown-anchors-differ-from-2026-09-28.md`).

### Investigation targets
**Required**:
- `apps/docs/scripts/entry-points.mjs`, `apps/docs/scripts/generate-api.mjs`
- `apps/docs/test/{examples,api-coverage}.test.ts`
- `docs/adr/README.md`, `CONTEXT.md`

## Acceptance
- [ ] ADR and CONTEXT terms committed, ADR index updated
- [ ] Guides, SSR guide and TanStack mapping page exist with typechecked snippets
- [ ] `pnpm --filter docs test` and `pnpm -r test` pass with the regenerated API reference

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
