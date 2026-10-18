---
satisfies: [R1, R2]
---
# fn-34-ui-api-reference-in-the-docs-site.1 Add @sleekstack/ui to the generated API reference

## Description
Register the ui package in the docs API pipeline, regenerate, link it in the API index, and let the existing coverage test judge it.

**Size:** S
**Files:** apps/docs/scripts/entry-points.mjs, apps/docs/content/docs/api/index.mdx, apps/docs/content/docs/api/ui/* (generated), possibly packages/ui/src/*.ts (TSDoc)
**Touches:** [apps/docs/scripts/entry-points.mjs, apps/docs/content/docs/api/**, packages/ui/src/**]

### Approach
- Append 'ui' to PACKAGES in `apps/docs/scripts/entry-points.mjs:8`; the resolver already skips `./internal` and maps dist d.ts to src.
- Run `pnpm turbo run generate:api --filter=docs`; never hand-edit `content/docs/api/ui/*`.
- Add one link per generated entry (index, jsx-runtime, jsx-dev-runtime) to the list in `apps/docs/content/docs/api/index.mdx`. There is no api meta.json; `api` is already in `content/docs/meta.json`.
- Fix any undocumented public export reported by `test/api-coverage.test.ts` by adding TSDoc in packages/ui/src (or `@internal` if plumbing).

### Investigation targets
**Required**:
- `apps/docs/scripts/entry-points.mjs`
- `apps/docs/test/api-coverage.test.ts`
- `apps/docs/content/docs/api/index.mdx`
- `packages/ui/package.json` (exports)

### Key context
The spec names `query` as a ui subpath, but ui exports only `.`, `./jsx-runtime`, `./jsx-dev-runtime`, `./internal`. `jsx-dev-runtime` re-exports jsx-runtime names (Fragment, jsxs); decide whether to mark it `@internal`/skip to keep one name per meaning.

### Acceptance
- [ ] ui pages generated under api/ui and linked from the API index (R1, R2)
- [ ] `pnpm turbo run generate:api test typecheck --filter=docs` passes
- [ ] `git diff` of generated files shows only api/ui additions plus index

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
