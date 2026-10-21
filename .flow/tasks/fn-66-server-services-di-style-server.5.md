---
satisfies: [R2, R3]
---
# fn-66-server-services-di-style-server.5 ui-vite: generate `virtual:sleek/server` and `virtual:sleek/server-registry`

## Description
The transformer. A Vite plugin reads contracts through the analyzer (tasks 3 and 4) and serves two virtual modules built from the descriptions: the browser Layer and the server registry. It only adds code; nothing is stripped, so there is no pruning to get wrong.

**Size:** M
**Files:** packages/ui-vite/src/server-services.ts (new), packages/ui-vite/src/index.ts, packages/ui-vite/src/__tests__/server-services.test.ts (new), packages/ui-vite/src/__tests__/fixtures/ (new tiny project)
**Touches:** [packages/ui-vite/src/server-services.ts, packages/ui-vite/src/index.ts, packages/ui-vite/src/__tests__/**]

### Approach
- Follow `routes.ts` for the mechanics: `resolveId` and `load` filters on the two ids (`routes.ts:260-275`), a declaration file written only when it changed (`:229-241`), dev invalidation in every environment plus a full reload on a contract change (`:276-288`).
- Load analyzer output through the same jiti-loaded path `analyze.ts` uses (the analyzer ships as TypeScript source); cache per invalidation so dev HMR does not rebuild the program on every request.
- A pure printer from the description to Schema source (`Schema.Struct`, `Schema.Literal`, `Schema.Array`, `Schema.optional`, `Schema.Void`, `taggedError(Class, { ... })`) with imports of each error class from its contract file. Unit-test it directly, kind by kind.
- `virtual:sleek/server` default-exports `serverClients([...])` from `@sleekstack/start/client`; `virtual:sleek/server-registry` default-exports the entries for `start({ services })`. Both reference the Tag by import from the contract file, never the implementation.
- Write a `.d.ts` declaring both modules (typed as in tasks 1 and 2); location option defaults beside the project's `src`.
- Add the plugin to the `sleekstack()` array in `index.ts:38-45` and export it standalone (apps that use the React plugin and a hand-picked part of `sleekstack()`, as the showcase and realworld do, need it alone).
- Analyzer diagnostics fail the load with file:line; never emit a partial client.

### Investigation targets
**Required** (read before coding):
- `packages/ui-vite/src/routes.ts:226-290` — declaration, virtual module and HMR patterns to copy
- `packages/ui-vite/src/analyze.ts:1-45` — how the analyzer is loaded and diagnostics shaped
- `packages/ui-vite/src/index.ts:34-45` — the plugin array
- `packages/ui-vite/src/__tests__/hmr.test.ts`, `routes.test.ts` — test setups to mirror
- `packages/analyze/src/typeSchema.ts` (task 4) — the description type

**Optional** (reference as needed):
- `apps/realworld/vite.config.ts:8-10` — the filter-one-plugin usage that motivates a standalone export

## Acceptance
- [ ] Printer test: every description kind prints the expected Schema source (snapshot).
- [ ] Fixture project test: `load` of both ids yields the expected code; the browser module imports no `*.server.ts`; analyzer diagnostics (an unserializable type) fail the load with file:line.
- [ ] HMR test: editing a contract invalidates both modules in every environment; editing an implementation file does not; the declaration is rewritten only when its text changes.
- [ ] The plugin is in the `sleekstack()` array and exported on its own.
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui-vite...` passes.

## Done summary
Added the `serverServices()` Vite plugin (packages/ui-vite/src/server-services.ts). It reads Server Service contracts through the analyzer (loaded with jiti, as analyze.ts does) and serves `virtual:sleek/server`, whose default export is `serverClients(entries)`, and `virtual:sleek/server-registry`, whose default export is the entries for `start({ services })`. Both import each Tag and error class from its contract file. The plugin is in the `sleekstack()` array and is also exported on its own.

- `printSchema` prints a description to Schema source. A mutable array becomes `Schema.mutable(Schema.Array(..))`. A method with no errors gets no `error` key, one error gets a single `taggedError`, and several get a `Schema.Union`.
- The declaration goes to `src/server.gen.d.ts` (option `serverDeclaration`, relative to the Vite root). It is rewritten only when its text changes. An app with no contracts gets no file, so adding the plugin to `sleekstack()` writes nothing into existing apps.
- Errors: an analyzer error, or an analyzer crash, fails the load with `<abs file>:<line> <code>: <message>`. No partial client is emitted.
- Dev: a `*.server.ts` change is ignored. Any other source change re-runs the analysis. Both modules are invalidated in every environment, plus a full reload, only when the generated output changes. A comment-only contract edit does nothing.
- Tests: packages/ui-vite/src/__tests__/server-services.test.ts covers printSchema kind by kind, fixture load (inline snapshot, no `.server.` import, the generated Schemas decode into the contract's classes), declaration typing (tsc), a `Date` method failing with `dated.ts:4 ServerServiceTypeNotSerializable`, HMR, and the plugin array. The fixture is in src/__tests__/fixtures/server-services/.
- Deviation: the analysis builds its own TypeScript program. It does not share the analyze plugin's program, because that would need analyze.ts changes, which are outside Touches. There is a ponytail note on the per-change rerun cost.
- Test note: the HMR test uses `optimizeDeps.noDiscovery`. Without it, the client dep optimizer held `server.close` past the hook timeout.
- The commit trailer is Claude Opus 5.5, per the session attribution rule, not the Sonnet line in the conductor note.

baseline: green
Tier: session (jev-unavailable(no_key)); project routing block pins implementer opus at medium (actual_model: claude-opus-5-5)

stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: e99192d32021621b42cbad355eadfb2f7453cf49
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui-vite...
- PRs: