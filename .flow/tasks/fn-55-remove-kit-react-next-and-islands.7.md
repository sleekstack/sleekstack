---
satisfies: [R6]
---
# fn-55-remove-kit-react-next-and-islands.7 docs content, generated API docs, ADR, CONTEXT and AGENTS.md for the removal

## Description
Bring prose and records in line: delete pages and snippets about the removed packages, rewrite the remaining guides on core, runtime, ui, router and start, regenerate the API reference, and record the decision.

**Size:** M
**Files:** apps/docs/content/docs/*.mdx and meta.json, apps/docs/snippets/**, generated apps/docs/content/docs/api (via generate:api only), docs/adr/0040-*.md and README row, superseded markers on earlier ADRs, CONTEXT.md, AGENTS.md
**Touches:** [apps/docs/content/**, apps/docs/snippets/**, docs/adr/**, CONTEXT.md, AGENTS.md]

### Approach
- Delete pages for kit, the React adapter, Next and islands (including kit-vs-effect and getting-started-kit); keep or rewrite concepts, errors and testing guides on remaining packages. Never hand-edit generated API pages; run `generate:api`.
- One new ADR records the removal and that Redirect/NotFound and the runtime feed live where they now do; earlier ADRs for the removed packages get a superseded status line pointing at it.
- CONTEXT.md: drop the Kit facade, React integration, Island and Next integration terms; keep Request Scope, Runtime Package and Devtools wording accurate for the surviving packages.
- AGENTS.md: verify table rows and the fixture graph check use only remaining packages and fixtures.

### Investigation targets
**Required**:
- `apps/docs/content/docs/meta.json` and the pages named above
- `CONTEXT.md` (Kit facade, React integration, Next.js integration sections)
- `AGENTS.md`, `docs/adr/README.md`
- ADRs 0004, 0009 to 0013, 0018, 0019 for status lines
**Optional**:
- `apps/docs/package.json` (`generate:api`)

## Acceptance
- [ ] No docs page, snippet or generated API page names a removed package; snippets typecheck
- [ ] New ADR indexed; ADRs of removed packages marked superseded; CONTEXT and AGENTS.md match the remaining packages
- [ ] `pnpm turbo run test typecheck --filter=docs` and the root `pnpm test` are green

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
