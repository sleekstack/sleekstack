---
satisfies: [R11]
---
# fn-70-served-records.1 docs: ADR 0057 served records and CONTEXT vocabulary

Touches: [docs/adr/0057-served-records.md, docs/adr/README.md, docs/adr/0053-file-routed-controllers.md, CONTEXT.md]

## Description
Write the design record before any code, as AGENTS.md requires for a decided behavior that changes. Status `Proposed (draft)`, like ADRs 0053 and 0054.

**Size:** S
**Files:** `docs/adr/0057-served-records.md` (new), `docs/adr/README.md` (index row), `docs/adr/0053-file-routed-controllers.md` (one line in Status and a pointer in Rejected: the `method(...)` helper rejection stands, the `records(...)` call form is the one exception), `CONTEXT.md`

### Approach
- Numbering: ADR 0056 (class Controllers) exists, so this is 0057 (0055 is unused). State that it also amends ADR 0056's "a file is one form or the other" for the `records(...)` default export, and add the note to ADR 0056's Status line.
- Follow the shape of `docs/adr/0041-records-layer.md` (Status, Context, Decision, Consequences, Rejected). Decision and Rejected come from the parent spec's Decision Context and Boundaries; do not add decisions.
- CONTEXT.md: add `Record Controller` (a `[id].controller.ts` whose default export is `records(Record)`), `Served Record`, and under `_Avoid_`: ViewSet, serializer, `table`. Place them beside `Record Adapter` and `Controller` (`CONTEXT.md:196`, `:279`). Extend the `Record Adapter` entry: on the server an app Layer File provides the same Tag.
- List the new public names and `AnalyzeCode` values in Consequences.

### Investigation targets
**Required**:
- `docs/adr/0041-records-layer.md` - ADR shape and the adapter contract
- `docs/adr/0053-file-routed-controllers.md:15-16,35` - the decision and the rejection being amended
- `docs/adr/0054-server-auto-wiring.md:15-16` - Layer Files and the server-only kinds
- `CONTEXT.md:196-217,255-290` - neighbouring entries

### Acceptance
- [ ] ADR 0057 exists with the amendment of ADR 0053 stated, and appears in the ADR index
- [ ] CONTEXT.md has the new terms with `_Avoid_` lines, and uses no term from an existing `_Avoid_` list
- [ ] `pnpm turbo run test typecheck build --filter=docs` is unaffected (no generated docs edited)

## Acceptance
- [ ] TBD

## Done summary
Wrote ADR 0057 (Proposed (draft)). It records the served-records decisions taken from the spec's API Contracts, Decision Context and Boundaries. It states that it amends ADR 0053: the `method(...)` rejection still stands, and `records(...)` is the one exception. It states that it amends ADR 0056's one-form rule. It lists the new public names and both `AnalyzeCode` values. ADR 0057 is in the index, and the amendment is noted on the 0053 and 0056 rows and Status lines. CONTEXT.md gains Record Controller and Served Record, and its Record Adapter entry now says that on the server a Layer File provides the same Tag.

Note: ADR 0056's Status line was edited because the task's Approach asks for it. `docs/adr/0056-class-controllers-and-service-classes.md` is missing from the task's Touches list.

Tier: implementer (actual model: claude-opus-5-5)

stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: 0404e57c
- Tests: pnpm turbo run test typecheck build --filter=docs
- PRs: