---
satisfies: [R1]
---
# fn-20-adx-agent-developer-experience.1 Root AGENTS.md and CLAUDE.md import

## Description
Contributor-facing agent context. Only non-derivable rules; commands come from `package.json`/turbo, so cache only what a lookup cannot reveal (the verify table by change type, the vocabulary rule).

**Size:** S
**Files:** AGENTS.md (new), CLAUDE.md
**Touches:** [AGENTS.md, CLAUDE.md]

### Approach
- Read `docs/research/adx-agent-developer-experience.md` section 4.2 and 4.5 rec 1.
- Keep flow-next and model-routing blocks in both CLAUDE.md files; add `@AGENTS.md` import to the root one. Do not paste ADR/architecture text.
- Point at `CONTEXT.md` for vocabulary and `docs/adr/` for decisions; verify table maps change type (analyzer, kit, react, docs) to the exact turbo filter command.

## Acceptance
- [ ] AGENTS.md under ~100 lines with commands and verify table
- [ ] root CLAUDE.md imports it, no duplicated content

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
