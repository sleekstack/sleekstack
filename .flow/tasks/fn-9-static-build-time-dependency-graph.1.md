---
satisfies: [R1, R7]
---
# fn-9-static-build-time-dependency-graph.1 Analyzer package: extract the static graph from a tsconfig project

## Description
New `@sleekstack/analyze` package (raw `typescript` API, peer dependency, no ts-morph) that loads a tsconfig project and extracts nodes and edges from `tag()`, `layer()`, `module()` and atom / kit `effect` deps arrays into a graph model plus JSON report. Declarations covered: kit `tag` / `layer` / `module` / atoms / kit `effect`, and core `Context.Tag` / `Context.GenericTag` / `service` / `declareLayer` / core `module` (apps/showcase is core-based). Unreadable declarations (computed provide lists, unresolvable Tags) become located errors, never silent gaps.

**Size:** M
**Files:** packages/analyze/{package.json,tsconfig.json,vitest.config.ts,src/index.ts,src/extract.ts,src/model.ts}, one extraction test
**Touches:** [packages/analyze/**, pnpm-workspace.yaml, turbo.json]

### Approach
- New package mirroring packages/core layout (tsconfig extends tsconfig.base.json, vitest per package).
- Tag identity: resolve symbols to their `tag('Name')` declaration; abstract classes resolve by class declaration.
- Resolve through the tsconfig project only; treat a module resolved to an emitted `.js` / `.d.ts` sibling of a `.ts` file as an error.

### Investigation targets
**Required**:
- `packages/kit/src/tag.ts:60-79` — tag(), keyOf, coreTag
- `packages/kit/src/layer.ts:109-142` — layer() deps array and LayerInfo
- `packages/kit/src/module.ts:25-151` — module config, unwrap, snapshot shape to mirror
- `packages/core/src/graph.ts:20-95` — node/edge/module model to mirror
- `apps/docs/scripts/generate-api.mjs` — precedent for a TS-based build tool

### Acceptance
- [ ] Extracts the same nodes, edges, exports and private Tags as `snapshot` for a small fixture project without importing it
- [ ] A core-declared fixture (GenericTag + service + declareLayer + module) extracts the same graph as core's `snapshot`
- [ ] Atom and kit `effect` deps arrays appear as edges
- [ ] Unresolvable or computed declarations report file:line errors

## Acceptance
- [ ] TBD

## Done summary
New @sleekstack/analyze package extracts the kit/core static dependency graph from a tsconfig project through the TypeScript checker without executing app code; kit and core fixtures match snapshot()/snapshot(buildGraph), atom and effect deps become edges, and imprecise declarations (any, non-literal keys, escaped/let lists, unnamed effects) report located errors while helper-returned and written-to lists are over-approximated.

stage: impl-review - ran (codex fan-out NEEDS_WORK -> NEEDS_WORK -> SHIP, 3 rounds)
Follow-up: `.map`/loop-variable-built lists still fail closed (Computed) rather than over-approximating.
## Evidence
- Commits: a8c46ac1fce2cc3f7d8351c4ef5b72e1eaae9782, 6bd61917ca3d1b0b86ea1423debbd830a08c2c08, 4cf924c57387500cee93a6518e87283139614e06
- Tests: pnpm --filter @sleekstack/analyze test, pnpm --filter @sleekstack/analyze typecheck
- PRs: